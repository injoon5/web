import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sizeOfVideoFile, videoSize } from './video-size.js';

/** @param {string} type @param {...Buffer} parts */
function box(type, ...parts) {
	const body = Buffer.concat(parts);
	const head = Buffer.alloc(8);
	head.writeUInt32BE(8 + body.length, 0);
	head.write(type, 4, 'latin1');
	return Buffer.concat([head, body]);
}

/** A track header: identity matrix, or a quarter turn. */
function tkhd(width, height, { version = 0, rotated = false } = {}) {
	const times = version === 1 ? 32 : 20;
	const b = Buffer.alloc(4 + times + 16 + 36 + 8);
	b[0] = version;
	const m = 4 + times + 16;
	const one = 0x10000;
	if (rotated) {
		b.writeInt32BE(one, m + 4); // b
		b.writeInt32BE(-one, m + 12); // c
	} else {
		b.writeInt32BE(one, m); // a
		b.writeInt32BE(one, m + 16); // d
	}
	b.writeInt32BE(0x40000000, m + 32); // w
	b.writeUInt32BE(width * 65536, m + 36);
	b.writeUInt32BE(height * 65536, m + 40);
	return box('tkhd', b);
}

const hdlr = (kind) => box('hdlr', Buffer.alloc(8), Buffer.from(kind, 'latin1'), Buffer.alloc(12));
const trak = (header, kind) => box('trak', header, box('mdia', hdlr(kind)));
const ftyp = box('ftyp', Buffer.from('isom\0\0\0\0isom', 'latin1'));
const mdat = box('mdat', Buffer.alloc(4096, 7));

describe('videoSize', () => {
	it('reads the video track, skipping an audio track listed first', () => {
		const moov = box('moov', trak(tkhd(0, 0), 'soun'), trak(tkhd(800, 900), 'vide'));
		expect(videoSize(Buffer.concat([ftyp, moov, mdat]))).toEqual({ width: 800, height: 900 });
	});

	it('swaps the axes of a clip stored landscape and rotated a quarter turn', () => {
		const moov = box('moov', trak(tkhd(1920, 1080, { rotated: true }), 'vide'));
		expect(videoSize(Buffer.concat([ftyp, moov]))).toEqual({ width: 1080, height: 1920 });
	});

	it('reads a version 1 track header', () => {
		const moov = box('moov', trak(tkhd(640, 360, { version: 1 }), 'vide'));
		expect(videoSize(Buffer.concat([ftyp, moov]))).toEqual({ width: 640, height: 360 });
	});

	it('is null for something that is not an MP4', () => {
		expect(videoSize(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]))).toBeNull();
		expect(videoSize(Buffer.concat([ftyp, mdat]))).toBeNull();
	});
});

describe('sizeOfVideoFile', () => {
	it('finds a moov written after the media data', () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'video-size-'));
		const file = path.join(dir, 'end.mp4');
		writeFileSync(file, Buffer.concat([ftyp, mdat, box('moov', trak(tkhd(720, 1280), 'vide'))]));
		expect(sizeOfVideoFile(file)).toEqual({ width: 720, height: 1280 });
	});

	it("measures the site's own clip", () => {
		expect(sizeOfVideoFile('static/videos/projects/schoolwatch.mp4')).toEqual({
			width: 800,
			height: 900
		});
	});
});

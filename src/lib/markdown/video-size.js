/**
 * A video's display size, read out of an MP4/MOV container's headers.
 *
 * `LazyVideo` shows a poster until someone presses play, and with
 * `preload="none"` nothing about the file is known until then — so the frame
 * was a fixed 16:9, and an 800x900 watch recording played cropped to its top
 * half. The size is in the track header, so it is read at build time the way
 * `image-size.js` reads a photo's, without a decoder.
 *
 * ISO-BMFF only (mp4, m4v, mov), which is every video on the site. A WebM or
 * anything unreadable answers null, and the component falls back to 16:9 until
 * the file's own metadata arrives.
 */

import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

/** A `moov` larger than this is not a header worth reading at build time. */
const MAX_MOOV = 8 * 1024 * 1024;

/**
 * @param {Buffer} b
 * @param {number} start
 * @param {number} end
 * @returns {Generator<{ type: string, start: number, end: number }>} child boxes' content ranges
 */
function* boxes(b, start, end) {
	let at = start;
	while (at + 8 <= end) {
		let size = b.readUInt32BE(at);
		const type = b.toString('latin1', at + 4, at + 8);
		let header = 8;
		if (size === 1) {
			if (at + 16 > end) return;
			size = Number(b.readBigUInt64BE(at + 8));
			header = 16;
		} else if (size === 0) size = end - at;
		if (size < header || at + size > end) return;
		yield { type, start: at + header, end: at + size };
		at += size;
	}
}

/** @param {Buffer} b @param {{ start: number, end: number }} box @param {string} type */
const child = (b, box, type) => {
	for (const c of boxes(b, box.start, box.end)) if (c.type === type) return c;
	return null;
};

/**
 * The first video track's size from a `moov` box's contents.
 *
 * @param {Buffer} b
 * @param {{ start: number, end: number }} moov
 * @returns {{ width: number, height: number } | null}
 */
function fromMoov(b, moov) {
	for (const trak of boxes(b, moov.start, moov.end)) {
		if (trak.type !== 'trak') continue;
		const mdia = child(b, trak, 'mdia');
		const hdlr = mdia && child(b, mdia, 'hdlr');
		// version/flags (4), pre_defined (4), then the handler type.
		if (!hdlr || b.toString('latin1', hdlr.start + 8, hdlr.start + 12) !== 'vide') continue;

		const tkhd = child(b, trak, 'tkhd');
		if (!tkhd) continue;
		const v1 = b[tkhd.start] === 1;
		// version/flags, the times and ids (20 bytes, 32 in version 1), then
		// reserved, layer, group, volume, reserved (16) before the matrix.
		const matrix = tkhd.start + 4 + (v1 ? 32 : 20) + 16;
		const dims = matrix + 36;
		if (dims + 8 > tkhd.end) continue;

		let width = b.readUInt32BE(dims) / 65536;
		let height = b.readUInt32BE(dims + 4) / 65536;
		if (!(width > 0 && height > 0)) continue;

		// A phone stores a portrait clip landscape and rotates it in the matrix:
		// a and d zero means a quarter turn, which swaps the displayed axes.
		const a = b.readInt32BE(matrix);
		const d = b.readInt32BE(matrix + 16);
		if (a === 0 && d === 0) [width, height] = [height, width];
		return { width: Math.round(width), height: Math.round(height) };
	}
	return null;
}

/**
 * @param {Buffer} bytes a whole file, or at least one that contains its `moov`
 * @returns {{ width: number, height: number } | null}
 */
export function videoSize(bytes) {
	for (const box of boxes(bytes, 0, bytes.length)) {
		if (box.type === 'moov') return fromMoov(bytes, box);
	}
	return null;
}

/**
 * Walks the top-level boxes by their headers alone, so the media data — which
 * is nearly all of the file, and comes before `moov` unless it was written for
 * streaming — is skipped rather than read.
 *
 * @param {string} file
 * @returns {{ width: number, height: number } | null}
 */
export function sizeOfVideoFile(file) {
	const fd = openSync(file, 'r');
	try {
		const total = fstatSync(fd).size;
		const head = Buffer.alloc(16);
		let at = 0;
		while (at + 8 <= total) {
			readSync(fd, head, 0, 16, at);
			let size = head.readUInt32BE(0);
			const type = head.toString('latin1', 4, 8);
			if (size === 1) size = Number(head.readBigUInt64BE(8));
			else if (size === 0) size = total - at;
			if (size < 8) return null;
			if (type === 'moov') {
				if (size > MAX_MOOV) return null;
				const moov = Buffer.alloc(size);
				readSync(fd, moov, 0, size, at);
				return videoSize(moov);
			}
			at += size;
		}
		return null;
	} finally {
		closeSync(fd);
	}
}

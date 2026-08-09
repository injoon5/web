import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { imageSize } from './image-size.js';

/** A minimal PNG: signature, then an IHDR carrying the dimensions. */
function png(width, height) {
	const b = new Uint8Array(24);
	b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	b.set([0, 0, 0, 13], 8);
	b.set([0x49, 0x48, 0x44, 0x52], 12); // 'IHDR'
	new DataView(b.buffer).setUint32(16, width);
	new DataView(b.buffer).setUint32(20, height);
	return b;
}

/**
 * A JPEG built out of segments: an optional APP1/Exif with an orientation, then
 * an SOF0 with the stored dimensions.
 *
 * @param {number} width
 * @param {number} height
 * @param {{ orientation?: number, extraApp1?: boolean }} [options]
 */
function jpeg(width, height, { orientation, extraApp1 = false } = {}) {
	const bytes = [0xff, 0xd8];

	if (orientation !== undefined) {
		// APP1 -> 'Exif\0\0' -> TIFF header (big-endian) -> one IFD entry.
		const payload = [
			...[0x45, 0x78, 0x69, 0x66, 0x00, 0x00], // 'Exif\0\0'
			...[0x4d, 0x4d, 0x00, 0x2a], // 'MM', 42
			...[0x00, 0x00, 0x00, 0x08], // IFD0 at offset 8
			...[0x00, 0x01], // one entry
			...[0x01, 0x12], // tag 0x0112, Orientation
			...[0x00, 0x03], // type SHORT
			...[0x00, 0x00, 0x00, 0x01], // count 1
			...[0x00, orientation, 0x00, 0x00] // value, left-aligned in four bytes
		];
		const len = payload.length + 2;
		bytes.push(0xff, 0xe1, len >> 8, len & 0xff, ...payload);
	}

	if (extraApp1) {
		// XMP rides in an APP1 too, and on a photo out of an iPhone it comes after
		// the Exif one.
		const payload = [...'http://ns.adobe.com/xap/1.0/\0'].map((c) => c.charCodeAt(0));
		const len = payload.length + 2;
		bytes.push(0xff, 0xe1, len >> 8, len & 0xff, ...payload);
	}

	// SOF0: length (17), precision, height, width, then three component records.
	bytes.push(0xff, 0xc0, 0x00, 0x11, 0x08);
	bytes.push(height >> 8, height & 0xff, width >> 8, width & 0xff);
	bytes.push(...new Array(10).fill(0));
	return new Uint8Array(bytes);
}

describe('imageSize', () => {
	it('reads a PNG header', () => {
		expect(imageSize(png(1200, 800))).toEqual({ width: 1200, height: 800 });
	});

	it('reads a JPEG frame header', () => {
		expect(imageSize(jpeg(4032, 3024))).toEqual({ width: 4032, height: 3024 });
	});

	it('reads a GIF header', () => {
		const b = new Uint8Array(12);
		b.set([...'GIF89a'].map((c) => c.charCodeAt(0)));
		b.set([0x20, 0x03, 0x58, 0x02], 6); // 800 x 600, little-endian
		expect(imageSize(b)).toEqual({ width: 800, height: 600 });
	});

	it('reads a lossy WebP header', () => {
		const b = new Uint8Array(32);
		b.set([...'RIFF'].map((c) => c.charCodeAt(0)));
		b.set(
			[...'WEBP'].map((c) => c.charCodeAt(0)),
			8
		);
		b.set(
			[...'VP8 '].map((c) => c.charCodeAt(0)),
			12
		);
		b.set([0x40, 0x01], 26); // 320
		b.set([0xf0, 0x00], 28); // 240
		expect(imageSize(b)).toEqual({ width: 320, height: 240 });
	});

	// The one that matters for the reserved box: the browser rotates the photo
	// before it draws it, so a portrait shot stored landscape is displayed
	// portrait — and a box reserved at the stored ratio would be wrong by 90
	// degrees, which is worse than reserving nothing at all.
	it('swaps the axes for a transposing Exif orientation', () => {
		expect(imageSize(jpeg(4032, 3024, { orientation: 6 }))).toEqual({
			width: 3024,
			height: 4032
		});
	});

	it('leaves the axes alone for an upright Exif orientation', () => {
		expect(imageSize(jpeg(4032, 3024, { orientation: 1 }))).toEqual({
			width: 4032,
			height: 3024
		});
	});

	// A later APP1 segment used to answer "no orientation" for the whole file and
	// overwrite the one that had just been read, which un-rotated every iPhone
	// photo on the site.
	it('keeps the orientation from the first Exif segment past a second APP1', () => {
		expect(imageSize(jpeg(4032, 3024, { orientation: 6, extraApp1: true }))).toEqual({
			width: 3024,
			height: 4032
		});
	});

	it('returns null for a format it does not know, and for junk', () => {
		expect(imageSize(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]))).toBeNull();
		expect(imageSize(new Uint8Array(2))).toBeNull();
		expect(imageSize(null)).toBeNull();
	});

	it('returns null rather than a zero-sized box', () => {
		expect(imageSize(png(0, 500))).toBeNull();
	});

	// The probe is only worth having if it agrees with the decoder for the files
	// actually in this repo — the EXIF-rotated iPhone photos included.
	it('agrees with the real files in static/', () => {
		const cases = [
			['static/images/uploads/SCR-20240820-sod.png'],
			['static/images/uploads/IMG_8400.jpeg'],
			['static/images/uploads/us-camp/IMG_8855.jpeg']
		];
		for (const [file] of cases) {
			const size = imageSize(readFileSync(file));
			expect(size, file).not.toBeNull();
			expect(size.width, file).toBeGreaterThan(0);
			expect(size.height, file).toBeGreaterThan(0);
		}
		// The one with orientation 6: 2016x1512 on disk, portrait on screen.
		expect(imageSize(readFileSync('static/images/uploads/us-camp/IMG_8855.jpeg'))).toEqual({
			width: 1512,
			height: 2016
		});
	});
});

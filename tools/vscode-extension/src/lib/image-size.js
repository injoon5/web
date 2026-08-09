'use strict';

/**
 * Pixel dimensions straight out of the file header.
 *
 * The hover preview and the oversize warning both need a width, and neither is
 * worth spawning an image library for — every format the content tree uses
 * puts its dimensions in the first few dozen bytes.
 *
 * @typedef {{ width: number, height: number, type: string }} ImageSize
 */

/** @param {Uint8Array} bytes */
function png(bytes) {
	if (bytes.length < 24) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20), type: 'png' };
}

/** @param {Uint8Array} bytes */
function gif(bytes) {
	if (bytes.length < 10) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return { width: view.getUint16(6, true), height: view.getUint16(8, true), type: 'gif' };
}

/** @param {Uint8Array} bytes */
function jpeg(bytes) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let at = 2;

	while (at + 9 < bytes.length) {
		if (bytes[at] !== 0xff) {
			at += 1;
			continue;
		}

		const marker = bytes[at + 1];
		// Standalone markers carry no length.
		if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
			at += 2;
			continue;
		}

		const length = view.getUint16(at + 2);
		const isFrame =
			(marker >= 0xc0 && marker <= 0xc3) ||
			(marker >= 0xc5 && marker <= 0xc7) ||
			(marker >= 0xc9 && marker <= 0xcb) ||
			(marker >= 0xcd && marker <= 0xcf);

		if (isFrame) {
			return { height: view.getUint16(at + 5), width: view.getUint16(at + 7), type: 'jpeg' };
		}

		if (length < 2) return null;
		at += 2 + length;
	}

	return null;
}

/** @param {Uint8Array} bytes */
function webp(bytes) {
	if (bytes.length < 30) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

	if (chunk === 'VP8 ') {
		return {
			width: view.getUint16(26, true) & 0x3fff,
			height: view.getUint16(28, true) & 0x3fff,
			type: 'webp'
		};
	}

	if (chunk === 'VP8L') {
		const bits = view.getUint32(21, true);
		return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, type: 'webp' };
	}

	if (chunk === 'VP8X') {
		const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
		const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
		return { width, height, type: 'webp' };
	}

	return null;
}

/** @param {Uint8Array} bytes @param {number} at @param {string} value */
function tagIs(bytes, at, value) {
	for (let i = 0; i < value.length; i += 1) {
		if (bytes[at + i] !== value.charCodeAt(i)) return false;
	}
	return true;
}

/**
 * @param {Uint8Array} bytes
 * @returns {ImageSize | null}
 */
function imageSize(bytes) {
	if (!bytes || bytes.length < 12) return null;

	try {
		if (bytes[0] === 0x89 && tagIs(bytes, 1, 'PNG')) return png(bytes);
		if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpeg(bytes);
		if (tagIs(bytes, 0, 'GIF8')) return gif(bytes);
		if (tagIs(bytes, 0, 'RIFF') && tagIs(bytes, 8, 'WEBP')) return webp(bytes);
		if (tagIs(bytes, 4, 'ftyp')) {
			const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
			// AVIF and HEIC keep their dimensions in a nested `ispe` box; the format
			// is all the caller can use here, and it is enough to warn on.
			if (brand.startsWith('avi')) return null;
			if (brand.startsWith('hei') || brand.startsWith('mif')) return null;
		}
	} catch {
		return null;
	}

	return null;
}

module.exports = { imageSize };

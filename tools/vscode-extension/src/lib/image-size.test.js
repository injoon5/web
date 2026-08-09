'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { imageSize } = require('./image-size');

/** @param {number} width @param {number} height */
function png(width, height) {
	const bytes = new Uint8Array(24);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	bytes.set([0x49, 0x48, 0x44, 0x52], 12);
	new DataView(bytes.buffer).setUint32(16, width);
	new DataView(bytes.buffer).setUint32(20, height);
	return bytes;
}

/** @param {number} width @param {number} height */
function jpeg(width, height) {
	return new Uint8Array([
		0xff,
		0xd8,
		0xff,
		0xe0,
		0x00,
		0x04,
		0x00,
		0x00, // an APP0 segment to skip over
		0xff,
		0xc0,
		0x00,
		0x11,
		0x08,
		height >> 8,
		height & 0xff,
		width >> 8,
		width & 0xff,
		0x03,
		0x01,
		0x22,
		0x00
	]);
}

/** @param {number} width @param {number} height */
function gif(width, height) {
	const bytes = new Uint8Array(14);
	bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
	new DataView(bytes.buffer).setUint16(6, width, true);
	new DataView(bytes.buffer).setUint16(8, height, true);
	return bytes;
}

/** @param {number} width @param {number} height */
function webpVp8x(width, height) {
	const bytes = new Uint8Array(30);
	const ascii = (text, at) =>
		bytes.set(
			[...text].map((char) => char.charCodeAt(0)),
			at
		);

	ascii('RIFF', 0);
	ascii('WEBP', 8);
	ascii('VP8X', 12);
	bytes[24] = (width - 1) & 0xff;
	bytes[25] = ((width - 1) >> 8) & 0xff;
	bytes[26] = ((width - 1) >> 16) & 0xff;
	bytes[27] = (height - 1) & 0xff;
	bytes[28] = ((height - 1) >> 8) & 0xff;
	bytes[29] = ((height - 1) >> 16) & 0xff;
	return bytes;
}

test('png', () => {
	assert.deepEqual(imageSize(png(2400, 1600)), { width: 2400, height: 1600, type: 'png' });
});

test('jpeg, skipping segments before the frame header', () => {
	assert.deepEqual(imageSize(jpeg(4032, 3024)), { width: 4032, height: 3024, type: 'jpeg' });
});

test('gif', () => {
	assert.deepEqual(imageSize(gif(320, 240)), { width: 320, height: 240, type: 'gif' });
});

test('webp with an extended header', () => {
	assert.deepEqual(imageSize(webpVp8x(1200, 900)), { width: 1200, height: 900, type: 'webp' });
});

test('anything unreadable is null rather than a throw', () => {
	assert.equal(imageSize(new Uint8Array(0)), null);
	assert.equal(imageSize(new Uint8Array([1, 2, 3])), null);
	assert.equal(imageSize(new Uint8Array(64)), null);
});

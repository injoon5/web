/**
 * Intrinsic size of an image, read out of its header.
 *
 * This runs at build time, once per file, on every image in every post — so it
 * reads the first few hundred bytes and stops. Decoding the pixels (sharp is
 * already a devDependency) would be a second full decode of ~100 photos per
 * build for four numbers that live in the header.
 *
 * Only the formats these posts actually contain are handled: JPEG and PNG, plus
 * GIF and WebP because they are four lines each. Anything else returns null and
 * the caller leaves the image alone rather than guessing a box for it.
 *
 * Byte arithmetic throughout rather than `Buffer.readUInt16BE`, so a plain
 * `Uint8Array` works — which is what the tests hand it.
 */

/** @param {Uint8Array} b */
const u16be = (b, at) => (b[at] << 8) | b[at + 1];
/** @param {Uint8Array} b */
const u16le = (b, at) => b[at] | (b[at + 1] << 8);
/** @param {Uint8Array} b */
const u24le = (b, at) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
/** @param {Uint8Array} b */
const u32be = (b, at) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
/** @param {Uint8Array} b */
const u32le = (b, at) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

/**
 * @param {Uint8Array} b
 * @param {number} at
 * @param {number} len
 */
function ascii(b, at, len) {
	let out = '';
	for (let i = 0; i < len; i++) out += String.fromCharCode(b[at + i]);
	return out;
}

/** @param {Uint8Array} b */
function png(b) {
	if (b.length < 24) return null;
	// The signature, then IHDR — which the spec requires to be the first chunk.
	if (b[0] !== 0x89 || ascii(b, 1, 3) !== 'PNG' || ascii(b, 12, 4) !== 'IHDR') return null;
	return { width: u32be(b, 16), height: u32be(b, 20) };
}

/** @param {Uint8Array} b */
function gif(b) {
	if (b.length < 10 || ascii(b, 0, 3) !== 'GIF') return null;
	return { width: u16le(b, 6), height: u16le(b, 8) };
}

/** @param {Uint8Array} b */
function webp(b) {
	if (b.length < 30 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null;
	const chunk = ascii(b, 12, 4);
	// Lossy: a keyframe header, whose two 14-bit dimensions follow the sync code.
	if (chunk === 'VP8 ') return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
	// Lossless: 14 bits each, packed across four bytes, both stored one short.
	if (chunk === 'VP8L') {
		const bits = u32le(b, 21);
		return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
	}
	// Extended (animation, alpha, or an ICC profile): 24-bit canvas size.
	if (chunk === 'VP8X') return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
	return null;
}

/**
 * Orientation out of an APP1/Exif segment, or null when this segment is not one
 * — which is a distinction that has to survive: XMP rides in an APP1 too, and on
 * a photo out of an iPhone it comes *after* the Exif segment. Answering 1 for it
 * overwrote the orientation that had just been read.
 *
 * It matters because browsers honour it — `image-orientation: from-image` is the
 * initial value — so a portrait photo the camera stored landscape is *displayed*
 * portrait, and stamping the stored dimensions on it would reserve a box at the
 * wrong aspect ratio. Which is worse than reserving nothing.
 *
 * @param {Uint8Array} b
 * @param {number} at start of the segment's payload (past marker and length)
 * @param {number} end
 * @returns {number | null}
 */
function exifOrientation(b, at, end) {
	if (ascii(b, at, 6) !== 'Exif\0\0') return null;
	const tiff = at + 6;
	const order = ascii(b, tiff, 2);
	if (order !== 'II' && order !== 'MM') return 1;
	const big = order === 'MM';
	const u16 = (i) => (big ? u16be(b, i) : u16le(b, i));
	const u32 = (i) => (big ? u32be(b, i) : u32le(b, i));

	const ifd = tiff + u32(tiff + 4);
	if (ifd + 2 > end) return 1;
	const fields = u16(ifd);
	for (let i = 0; i < fields; i++) {
		// tag(2) type(2) count(4) value(4)
		const entry = ifd + 2 + i * 12;
		if (entry + 12 > end) break;
		if (u16(entry) === 0x0112) return u16(entry + 8);
	}
	return 1;
}

/** SOF0-SOF15, which carry the frame's dimensions. C4/C8/CC are other tables. */
function isFrameHeader(marker) {
	return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

/** @param {Uint8Array} b */
function jpeg(b) {
	if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
	let at = 2;
	/** null until an Exif segment has been seen. See `exifOrientation`. */
	let orientation = null;

	while (at + 4 <= b.length) {
		// Segments may be padded with fill bytes; skip to the next marker.
		if (b[at] !== 0xff) {
			at++;
			continue;
		}
		const marker = b[at + 1];
		if (marker === 0xff) {
			at++;
			continue;
		}
		// Standalone markers: no length, no payload.
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
			at += 2;
			continue;
		}
		// Start of scan — entropy-coded data from here, and no header left to read.
		if (marker === 0xda) break;

		const length = u16be(b, at + 2);
		if (length < 2) break;
		const payload = at + 4;
		const next = at + 2 + length;

		// The frame header is read from the five bytes that carry the dimensions,
		// without requiring the rest of the segment: the caller may well have
		// handed over only the head of the file.
		if (isFrameHeader(marker)) {
			if (payload + 5 > b.length) break;
			const height = u16be(b, payload + 1);
			const width = u16be(b, payload + 3);
			// 5-8 are the transposing orientations: what is stored landscape is
			// displayed portrait.
			return orientation >= 5 && orientation <= 8
				? { width: height, height: width }
				: { width, height };
		}

		if (next > b.length) break;

		// Exif comes before the frame header, so it is read on the way past. First
		// one wins: a file may carry several APP1 segments.
		if (marker === 0xe1 && orientation === null) orientation = exifOrientation(b, payload, next);

		at = next;
	}
	return null;
}

/**
 * @param {Uint8Array} bytes the head of an image file — 64KB is more than enough
 * @returns {{ width: number, height: number } | null} null when the format is
 *   unrecognised, or the header says a dimension is zero
 */
export function imageSize(bytes) {
	if (!bytes || bytes.length < 8) return null;
	const size = png(bytes) ?? gif(bytes) ?? webp(bytes) ?? jpeg(bytes);
	if (!size) return null;
	if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return null;
	if (size.width <= 0 || size.height <= 0) return null;
	return size;
}

/**
 * Shared look-up tables for the bookshelf.
 *
 * A book's spine geometry and cloth colour are derived deterministically from
 * its slug so the shelf renders identically on the server and the client (no
 * hydration reshuffle), while still looking irregular the way a real shelf
 * does. Frontmatter can override either: `color` picks a cloth by name (or
 * takes a raw hex), `pages` drives the spine thickness.
 */

/**
 * Book-cloth palette. Muted, slightly dusty binding colours — the site is
 * monochrome, so these are the only colour on the page and they earn it by
 * staying desaturated. `foil` is the stamped title colour for that cloth.
 */
export const CLOTHS = {
	ink: { base: '#2e3a4b', edge: '#1b2430', foil: '#e7e1d3' },
	oxblood: { base: '#5c2c2c', edge: '#3a1b1b', foil: '#ecdfc7' },
	moss: { base: '#3c4a38', edge: '#242e22', foil: '#e4e2cd' },
	sand: { base: '#c6b596', edge: '#9c8c6f', foil: '#3b3225' },
	slate: { base: '#404c5d', edge: '#28303c', foil: '#e3e6e7' },
	rust: { base: '#8a4b30', edge: '#5a2f1d', foil: '#f1e5d3' },
	cream: { base: '#e0d7c5', edge: '#b6ab95', foil: '#3a332a' },
	charcoal: { base: '#2b2b2b', edge: '#171717', foil: '#dcd7cc' },
	plum: { base: '#4a3550', edge: '#2c1e31', foil: '#ebe1ee' },
	teal: { base: '#294a4a', edge: '#152e2e', foil: '#dee9e6' },
	navy: { base: '#26344f', edge: '#151f33', foil: '#e6e3d6' },
	ochre: { base: '#a1762f', edge: '#6d4d1a', foil: '#f6ecd8' }
};

const CLOTH_NAMES = Object.keys(CLOTHS);

/** Stable 32-bit string hash (FNV-1a). Same value on server and client. */
export function hashString(str) {
	let h = 0x811c9dc5;
	for (let i = 0; i < String(str).length; i++) {
		h ^= String(str).charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/** Perceived luminance of a #rrggbb colour, 0–1. */
function luminance(hex) {
	const m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
	if (!m) return 0.3;
	const n = parseInt(m[1], 16);
	const r = (n >> 16) & 255;
	const g = (n >> 8) & 255;
	const b = n & 255;
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Resolve the cloth for a book. `previousName` lets the caller avoid two
 * identical spines sitting next to each other on the shelf.
 *
 * @param {{ slug?: string, color?: string }} book
 * @param {string} [previousName]
 */
export function clothFor(book, previousName) {
	const named = book?.color && CLOTHS[book.color];
	if (named) return { name: book.color, ...named };

	// A raw hex in frontmatter wins; derive the rest of the cloth from it.
	if (typeof book?.color === 'string' && /^#[0-9a-f]{6}$/i.test(book.color)) {
		const light = luminance(book.color) > 0.55;
		return {
			name: book.color,
			base: book.color,
			edge: book.color,
			foil: light ? '#3a332a' : '#e9e3d6'
		};
	}

	const h = hashString(book?.slug ?? '');
	let index = h % CLOTH_NAMES.length;
	if (previousName && CLOTH_NAMES[index] === previousName) {
		index = (index + 5) % CLOTH_NAMES.length;
	}
	const name = CLOTH_NAMES[index];
	return { name, ...CLOTHS[name] };
}

/** True when the cloth is pale enough that the shelf needs a darker outline. */
export function isPaleCloth(cloth) {
	return luminance(cloth.base) > 0.55;
}

/**
 * Spine thickness in px, for the single book rendered on a book's own page.
 * Real books get thicker with page count, so `pages` in frontmatter drives it
 * when present; otherwise the slug hash does.
 */
export function spineThickness(book) {
	const pages = Number(book?.pages);
	if (Number.isFinite(pages) && pages > 0) {
		return Math.round(Math.min(58, Math.max(24, 20 + pages / 11)));
	}
	return 28 + (hashString((book?.slug ?? '') + 'thickness') % 5) * 5;
}

const round = (n) => Math.round(n * 100) / 100;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * Geometry for a whole pile, bottom book first.
 *
 * Everything is expressed against the pile's own width (`cqw` / percent) so a
 * pile is the same object at any size.
 *
 * The model is deliberately narrow, because gravity is:
 *
 * - **A book lying on a flat book is flat.** No in-plane rotation, ever. A
 *   spine tipped in the picture plane reads as a pile in the act of falling
 *   over, which is why tilting them individually never looks right.
 * - **The one freedom it has is which way it is turned.** Nobody squares a
 *   book up with the one underneath, so each is yawed a few degrees about the
 *   vertical. Seen from slightly above and to the front, that turn is what
 *   puts one end of the spine nearer than the other — the near end taller, the
 *   far end shorter and riding up. The pile's `perspective` renders that; the
 *   apparent skew is a consequence of the turn rather than something drawn on
 *   top of it.
 * - **Piles drift.** The sideways offset carries over from the book below
 *   instead of being redrawn at random, so a pile leans the way a real one does.
 */
export function pileGeometry(books) {
	let previousShift = 0;

	return books.map((book) => {
		const slug = book?.slug ?? '';
		const h = hashString(slug);
		const pages = Number(book?.pages);

		const thickness =
			Number.isFinite(pages) && pages > 0
				? clamp(4.6 + pages / 46, 8, 21)
				: 9 + (hashString(slug + 'thickness') % 8);

		return {
			// Books in a pile are not all the same size, but they are close.
			width: 88 + (hashString(slug + 'width') % 13),
			thickness: round(thickness),
			yaw: round((((h >>> 17) % 19) - 9) * 0.8),
			shift: (previousShift = clamp(previousShift + ((((h >>> 11) % 9) - 4) * 1.5) / 2, -11, 11))
		};
	});
}

/**
 * Spines print the surname. Anything with a comma or an ampersand is already a
 * multi-author credit, so it stays as written.
 */
export function spineAuthor(name) {
	const value = String(name ?? '').trim();
	if (!value || /[&,]/.test(value)) return value;
	const parts = value.split(/\s+/);
	return parts.length > 1 ? parts[parts.length - 1] : value;
}

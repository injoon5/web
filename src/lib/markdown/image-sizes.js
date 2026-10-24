/**
 * `sizes` for article images, shared by the markdown build (`remarkImageSize`)
 * and the gallery, which runs in the browser — so nothing here may import a
 * Node module, unlike `image-variants.js` beside it.
 */

/**
 * The article column, as the browser should assume it before layout, measured
 * at each breakpoint of the post page: 100vw − 32px on a phone, − 96px from
 * 640px, then two proportional stretches beside the sidebar, and 699px from
 * 1154px up. Only browsers without `sizes="auto"` ever read it.
 */
export const COLUMN_SIZES =
	'(min-width: 1154px) 699px, (min-width: 1024px) calc(66.67vw - 70px), ' +
	'(min-width: 768px) calc(83.33vw - 83px), (min-width: 640px) calc(100vw - 96px), ' +
	'calc(100vw - 32px)';

/**
 * `auto` first: for a lazy image the browser then takes the width it actually
 * laid the image out at — which for a tall photo is its height cap turned into
 * a width, far narrower than the column, and which the build's placeholder box
 * already gets exactly right before a byte arrives. The column is the fallback.
 */
export const ARTICLE_SIZES = `auto, ${COLUMN_SIZES}`;

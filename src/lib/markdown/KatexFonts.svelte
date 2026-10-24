<script>
	/*
	 * Preloads the two KaTeX faces nearly every formula is set in, for the posts
	 * `remarkStylesheets` finds math in.
	 *
	 * KaTeX's sheet declares its fonts `font-display: block`, so a formula is
	 * invisible until they arrive — and without a preload they are only asked
	 * for once the sheet has been parsed and the page laid out, which on a slow
	 * connection left every equation blank for seconds. `swap` would be worse:
	 * fallback glyphs have other metrics, so fractions and scripts would jump
	 * when the real face lands. Fetching them alongside the sheet keeps `block`
	 * honest. Vite names an asset by its content, so these are the same files
	 * the sheet's `url()`s point at, not second copies.
	 */
	import main from 'katex/dist/fonts/KaTeX_Main-Regular.woff2?url';
	import mathItalic from 'katex/dist/fonts/KaTeX_Math-Italic.woff2?url';
</script>

<svelte:head>
	<link rel="preload" href={main} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="preload" href={mathItalic} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<script module>
	import NumberFlowLite, { define, formatToData, renderInnerHTML } from 'number-flow/lite';

	define('number-flow', NumberFlowLite);
</script>

<script>
	import { untrack } from 'svelte';

	/**
	 * In place of `@number-flow/svelte`, whose markup does not survive hydration.
	 *
	 * Its `{@html}` is the element's only child, which Svelte's client compiles
	 * as a controlled block expecting no hydration markers, while the server
	 * emits them; and it renders `undefined` in the browser against the server's
	 * string. The cursor lands in the wrong place and Svelte throws
	 * HYDRATION_ERROR. Under SvelteKit 2 that was caught by `hydrate()` and the
	 * whole page silently re-rendered; SvelteKit 3 hydrates inside a root error
	 * boundary, so it now reaches `handleError` and every article became the 500
	 * page.
	 *
	 * So both sides render the same string, which is what lets hydration claim
	 * the server's nodes, and it is computed once: every later value reaches the
	 * element through its `data` property, which animates. On a client-side mount
	 * the string lands as an inert `<template>` in light DOM, which the shadow
	 * root (no `<slot>`) never shows.
	 */
	let { value, trend = NumberFlowLite.defaultProps.trend, locales, format } = $props();

	const data = $derived(formatToData(value, new Intl.NumberFormat(locales, format)));
	const markup = renderInnerHTML(untrack(() => data));

	/** @param {NumberFlowLite} el */
	function sync(el) {
		// Trend first: the element reads it while applying the new data.
		el.trend = trend;
		el.data = data;
	}
</script>

<number-flow {@attach sync}>{@html markup}</number-flow>

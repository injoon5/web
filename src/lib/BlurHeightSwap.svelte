<script>
	import { blur } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { tick } from 'svelte';

	export let swapKey;
	export let blurParams = { amount: 8, opacity: 0, duration: 420, easing: cubicOut };
	export let animate = true;

	/** @type {string | undefined} */
	export let className = undefined;

	const blurT = (node, params) => (params.duration ? blur(node, params) : {});

	let shell;
	let ready = false;
	let fromHeight = 0;
	let lastKey = swapKey;
	/** @type {Animation | undefined} */
	let heightAnim;

	$: duration = blurParams.duration ?? 420;
	$: easing = blurParams.easing ?? cubicOut;

	$: if (swapKey !== lastKey) {
		if (shell) fromHeight = shell.getBoundingClientRect().height;
		lastKey = swapKey;
	}

	/** @param {CustomEvent} event */
	async function onIntroStart(event) {
		const node = /** @type {HTMLElement} */ (event.currentTarget);
		const toHeight = node.offsetHeight;
		if (!shell) return;

		heightAnim?.cancel();

		if (!ready || !animate || !duration) {
			shell.style.height = `${toHeight}px`;
			ready = true;
			return;
		}

		if (fromHeight === toHeight) {
			shell.style.height = `${toHeight}px`;
			return;
		}

		shell.style.height = `${fromHeight}px`;
		await tick();

		heightAnim = shell.animate(
			[{ height: `${fromHeight}px` }, { height: `${toHeight}px` }],
			{ duration, easing, fill: 'forwards' }
		);

		try {
			await heightAnim.finished;
			shell.style.height = `${toHeight}px`;
		} catch {
			// cancelled by a rapid swap
		}
	}
</script>

<div bind:this={shell} class="overflow-hidden {className ?? ''}">
	<div class="grid">
		{#key swapKey}
			<div
				style="grid-area: 1 / 1;"
				in:blurT={blurParams}
				out:blurT={blurParams}
				on:introstart={onIntroStart}
			>
				<slot />
			</div>
		{/key}
	</div>
</div>

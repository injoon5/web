<script>
	import { tick } from 'svelte';
	import Play from '@lucide/svelte/icons/play';

	let { src, label = 'Play demo video' } = $props();

	/** @type {HTMLVideoElement | null} */
	let video = $state(null);
	let loaded = $state(false);

	async function play() {
		if (!video) return;

		if (!loaded) {
			video.src = src;
			loaded = true;
			await tick();
		}

		await video.play();
	}
</script>

<div class="not-prose my-8">
	<div
		class="relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
	>
		{#if !loaded}
			<button
				type="button"
				class="group flex aspect-video w-full flex-col items-center justify-center gap-3 bg-neutral-950/95 text-white transition-colors hover:bg-neutral-900"
				aria-label={label}
				onclick={play}
			>
				<span
					class="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 transition-transform group-hover:scale-105"
				>
					<Play class="h-7 w-7 fill-current pl-1" aria-hidden="true" />
				</span>
				<span class="text-sm font-medium text-neutral-200">{label}</span>
			</button>
		{/if}

		<video
			bind:this={video}
			class="aspect-video w-full bg-black {loaded ? 'block' : 'hidden'}"
			controls
			playsinline
			preload="none"
		>
			<track kind="captions" />
		</video>
	</div>
</div>

<script>
	import { tick } from 'svelte';
	import Play from '@lucide/svelte/icons/play';

	let { src, label = 'Play demo video' } = $props();

	/* The skin's controls live in its shadow root, and the packaged skin ships
	   no rule for the `hidden`/`data-*` state the button components expose. So
	   the one control this site does not want is turned off with a sheet of our
	   own rather than by ejecting the whole skin.

	   Casting is off entirely. AirPlay already hides itself where it is
	   unsupported, but the cast button only goes to
	   `data-availability="unavailable"` and stays on screen greyed out, which
	   reads as something broken rather than something absent.

	   The captions button needs nothing here: it sets its own `hidden` once the
	   media carries no caption track, so it comes back by itself if one is ever
	   added. */
	const HIDE_CASTING = `
		media-cast-button,
		media-airplay-button {
			display: none !important;
		}
	`;

	/** @type {HTMLVideoElement | null} */
	let video = $state(null);
	/** @type {(HTMLElement & { shadowRoot: ShadowRoot | null }) | null} */
	let skin = $state(null);
	let loaded = $state(false);
	/* The player is a set of custom elements. If their definitions never arrive
	   the markup below stays inert, so the <video> falls back to native
	   controls rather than rendering as a chrome-less rectangle. */
	let native = $state(false);

	async function play() {
		if (!loaded) {
			/* @videojs/html defines custom elements at module scope and reads
			   HTMLElement/CSSStyleSheet while doing it, so it cannot be imported
			   during SSR — it is loaded here, which also keeps it off the page
			   entirely for visitors who never press play. Awaiting it before the
			   markup renders means the elements upgrade in their first frame
			   instead of flashing an unskinned video. */
			try {
				await Promise.all([
					import('@videojs/html/video/player'),
					import('@videojs/html/video/skin')
				]);
			} catch {
				native = true;
			}

			loaded = true;
			await tick();

			/* The skin builds its shadow root in its constructor, so it is there
			   as soon as the element upgrades — which the await above guarantees
			   has already happened. */
			const root = skin?.shadowRoot;
			if (root) {
				const sheet = new CSSStyleSheet();
				sheet.replaceSync(HIDE_CASTING);
				root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
			}
		}

		await video?.play();
	}
</script>

<div class="not-prose my-8">
	<div
		class="relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
	>
		{#if loaded}
			<!-- <video-player> holds the state every component reads and is
			     `display: contents`, so <video-skin> is the box that gets sized.
			     The skin rounds the video itself at 1.75rem by default; the frame
			     above already clips at `rounded-lg`, so that is turned off rather
			     than nested inside a tighter radius. -->
			<video-player>
				<video-skin bind:this={skin} class="aspect-video w-full" style="--media-border-radius: 0">
					<!-- The skin draws the controls, so the media element carries
					     none of its own unless the definitions failed to load.

					     Deliberately no <track>: an empty one counts as a caption
					     track, which is what had the captions button reporting
					     itself available on clips that carry no subtitles. -->
					<!-- svelte-ignore a11y_media_has_caption -->
					<video bind:this={video} {src} class="bg-black" controls={native} playsinline></video>
				</video-skin>
			</video-player>
		{:else}
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
	</div>
</div>

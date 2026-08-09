<script>
	import { motion } from '$lib/reduced-motion.svelte.js';
	import { lightboxStore, MAX_LIGHTBOX_HEIGHT, normalizeLightboxValue } from './store.svelte.js';
	import Stepper from '$lib/pasito/Stepper.svelte';
	import { springEasing, springOr } from './spring.js';
	import {
		clampPanTo,
		containSize,
		deltaBetween,
		pageStep,
		panAfterScale,
		rubber as rubberBand,
		settleSpec
	} from './geometry.js';
	import { createVelocityTracker } from './velocity.js';
	import { createModalHost, focusablesIn } from './modal.js';
	import {
		alignOrigin,
		createFlightRunner,
		flightTransform,
		IDENTITY,
		isOffScreen
	} from './flight.js';
	import { onDestroy } from 'svelte';

	// --- tuning ---------------------------------------------------------------
	const AXIS_LOCK = 8; // px of movement before the drag axis is committed
	const PAGE_RATIO = 0.2; // fraction of the viewport dragged that pages
	const PAGE_VELOCITY = 0.4; // px/ms flick that pages regardless of distance
	const DISMISS_DISTANCE = 110; // px dragged down (or up) that dismisses
	const DISMISS_VELOCITY = 0.65; // px/ms flick that dismisses
	const RUBBER = 0.55; // iOS rubber-band constant, for drags past an end
	const MAX_SCALE = 4;
	const TAP_SLOP = 6; // px of movement that turns a tap into a drag
	const CLOSE_MS = 220;
	// Paging is the thing you do most once the lightbox is open, so it is tuned
	// as an interaction and not as a modal: 340ms for a whole page, less for a
	// shorter journey, and never so brief that the eye loses the photo.
	const SETTLE_MS = 340;
	const SETTLE_MIN_MS = 190;
	// ms of pointer history a release is judged on. See `velocityAt`.
	const VELOCITY_WINDOW = 60;
	// Settle spring velocity bounds. See `settleSpec` in geometry.js.
	const SETTLE_V0_MAX = 6;
	const SETTLE_V0_MIN = -3;
	// A trackpad's momentum keeps arriving after the fingers are gone, so the
	// gesture is over when the events stop, not when a finger lifts.
	const WHEEL_IDLE_MS = 90;
	const ZOOM_MS = 280;
	// The curve every settle uses: fast out of the finger, long soft landing.
	// (Ionic's drawer curve — the same one Vaul uses.)
	const SETTLE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
	const CHROME_TOP = 72; // room the close button's row needs
	const CHROME_BOTTOM_MIN = 56;
	// The shared-element flight: the photo travels from where it sits in the
	// article to where it sits full-screen, and back. Out is faster than in.
	const FLIGHT_IN_MS = 340;
	const FLIGHT_OUT_MS = 260;
	// A dismissed photo has further to travel — it starts wherever the finger
	// left it — so it gets a little longer to get there.
	const FLIGHT_RETURN_MS = 300;
	// Fallback for browsers without `linear()`. See `springEasing`.
	const FLIGHT_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
	const LIGHTBOX_THEME_COLOR = '#0a0a0a';

	let visible = $state(false);
	// The group the lightbox was opened on. A single image is a group of one, so
	// there is only one code path through sizing, swiping and dismissal.
	let items = $state([]);
	let index = $state(0);
	// `index` one frame late, and the only thing deciding which slides carry a
	// `src`. Mounting a neighbour's <img> in the commit that starts the page makes
	// that commit long and the settle begins late. Do not collapse into `index`.
	let windowIndex = $state(0);
	let closing = $state(false);
	let dismissing = $state(false);

	let rootEl = $state(null);
	let viewportEl = $state(null);
	/** This open flew in, so the stage's own entrance stays off for all of it. */
	let flew = $state(false);
	/** A flight home is running, so the stage's exit stays off for it. */
	let flyingHome = $state(false);
	let closeBtn = $state(null);
	/** Measured, so the image box reserves exactly the room the chrome uses. */
	let bottomH = $state(0);

	const count = $derived(items.length);
	const grouped = $derived(count > 1);
	const current = $derived(items[index] ?? null);
	const alt = $derived(current?.alt ?? '');
	// Held open across the whole group: the chrome's height is what reserves room
	// for the photo, so a collapsing caption resizes the image being looked at.
	const anyCaption = $derived(items.some((i) => i?.alt));

	// --- gesture state --------------------------------------------------------
	// One pointer stream for mouse, pen and touch. The axis is locked once, on the
	// first few px — re-deciding per move let a diagonal flick page and dismiss.
	/** @type {null | 'x' | 'y' | 'pan'} */
	let axis = $state(null);
	let dragging = $state(false);
	let pinching = $state(false);
	let dragX = $state(0);
	let dragY = $state(0);
	/** A trackpad swipe is moving the track right now, so nothing may transition it. */
	let wheeling = $state(false);
	/**
	 * The one-off `transition` a released gesture hands the track. Null between
	 * gestures, where `settleTransition` applies — an arrow key carries no velocity.
	 */
	let trackSettle = $state(null);

	// Zoom is one number. There used to be two (a click-to-zoom flag that swapped
	// the image's width, and a pinch scale), and they could disagree.
	let scale = $state(1);
	let panX = $state(0);
	let panY = $state(0);

	/**
	 * Live pointers, newest last. Deliberately not `$state`: nothing renders from
	 * it and it changes on every pointermove.
	 * @type {Array<{ id: number, x: number, y: number }>}
	 */
	let pointers = [];

	function trackPointer(e) {
		const at = pointers.findIndex((p) => p.id === e.pointerId);
		if (at === -1) pointers.push({ id: e.pointerId, x: e.clientX, y: e.clientY });
		else pointers[at] = { id: e.pointerId, x: e.clientX, y: e.clientY };
	}

	function dropPointer(id) {
		const at = pointers.findIndex((p) => p.id === id);
		if (at === -1) return false;
		pointers.splice(at, 1);
		return true;
	}

	let startX = 0;
	let startY = 0;
	// The lock threshold, taken back out of the first frame after the axis is
	// decided. Without it the photo is still for 8px and then jumps 8px, which is
	// the one moment the eye is certain to be on it.
	let slopX = 0;
	let slopY = 0;
	// Where the track was when the drag took it over, so a swipe that interrupts
	// a settle continues from there instead of snapping to the resting position.
	let carryX = 0;
	let panStartX = 0;
	let panStartY = 0;
	let pinchStartDist = 0;
	let pinchStartScale = 1;
	let pinchStartPanX = 0;
	let pinchStartPanY = 0;
	let pinchCentreX = 0;
	let pinchCentreY = 0;
	let moved = false;
	let closeTimer;
	let settleTimer;
	let wheelRaw = 0;
	let wheelCarry = 0;
	let wheelTimer;

	const velocity = createVelocityTracker(VELOCITY_WINDOW);

	function resetZoom() {
		scale = 1;
		panX = 0;
		panY = 0;
	}

	function resetGesture() {
		dragX = 0;
		dragY = 0;
		axis = null;
		dragging = false;
		pinching = false;
		pointers = [];
		velocity.clear();
		slopX = slopY = carryX = 0;
		unbindPointerStream();
		endWheelGesture();
		moved = false;
		resetZoom();
		clearTimeout(settleTimer);
		trackSettle = null;
		flight.cancel();
		stopLiftWatch();
	}

	// --- viewport -------------------------------------------------------------
	// `inset: 0` is not a full-screen guarantee: an ancestor with a transform,
	// filter or `contain` becomes the containing block for a fixed child, and the
	// mobile toolbar moves the bottom edge. Hence the portal to <body>, and a
	// height of `100dvh` floored by the measured `window.innerHeight`.
	let winW = $state(typeof window !== 'undefined' ? window.innerWidth : 0);
	let winH = $state(typeof window !== 'undefined' ? window.innerHeight : 0);

	const reserveBottom = $derived(Math.max(bottomH + 16, CHROME_BOTTOM_MIN));
	const availW = $derived(Math.max(80, winW - 32));
	const availH = $derived(
		Math.max(80, Math.min(winH - CHROME_TOP - reserveBottom, MAX_LIGHTBOX_HEIGHT))
	);

	const currentFit = $derived(winW && winH ? containSize(current, availW, availH) : null);

	/** Layout centre of the image box, in viewport coordinates. */
	const centreX = $derived(winW / 2);
	const centreY = $derived(CHROME_TOP + availH / 2);

	$effect(() => {
		const val = normalizeLightboxValue(lightboxStore.value);
		if (val?.items.length) {
			// A close schedules an unmount; reopening inside that window would
			// otherwise be shut again by the timer from the close before it.
			clearTimeout(closeTimer);
			items = val.items;
			index = val.index;
			// The first paint has to carry the image, not wait a frame for it.
			windowIndex = val.index;
			resetGesture();
			closing = false;
			dismissing = false;
			flew = false;
			flyingHome = false;
			visible = true;
		} else {
			visible = false;
			closing = false;
			dismissing = false;
			// A close mid-drag leaves the window listeners bound and the gesture
			// half-committed; nothing else would take them down until the next
			// pointerup, which may never come.
			pointers = [];
			unbindPointerStream();
			// ...and a trackpad swipe closed mid-coast would otherwise settle onto a
			// lightbox that is no longer there.
			endWheelGesture();
			dragging = false;
			pinching = false;
			axis = null;
		}
	});

	// Let the render window follow one frame behind. See `windowIndex`.
	$effect(() => {
		const to = index;
		if (windowIndex === to) return;
		if (Math.abs(to - windowIndex) > 1 || typeof requestAnimationFrame !== 'function') {
			windowIndex = to;
			return;
		}
		const frame = requestAnimationFrame(() => (windowIndex = to));
		return () => cancelAnimationFrame(frame);
	});

	// A resize can leave a zoomed image panned past its own edge.
	$effect(() => {
		void winW;
		void winH;
		if (scale > 1) clampPan();
	});

	// --- open / close bookkeeping --------------------------------------------
	let previouslyFocused = null;
	let wasVisible = false;

	/**
	 * The page's own fixed top chrome — the header — is above everything except an
	 * open lightbox, which covers it. The one exception is a photo flying back into
	 * the article: the box it lands in is routinely *under* that bar, and this
	 * dialog paints at `z-index: 9999`, so the photo crosses over the bar and the
	 * page then takes it back underneath in one frame, slicing the top off it at
	 * the exact moment the eye has followed it there.
	 *
	 * So the header is handed the top of the stack for the rest of the flight — on
	 * `<html>`, so neither component has to know the other exists. Nothing about
	 * the header itself changes: no fade, no opacity, which would break its
	 * `backdrop-filter` outright (any grouped opacity above a backdrop-filtered
	 * element is a new backdrop root, and the blur then has nothing to sample).
	 *
	 * @param {'returning' | null} state
	 */
	function markPage(state) {
		if (typeof document === 'undefined') return;
		if (state) document.documentElement.dataset.lightbox = state;
		else delete document.documentElement.dataset.lightbox;
	}

	// Back under the dialog for every open, and for a reopen inside a close window.
	$effect(() => {
		if (!visible || !(closing || dismissing)) markPage(null);
	});

	/**
	 * How deep a band of fixed chrome the page reserves at the top — asked as how
	 * deep the band is, not what is in it, so this component still knows nothing
	 * about the header.
	 *
	 * `scroll-padding-top`, not `--nav-h` itself: the custom property is a token,
	 * and until `NavBar` republishes it as px it computes as `3.5rem`, which
	 * `parseFloat` reads as **3.5** — the lift then landed 52px into the bar. A
	 * used length is resolved to px by the cascade. It is the header plus 1rem, so
	 * the swap happens a little *before* the photo reaches the bar, which is the
	 * only direction that is free.
	 */
	function topChromeDepth() {
		if (typeof document === 'undefined') return 0;
		const px = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
		return Number.isFinite(px) ? px : 0;
	}

	let liftFrame = 0;

	/** Guarded: `onDestroy` also runs on the server, where there are no frames. */
	function stopLiftWatch() {
		if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(liftFrame);
	}

	/**
	 * Hand the page's chrome the top of the stack at the frame the photo reaches
	 * it — the last frame on which the two still do not overlap, so the swap is
	 * invisible by construction rather than by timing.
	 *
	 * Waiting for the backdrop to fade instead loses the race exactly where it
	 * matters: measured, a photo whose article box sits 200px under the header is
	 * already 90px across the bar by the time the scrim is gone. Watching the box
	 * costs one rect read per frame of one 260ms animation, and it is right at
	 * every scroll position rather than at most of them.
	 *
	 * @param {HTMLElement} img the flying photo
	 * @param {DOMRect} home the box it is flying to
	 */
	function liftChromeOnApproach(img, home) {
		stopLiftWatch();
		const depth = topChromeDepth();
		// It lands clear of the bar, so it never has anything to get behind.
		if (!depth || home.top >= depth) return;
		const watch = () => {
			if (!visible) return;
			if (img.getBoundingClientRect().top <= depth) {
				markPage('returning');
				return;
			}
			liftFrame = requestAnimationFrame(watch);
		};
		watch();
	}

	const modal = createModalHost({ themeColor: LIGHTBOX_THEME_COLOR });

	// Only on the actual open<->close transition: without the `wasVisible` gate a
	// re-run recaptures `previouslyFocused` as the close button itself.
	$effect(() => {
		if (visible && !wasVisible) {
			previouslyFocused = document.activeElement;
			modal.open();
			queueMicrotask(() => closeBtn?.focus());
			wasVisible = true;
		} else if (!visible && wasVisible) {
			// Releases the inert background too, before focus is restored: focus
			// cannot land inside an inert tree.
			modal.close();
			if (previouslyFocused) {
				try {
					previouslyFocused.focus();
				} catch {
					// Element may have been removed from the DOM.
				}
				previouslyFocused = null;
			}
			wasVisible = false;
		}
	});

	/**
	 * Reserve the room the chrome actually takes, before anything is measured
	 * against the box that leaves for the photo.
	 *
	 * `bind:clientHeight` reports through a ResizeObserver, and that does not run
	 * until the frame's rendering step — after this action, though still before
	 * anything is painted. So the layout standing here is one with no room
	 * reserved for the caption, and the reserve grows by its height a moment
	 * later. Nothing on screen suffers for that (every painted frame is already
	 * the corrected one), but the flight is measured *here*, against a box that
	 * then moves half the difference out from under it.
	 *
	 * Everything downstream of `bottomH` is a `$derived`, and those are pull-based:
	 * `reserveBottom` and `currentFit` read as the values the next flush will
	 * render the moment it is assigned, so writing them onto the node is only
	 * bringing the DOM forward to the frame it is about to be in anyway.
	 */
	function settleChromeReserve(node) {
		const bottom = node.querySelector('.lb-bottom');
		if (!bottom) return;
		bottomH = bottom.clientHeight;
		node.style.setProperty('--lb-pad-bottom', `${reserveBottom}px`);
		const img = node.querySelector('.lb-img[data-current="true"]');
		if (!img || !currentFit) return;
		img.style.width = `${currentFit.w}px`;
		img.style.height = `${currentFit.h}px`;
	}

	/** Move the dialog to <body>; a modal is only a modal with nothing above it. */
	function portal(node) {
		if (typeof document === 'undefined') return;
		document.body.appendChild(node);
		// Here, not in the open effect: this is the first moment the node is provably
		// a <body> child — `bind:this` and that effect share a flush, in no set order.
		modal.inertBackground(node);
		// Same reason the inerting lives here: this is the first moment the whole
		// subtree is in the document and can be measured.
		settleChromeReserve(node);
		startOpenFlight(node);
		return {
			destroy() {
				modal.releaseBackground();
				// Only now — the flying copy is gone this frame, so the page-side
				// image reappears exactly as the lightbox's lands on it.
				showOrigin();
				node.remove();
				flew = false;
				flyingHome = false;
			}
		};
	}

	function scheduleClose(ms) {
		clearTimeout(closeTimer);
		// Reduced motion drops movement, not the fade — the element still has to
		// have time to fade out before it is unmounted.
		closeTimer = setTimeout(() => lightboxStore.set(null), ms);
	}

	function close() {
		if (closing || dismissing) return;
		closing = true;
		if (startCloseFlight()) return;
		scheduleClose(CLOSE_MS);
	}

	/** Page to another image in the group. Clamped, so the ends are ends. */
	function goTo(next) {
		if (!count) return;
		const clamped = Math.max(0, Math.min(next, count - 1));
		dragX = 0;
		dragY = 0;
		axis = null;
		resetZoom();
		if (clamped === index) return;
		index = clamped;
	}

	/**
	 * An image collected before it loaded carries no natural size, and
	 * `containSize` needs one to reserve the box. Fill it in once.
	 */
	function onImageLoad(e, item) {
		const el = e.currentTarget;
		item.loaded = true;
		if (item.naturalWidth) return;
		item.naturalWidth = el.naturalWidth;
		item.naturalHeight = el.naturalHeight;
	}

	// --- shared-element flight ------------------------------------------------
	// Opening overshoots a little — it is arriving. Coming home does not: past
	// the mark would mean past the slot the photo belongs in.
	const SPRING_IN = springEasing(0.25);
	const SPRING_HOME = springEasing(0);

	const flight = createFlightRunner();
	let hiddenOrigin = null;

	/** The element on the page the current image came from, if it is still there. */
	function originEl() {
		const el = current?.el;
		return el && el.isConnected ? el : null;
	}

	/** `visibility`, not `display`: the flight measures this box, and collapsing
	 *  it would reflow the article underneath. */
	function hideOrigin(el) {
		if (hiddenOrigin?.el === el) return;
		showOrigin();
		if (!el) return;
		hiddenOrigin = { el, visibility: el.style.visibility };
		el.style.visibility = 'hidden';
	}

	function showOrigin() {
		if (!hiddenOrigin) return;
		hiddenOrigin.el.style.visibility = hiddenOrigin.visibility;
		hiddenOrigin = null;
	}

	/** The lightbox's own copy of the image currently on screen. */
	function currentImgEl() {
		return rootEl?.querySelector('.lb-img[data-current="true"]') ?? null;
	}

	/**
	 * A dismiss drag moves the strip, not the photo. Unwind it and hand the
	 * distance to the photo's first keyframe, so one animation carries the whole
	 * journey rather than two transforms fighting over the same pixels.
	 */
	function unwindStrip() {
		const strip = rootEl?.querySelector('.lb-strip');
		if (!strip) return;
		strip.style.transition = 'none';
		strip.style.transform = 'none';
	}

	/** The stage's own entrance, whatever state it is in. See `startOpenFlight`. */
	function stageEntrance(root) {
		return root.querySelector('.lb-stage')?.getAnimations?.() ?? [];
	}

	function startOpenFlight(root) {
		const from = originEl();
		if (from) hideOrigin(from);
		// Without a known natural size the image has no settled box yet, and
		// `onload` would resize it out from under the animation.
		if (motion.reduced || !currentFit) return;
		const to = root.querySelector('.lb-img[data-current="true"]');
		if (!from || !to || typeof to.animate !== 'function') return;
		// Every refusal first, and this one measures the origin: no layout at all
		// (jsdom) leaves the entrance below untouched.
		const base = from.getBoundingClientRect();
		if (base.width < 1 || base.height < 1) return;

		// `lb-in` is already in effect — a CSS animation with a backwards fill
		// applies from the moment the element is first styled — so the stage is
		// holding `scale(0.92)`, and a rect is read through every ancestor
		// transform. Measured through it the photo's box comes out 8% smaller than
		// the one it actually lands in, and `flew` then takes the entrance away: the
		// flight's first frame paints the photo 8% *bigger* than the thumbnail it is
		// supposed to be leaving, which is the pop before the flight. Cancel it here
		// rather than trusting `flew` — that class is a state change, and it lands a
		// flush after this measurement.
		for (const entrance of stageEntrance(root)) entrance.cancel();
		const f = deltaBetween(to.getBoundingClientRect(), base);
		if (!f) return;
		flew = true;
		flight.cancel();
		flight.run(
			to,
			[{ transform: flightTransform(f) }, { transform: IDENTITY }],
			FLIGHT_IN_MS,
			'backwards',
			springOr(FLIGHT_EASE, SPRING_IN)
		);
	}

	/**
	 * Closing mid-settle would measure the image against a moving track. Dropping
	 * the transition snaps it to the resting transform the flight assumes.
	 */
	function freezeTrack() {
		const track = rootEl?.querySelector('.lb-track');
		if (!track) return;
		track.style.transition = 'none';
	}

	/**
	 * Fly the photo home from wherever it is on screen — not its layout box, if an
	 * opening flight is still running or a dismiss drag carried it off centre.
	 * Returns false when there is nowhere to fly to, and every check that can
	 * refuse runs before anything is unwound, so a refusal leaves the photo where
	 * the fallback expects it.
	 */
	function startCloseFlight({ carried = false, duration = FLIGHT_OUT_MS } = {}) {
		if (motion.reduced || scale > 1) return false;
		const to = originEl();
		const img = currentImgEl();
		if (!to || !img || typeof img.animate !== 'function') return false;
		alignOrigin(to);
		// Aligned and still off-screen: there is nowhere on screen to fly to, and
		// a flight there would just be the photo leaving in a strange direction.
		if (isOffScreen(to, winW, winH)) return false;

		// Measured before anything is undone: this is the box the eye is on.
		const cur = img.getBoundingClientRect();
		if (cur.width < 1) return false;

		// Every write first, then every read. Interleaving them forces a fresh
		// layout per read, and this all happens inside the one frame a finger is
		// lifted — the frame the eye is most likely to catch.
		flight.cancel();
		if (carried) {
			unwindStrip();
			dragX = 0;
			dragY = 0;
		}
		freezeTrack();

		// ...and now the photo's own layout box, with every transform off it.
		const base = img.getBoundingClientRect();
		const homeRect = to.getBoundingClientRect();
		const from = deltaBetween(base, cur);
		const home = deltaBetween(base, homeRect);
		if (!from || !home) return false;

		flyingHome = true;
		flight.run(
			img,
			[{ transform: flightTransform(from) }, { transform: flightTransform(home) }],
			duration,
			'forwards',
			springOr(FLIGHT_EASE, SPRING_HOME),
			() => {
				// The instant the flying copy lands, not after Svelte unmounts: the two
				// overlap exactly, so the swap is invisible.
				showOrigin();
				lightboxStore.set(null);
			}
		);
		// A cancelled or dropped animation must not strand the lightbox open.
		scheduleClose(duration + 120);
		liftChromeOnApproach(img, homeRect);
		return true;
	}

	// Keep exactly one page-side image hidden: the one the lightbox is showing,
	// which is also the one it will fly back to.
	$effect(() => {
		if (!visible) return;
		const el = originEl();
		if (el) hideOrigin(el);
	});

	// --- pointer gestures -----------------------------------------------------
	const rubber = (delta, dim) => rubberBand(delta, dim, RUBBER);

	function clampPan() {
		if (!currentFit) return;
		({ x: panX, y: panY } = clampPanTo(currentFit, scale, availW, availH, panX, panY));
	}

	/** Re-anchor the pan so the point under the fingers/cursor stays put. */
	function scaleAbout(nextScale, x, y, baseScale, basePanX, basePanY) {
		({ x: panX, y: panY } = panAfterScale({
			nextScale,
			baseScale,
			x,
			y,
			centreX,
			centreY,
			panX: basePanX,
			panY: basePanY
		}));
		scale = nextScale;
	}

	function beginPinch() {
		const [a, b] = pointers;
		pinchStartDist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
		pinchStartScale = scale;
		pinchStartPanX = panX;
		pinchStartPanY = panY;
		pinchCentreX = (a.x + b.x) / 2;
		pinchCentreY = (a.y + b.y) / 2;
		pinching = true;
		dragging = false;
		axis = null;
		dragX = 0;
		dragY = 0;
	}

	function updatePinch() {
		const [a, b] = pointers;
		const dist = Math.hypot(b.x - a.x, b.y - a.y);
		const next = Math.max(0.6, Math.min(MAX_SCALE, pinchStartScale * (dist / pinchStartDist)));
		const cx = (a.x + b.x) / 2;
		const cy = (a.y + b.y) / 2;
		scaleAbout(next, pinchCentreX, pinchCentreY, pinchStartScale, pinchStartPanX, pinchStartPanY);
		// ...and let the two fingers carry the image with them.
		panX += cx - pinchCentreX;
		panY += cy - pinchCentreY;
	}

	function seedDrag(x, y, t) {
		startX = x;
		startY = y;
		velocity.reset(x, y, t);
		slopX = slopY = carryX = 0;
		panStartX = panX;
		panStartY = panY;
		dragging = true;
		axis = scale > 1 ? 'pan' : null;
	}

	/**
	 * On the window, not the element, so a drag that leaves the viewport still
	 * ends. Bound imperatively rather than via `svelte:window` so the listener
	 * exists before the first move, not after the next effect flush.
	 */
	function bindPointerStream() {
		if (typeof window === 'undefined') return;
		window.addEventListener('pointermove', onPointerMove, { passive: true });
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', onPointerCancel);
	}

	function unbindPointerStream() {
		if (typeof window === 'undefined') return;
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
		window.removeEventListener('pointercancel', onPointerCancel);
	}

	function onPointerDown(e) {
		if (closing || dismissing) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		// A finger on the photo ends any trackpad swipe still coasting; the drag
		// picks the track up from wherever that left it.
		endWheelGesture();
		if (pointers.length === 0) bindPointerStream();
		trackPointer(e);
		if (pointers.length === 2) {
			beginPinch();
			return;
		}
		if (pointers.length > 2) return;
		moved = false;
		seedDrag(e.clientX, e.clientY, e.timeStamp);
	}

	function onPointerMove(e) {
		if (!pointers.some((p) => p.id === e.pointerId)) return;
		trackPointer(e);
		if (pointers.length >= 2) {
			if (pinching) updatePinch();
			return;
		}
		if (!dragging) return;

		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (!moved && Math.hypot(dx, dy) > TAP_SLOP) moved = true;

		velocity.push(e.clientX, e.clientY, e.timeStamp);

		if (axis === 'pan') {
			panX = panStartX + dx;
			panY = panStartY + dy;
			clampPan();
			return;
		}

		if (!axis) {
			if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
			// Sideways only means something when there is somewhere to go.
			axis = grouped && Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
			// Take the lock threshold back out of the first frame, or the photo sits
			// still for 8px and then jumps 8px. Measured now, not at pointerdown.
			if (axis === 'x') {
				slopX = Math.sign(dx) * Math.min(Math.abs(dx), AXIS_LOCK);
				carryX = pickUpTrack();
			} else {
				slopY = Math.sign(dy) * Math.min(Math.abs(dy), AXIS_LOCK);
			}
		}

		if (axis === 'x') {
			const raw = carryX + dx - slopX;
			// Rubber-band at the ends so the group's edges are felt, not hit.
			const atEnd = (raw > 0 && index === 0) || (raw < 0 && index === count - 1);
			dragX = atEnd ? rubber(raw, winW || 1) : raw;
		} else {
			dragY = dy - slopY;
		}
	}

	/**
	 * Where the track actually is, as an offset from the slot it is settling
	 * towards, so grabbing a page mid-flight stops it under the finger.
	 */
	function pickUpTrack() {
		const track = rootEl?.querySelector('.lb-track');
		if (!track || typeof DOMMatrixReadOnly !== 'function') return 0;
		const t = getComputedStyle(track).transform;
		if (!t || t === 'none') return 0;
		try {
			// Every slide is one track width, so the resting offset is -index pages.
			return new DOMMatrixReadOnly(t).m41 + index * track.clientWidth;
		} catch {
			return 0;
		}
	}

	/**
	 * Give the track its own transition for this one settle, sprung from the speed
	 * the gesture ended at. Called before `goTo`, so `index` and `dragX` still
	 * describe where the photo is rather than where it is going.
	 */
	function armTrackSettle(target, v) {
		clearTimeout(settleTimer);
		trackSettle = null;
		if (motion.reduced) return;
		const page = winW || 1;
		const spec = settleSpec((index - target) * page - dragX, page, v, {
			min: SETTLE_MIN_MS,
			max: SETTLE_MS,
			v0Min: SETTLE_V0_MIN,
			v0Max: SETTLE_V0_MAX
		});
		if (!spec) return;
		const { duration, v0 } = spec;
		trackSettle = `transform ${duration}ms ${springOr(SETTLE_EASE, springEasing(0, v0))}`;
		// Back to the shared curve once it has landed, so the next arrow key does
		// not inherit this swipe's velocity. Changing the declaration alone moves
		// nothing.
		settleTimer = setTimeout(() => (trackSettle = null), duration + 60);
	}

	/** Which slide a released horizontal gesture belongs on. */
	function pageTarget(travelled, v) {
		const step = pageStep(travelled, v, winW, {
			lock: AXIS_LOCK,
			ratio: PAGE_RATIO,
			flickVelocity: PAGE_VELOCITY
		});
		return Math.max(0, Math.min(count - 1, index + step));
	}

	function settleX(now) {
		const vx = velocity.at(now).x;
		// Measured from where the drag took the track over, not the resting slot:
		// counting the carry as movement paged on a finger that never moved.
		const target = pageTarget(dragX - carryX, vx);
		armTrackSettle(target, vx);
		goTo(target);
	}

	function settleY(now) {
		const velY = velocity.at(now).y;
		const far = Math.abs(dragY) > DISMISS_DISTANCE;
		const flick = Math.abs(velY) > DISMISS_VELOCITY && Math.abs(dragY) > 24;
		axis = null;
		if (!far && !flick) {
			dragY = 0;
			return;
		}
		// The photo goes back where it came from: it has followed the finger down,
		// and now it travels on to the place it holds in the article — which may
		// well be back up past where the drag started.
		if (startCloseFlight({ carried: true, duration: FLIGHT_RETURN_MS })) {
			closing = true;
			return;
		}
		// Nothing to return to. Then it is a discard, and the copy on the page
		// comes back now rather than leaving a hole in the strip for the throw.
		dismissing = true;
		showOrigin();
		dragY = Math.sign(dragY || 1) * (winH || 800);
		scheduleClose(SETTLE_MS);
	}

	function onPointerUp(e) {
		if (!dropPointer(e.pointerId)) return;
		if (pointers.length === 0) unbindPointerStream();

		if (pinching) {
			if (pointers.length >= 2) return;
			pinching = false;
			if (scale < 1.05) resetZoom();
			else clampPan();
			// A finger still down after a pinch keeps dragging, from where it is.
			if (pointers.length === 1) {
				const p = pointers[0];
				moved = true;
				seedDrag(p.x, p.y, e.timeStamp);
			}
			return;
		}

		if (pointers.length > 0 || !dragging) return;
		dragging = false;
		if (axis === 'pan') {
			clampPan();
			axis = null;
			return;
		}
		if (axis === 'x') settleX(e.timeStamp);
		else if (axis === 'y') settleY(e.timeStamp);
		axis = null;
	}

	function onPointerCancel(e) {
		dropPointer(e.pointerId);
		if (pointers.length === 0) {
			unbindPointerStream();
			dragging = false;
			pinching = false;
			axis = null;
			velocity.clear();
			slopX = slopY = carryX = 0;
			dragX = 0;
			dragY = 0;
			if (scale > 1) clampPan();
			else resetZoom();
		}
	}

	function zoomTarget() {
		const f = currentFit;
		if (!f || !current?.naturalWidth) return 2;
		// Past 1:1 it is only bigger, not sharper — but a tap has to visibly do
		// something, so never less than 2x.
		return Math.min(MAX_SCALE, Math.max(2, current.naturalWidth / f.w));
	}

	function toggleZoom(x, y) {
		if (scale > 1) {
			resetZoom();
			return;
		}
		scaleAbout(zoomTarget(), x, y, 1, 0, 0);
		clampPan();
	}

	function onViewportClick(e) {
		// A drag ends in a click too. Only a tap that stayed still is a tap.
		if (moved) {
			moved = false;
			return;
		}
		const img = e.target?.closest?.('.lb-img');
		if (img && img.dataset.current === 'true') toggleZoom(e.clientX, e.clientY);
		else close();
	}

	/**
	 * ctrl/cmd + wheel is the browser's own zoom gesture (and what a trackpad
	 * pinch reports). A plain horizontal wheel is a trackpad swipe, so it pages;
	 * a plain wheel while zoomed pans.
	 */
	function onWheel(e) {
		if (!visible) return;
		if (e.ctrlKey || e.metaKey) {
			e.preventDefault();
			const next = Math.max(1, Math.min(MAX_SCALE, scale * Math.exp(-e.deltaY * 0.0035)));
			if (next === 1) resetZoom();
			else {
				scaleAbout(next, e.clientX, e.clientY, scale, panX, panY);
				clampPan();
			}
			return;
		}
		if (scale > 1) {
			e.preventDefault();
			panX -= e.deltaX;
			panY -= e.deltaY;
			clampPan();
			return;
		}
		if (!grouped || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
		e.preventDefault();
		// A trackpad swipe moves the track under the fingers, the same as a drag
		// does. It used to accumulate 80px in silence and then jump a whole page,
		// which is the same gesture the article's own strip answers continuously.
		if (!wheeling) {
			wheeling = true;
			// Same as a finger taking over mid-settle: pick the track up where it
			// is, and remember that offset so it is not later mistaken for scrolling
			// the visitor did.
			wheelRaw = wheelCarry = pickUpTrack();
			clearTimeout(settleTimer);
			trackSettle = null;
		}
		wheelRaw -= e.deltaX;
		const atEnd = (wheelRaw > 0 && index === 0) || (wheelRaw < 0 && index === count - 1);
		dragX = atEnd ? rubber(wheelRaw, winW || 1) : wheelRaw;
		clearTimeout(wheelTimer);
		wheelTimer = setTimeout(settleWheel, WHEEL_IDLE_MS);
	}

	/**
	 * Trackpad momentum has decayed to nothing by the time the events stop, so
	 * where it came to rest is all it meant — there is no flick to read off it.
	 */
	function settleWheel() {
		if (!wheeling) return;
		wheeling = false;
		const target = pageTarget(dragX - wheelCarry, 0);
		armTrackSettle(target, 0);
		goTo(target);
	}

	function endWheelGesture() {
		clearTimeout(wheelTimer);
		wheeling = false;
		wheelRaw = wheelCarry = 0;
	}

	// --- keyboard -------------------------------------------------------------
	function handleKeydown(e) {
		if (!visible) return;
		if (e.key === 'Escape') {
			close();
			return;
		}
		if (e.key === '0') {
			resetZoom();
			return;
		}
		if (e.key === '+' || e.key === '=') {
			e.preventDefault();
			scaleAbout(Math.min(MAX_SCALE, scale * 1.5), centreX, centreY, scale, panX, panY);
			clampPan();
			return;
		}
		if (e.key === '-') {
			e.preventDefault();
			const next = Math.max(1, scale / 1.5);
			if (next === 1) resetZoom();
			else {
				scaleAbout(next, centreX, centreY, scale, panX, panY);
				clampPan();
			}
			return;
		}
		if (grouped && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
			e.preventDefault();
			goTo(index + (e.key === 'ArrowRight' ? 1 : -1));
			return;
		}
		if (grouped && (e.key === 'Home' || e.key === 'End')) {
			e.preventDefault();
			goTo(e.key === 'Home' ? 0 : count - 1);
			return;
		}
		if (e.key === 'Tab') {
			// Keep focus in the dialog. With one focusable it parks there, which is
			// what this did before the group chrome added any others.
			const list = focusablesIn(rootEl);
			if (list.length === 0) return;
			e.preventDefault();
			const at = list.indexOf(document.activeElement);
			const next = e.shiftKey
				? at <= 0
					? list.length - 1
					: at - 1
				: at === -1 || at === list.length - 1
					? 0
					: at + 1;
			list[next]?.focus();
		}
	}

	onDestroy(() => {
		clearTimeout(closeTimer);
		clearTimeout(wheelTimer);
		clearTimeout(settleTimer);
		stopLiftWatch();
		unbindPointerStream();
		flight.cancel();
		modal.close();
		showOrigin();
		markPage(null);
		previouslyFocused = null;
	});

	// --- derived presentation -------------------------------------------------
	const dismissProgress = $derived(Math.min(1, Math.abs(dragY) / ((winH || 1) * 0.5)));
	const settling = $derived(!dragging && !pinching && !motion.reduced);
	const settleTransition = $derived(
		motion.reduced ? 'none' : `transform ${SETTLE_MS}ms ${SETTLE_EASE}`
	);

	// The track is `position: absolute; inset: 0` and its slides overflow it, so
	// its own width stays one page — that is what makes `translateX(-i * 100%)`
	// mean one page per step. One `style:` directive per property, never a single
	// string: a string is re-parsed in full on every frame of a drag.
	const trackTransform = $derived(`translate3d(calc(${-index * 100}% + ${dragX}px), 0, 0)`);
	// A gesture in hand transitions nothing — the track is following a finger. A
	// released one gets the spring `armTrackSettle` built for it; everything else
	// (an arrow key, a tapped dot) gets the shared curve.
	const trackTransition = $derived(
		wheeling || (dragging && axis === 'x') ? 'none' : (trackSettle ?? settleTransition)
	);

	const stageTransform = $derived(
		`translate3d(0, ${dragY}px, 0) scale(${dismissing ? 0.9 : 1 - dismissProgress * 0.12})`
	);
	const stageTransition = $derived(settling ? settleTransition : 'none');

	const imageTransform = $derived(`translate3d(${panX}px, ${panY}px, 0) scale(${scale})`);
	const imageTransition = $derived(
		`opacity 240ms var(--ease-out), box-shadow 200ms var(--ease-out), border-radius 200ms var(--ease-out)${
			dragging || pinching || motion.reduced ? '' : `, transform ${ZOOM_MS}ms ${SETTLE_EASE}`
		}`
	);

	// Only the flat scrim's alpha follows the drag. See the note on `.lb-blur`.
	const scrimOpacity = $derived(closing || dismissing ? 0 : 1 - dismissProgress * 0.8);
	const chromeOpacity = $derived(
		closing || dismissing ? 0 : Math.max(0, 1 - dismissProgress * 2.4)
	);

	const dialogLabel = $derived(
		grouped ? `${alt || 'Image preview'} — ${index + 1} of ${count}` : alt || 'Image preview'
	);
	const position = $derived(grouped ? `Image ${index + 1} of ${count}` : '');
</script>

<svelte:window onkeydown={handleKeydown} bind:innerWidth={winW} bind:innerHeight={winH} />

{#if visible}
	<div
		bind:this={rootEl}
		use:portal
		class="lb-root"
		class:closing
		class:dismissing
		class:zoomed={scale > 1}
		class:flew
		class:flying-home={flyingHome}
		class:dragging
		style="--lb-vh: {winH}px; --lb-pad-top: {CHROME_TOP}px; --lb-pad-bottom: {reserveBottom}px; --lb-max-height: {MAX_LIGHTBOX_HEIGHT}px"
		style:--lb-spring={springOr(null, SPRING_IN)}
		role="dialog"
		aria-modal="true"
		aria-label={dialogLabel}
		tabindex="-1"
	>
		<!-- Two layers because fading a blurred one does not fade the blur — it
		     reveals the sharp page underneath it, and a dismiss drag ended up
		     reading the article through the scrim. The material and the dimming
		     are separate: the blur holds while the flat scrim above it follows
		     the finger, which is the same reason iOS keeps them apart. It buys
		     nothing on frame times; the blur costs what it costs either way. -->
		<div class="lb-blur"></div>
		<div class="lb-scrim" style:opacity={scrimOpacity}></div>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			bind:this={viewportEl}
			class="lb-viewport"
			onpointerdown={onPointerDown}
			onclick={onViewportClick}
			onwheel={onWheel}
		>
			<!-- The open/close animation owns its own element: a CSS animation beats
			     an inline transform in the cascade, so sharing one would freeze the
			     drag transform at the animation's last frame. -->
			<div class="lb-stage">
				<div class="lb-strip" style:transform={stageTransform} style:transition={stageTransition}>
					<div class="lb-track" style:transform={trackTransform} style:transition={trackTransition}>
						{#each items as item, i (item.src + i)}
							{@const near = Math.abs(i - windowIndex) <= 1}
							{@const f = winW && winH ? containSize(item, availW, availH) : null}
							<div class="lb-slide" aria-hidden={i === index ? undefined : 'true'}>
								{#if near}
									<img
										src={item.src}
										alt={item.alt ?? ''}
										class="lb-img"
										class:pending={!item.loaded && !item.naturalWidth}
										data-current={i === index ? 'true' : 'false'}
										style:width={f ? `${f.w}px` : undefined}
										style:height={f ? `${f.h}px` : undefined}
										style:transform={i === index ? imageTransform : undefined}
										style:transition={i === index ? imageTransition : undefined}
										draggable="false"
										decoding="async"
										fetchpriority={i === index ? 'high' : 'low'}
										onload={(e) => onImageLoad(e, item)}
									/>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- Chrome layer — above the image, and outside the transform that moves it,
		     so a swipe never drags the controls along with the photo. -->
		<div class="lb-chrome" style="opacity: {chromeOpacity}">
			<button bind:this={closeBtn} class="lb-btn lb-close" onclick={close} aria-label="Close image">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>

			{#if grouped}
				<button
					class="lb-btn lb-prev"
					onclick={() => goTo(index - 1)}
					disabled={index === 0}
					aria-label="Previous image"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="15 18 9 12 15 6" />
					</svg>
				</button>
				<button
					class="lb-btn lb-next"
					onclick={() => goTo(index + 1)}
					disabled={index === count - 1}
					aria-label="Next image"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="9 18 15 12 9 6" />
					</svg>
				</button>
			{/if}

			<div class="lb-bottom" bind:clientHeight={bottomH}>
				{#if anyCaption}
					<div class="lb-caption-slot">
						<!-- A true crossfade wants both captions alive at once, which means
						     Svelte transitions, which are WAAPI — and that is a dependency
						     this does not need for one line of text. The slot being held open
						     is what actually mattered here. -->
						{#key index}
							<p class="lb-caption">{alt}</p>
						{/key}
					</div>
				{/if}

				{#if grouped}
					<div class="lb-steps">
						<Stepper
							{count}
							active={index}
							onStepClick={goTo}
							maxVisible={9}
							class="lb-stepper"
							label="Images in this group"
							containerRole="group"
							stepRole="button"
							stepLabel={(i, total) => `Go to image ${i + 1} of ${total}`}
						/>
					</div>
				{/if}
			</div>
		</div>

		<!-- Paging swaps no focus and changes no label, so the position has to be
		     spoken separately or it is silent. -->
		<p class="sr-only" aria-live="polite">{position}</p>
	</div>
{/if}

<style>
	.lb-root {
		/* Two curves for the whole component: a strong ease-out for anything
		   entering or leaving, and the drawer curve for anything a finger settles.
		   Never ease-in — it withholds movement while the eye is on it. */
		--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
		--ease-entrance: cubic-bezier(0.16, 1, 0.3, 1);

		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		/* Not `inset: 0`: on mobile the ICB's bottom edge sits under the collapsing
		   toolbar. `100dvh` tracks it; measured innerHeight is the floor. */
		height: 100vh;
		height: var(--lb-vh, 100dvh);
		min-height: 100dvh;
		z-index: 9999;
		overscroll-behavior: contain;
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
	}

	.lb-blur,
	.lb-scrim {
		position: absolute;
		inset: 0;
	}

	/* The `-webkit-` prefix goes FIRST. Written the other way round the minifier
	   collapses the pair to the prefixed declaration alone, and Chrome and Firefox
	   — which have never supported `-webkit-backdrop-filter` — render no blur at
	   all. That had been shipping. Check the built CSS if you touch this.

	   8px, not the 14px-plus-saturate this started at: the blur is the most
	   expensive thing on screen and the two are indistinguishable at the opacity
	   the scrim reaches. */
	.lb-blur {
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		animation: lb-fade-in 0.28s var(--ease-entrance) backwards;
	}

	.lb-root.closing .lb-blur,
	.lb-root.dismissing .lb-blur {
		opacity: 0;
		transition: opacity 0.2s var(--ease-out);
	}

	.lb-scrim {
		background: rgba(0, 0, 0, 0.86);
		transition: opacity 0.28s var(--ease-out);
		/* `backwards`, not `both`: a filling animation outranks inline styles, so
		   `both` pinned opacity to 1 and the inline dismiss fade never showed. */
		animation: lb-fade-in 0.28s var(--ease-entrance) backwards;
		will-change: opacity;
	}

	.lb-root.dragging .lb-scrim {
		transition: none;
	}

	/* Out faster than in, and faster than the photo it sits behind — a scrim that
	   outlives the image reads as the lightbox hanging. */
	.lb-root.closing .lb-scrim,
	.lb-root.dismissing .lb-scrim {
		transition-duration: 0.2s;
	}

	.lb-viewport {
		position: absolute;
		inset: 0;
		overflow: hidden;
		cursor: zoom-out;
	}

	.lb-root.zoomed .lb-viewport {
		cursor: grab;
	}

	.lb-root.dragging .lb-viewport {
		cursor: grabbing;
	}

	.lb-stage {
		position: absolute;
		inset: 0;
		/* The flight's own spring, so the fallback entrance is not stiffer than the
		   animation it stands in for. */
		animation: lb-in 0.36s var(--lb-spring, var(--ease-entrance)) both;
	}

	/* A photo flying from the article *is* the entrance; a stage scaling under it
	   would be a second, contrary one. Held for the whole open, so releasing it
	   can never replay `lb-in` half way through. */
	.lb-root.flew .lb-stage {
		animation: none;
	}

	/* Declared after, so a close still gets its exit even on an open that flew. */
	.lb-root.closing .lb-stage {
		animation: lb-out 0.22s var(--ease-out) forwards;
	}

	/* ...unless the photo is flying home under its own power, or being thrown. */
	.lb-root.closing.flying-home .lb-stage,
	.lb-root.dismissing .lb-stage {
		animation: none;
	}

	.lb-strip {
		position: absolute;
		inset: 0;
		will-change: transform;
	}

	.lb-track {
		position: absolute;
		inset: 0;
		display: flex;
		will-change: transform;
	}

	.lb-slide {
		position: relative;
		flex: 0 0 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--lb-pad-top, 72px) 1rem var(--lb-pad-bottom, 56px);
	}

	.lb-img {
		max-width: 100%;
		max-height: min(100%, var(--lb-max-height, 900px));
		width: auto;
		height: auto;
		object-fit: contain;
		border-radius: 0.375rem;
		box-shadow:
			0 25px 60px rgba(0, 0, 0, 0.5),
			0 0 0 1px rgba(255, 255, 255, 0.06);
		user-select: none;
		-webkit-user-drag: none;
		cursor: zoom-in;
		transform-origin: center center;
		transition: opacity 0.24s var(--ease-out);
	}

	/* Gated on `.zoomed`, not on `data-current` alone: paging moves that attribute,
	   so a hint hanging on it tore down a layer and built another in the commit
	   that starts the settle. The track is promoted either way, so slides
	   composite through it; this is for pinch and pan only. */
	.lb-root.zoomed .lb-img[data-current='true'] {
		will-change: transform;
	}

	/* Shed on the way home: a photo back in its slot still carrying a lifted
	   photo's shadow and corners reads as sitting on top of the article. */
	.lb-root.flying-home .lb-img[data-current='true'] {
		box-shadow:
			0 0 0 0 rgba(0, 0, 0, 0),
			0 0 0 0 rgba(255, 255, 255, 0);
		border-radius: 0;
	}

	/* And it must not swallow a tap in the frames between landing and unmounting. */
	.lb-root.flying-home {
		pointer-events: none;
	}

	.lb-root.zoomed .lb-img[data-current='true'] {
		cursor: zoom-out;
	}

	@keyframes lb-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes lb-in {
		from {
			opacity: 0;
			transform: scale(0.92);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes lb-out {
		from {
			opacity: 1;
			transform: scale(1);
		}
		to {
			opacity: 0;
			transform: scale(0.92);
		}
	}

	/* An image with no known size has nothing holding its box, so it would pop in
	   at full opacity the instant it decodes. */
	.lb-img.pending {
		opacity: 0;
	}

	.lb-chrome {
		position: absolute;
		inset: 0;
		pointer-events: none;
		transition: opacity 0.2s var(--ease-out);
		/* A beat behind the photo, so the chrome arrives around what has landed.
		   `backwards` again — the inline opacity has to keep working after. */
		animation: lb-fade-in 0.3s var(--ease-out) 0.07s backwards;
	}

	/* A photo can be white to its edges, and then the chrome is sitting on it. Two
	   long shallow scrims: invisible against the backdrop, enough under a bright
	   image. */
	.lb-chrome::before,
	.lb-chrome::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		height: 10rem;
		pointer-events: none;
	}

	.lb-chrome::before {
		top: 0;
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0));
	}

	.lb-chrome::after {
		bottom: 0;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0));
	}

	/* Zoomed in, everything but the way out is in the way — and no scrim makes a
	   caption readable over every photograph. */
	.lb-root.zoomed .lb-bottom,
	.lb-root.zoomed .lb-prev,
	.lb-root.zoomed .lb-next,
	.lb-root.zoomed .lb-chrome::after {
		opacity: 0;
		pointer-events: none;
	}

	.lb-bottom,
	.lb-chrome::after {
		transition: opacity 0.2s var(--ease-out);
	}

	.lb-root.dragging .lb-chrome {
		transition: none;
	}

	.lb-btn {
		position: absolute;
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		background: rgba(0, 0, 0, 0.55);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		color: white;
		border: none;
		cursor: pointer;
		pointer-events: auto;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
		transition:
			background-color 0.16s var(--ease-out),
			opacity 0.16s var(--ease-out),
			transform 0.16s var(--ease-out);
	}

	/* Touch reports hover on tap, so an ungated hover state sticks after the
	   finger is gone. */
	@media (hover: hover) and (pointer: fine) {
		.lb-btn:hover:not(:disabled) {
			background: rgba(0, 0, 0, 0.72);
		}
	}

	/* Press feedback, and only press feedback: a control that also grew on hover
	   would jump 1.05 -> 0.96 the instant it was clicked. */
	.lb-btn:active:not(:disabled) {
		transform: scale(0.96);
	}

	.lb-btn:disabled {
		opacity: 0.25;
		cursor: default;
	}

	.lb-btn:focus-visible {
		outline: 2px solid rgba(255, 255, 255, 0.65);
		outline-offset: 2px;
	}

	.lb-btn svg {
		width: 1.125rem;
		height: 1.125rem;
	}

	.lb-close {
		top: max(1rem, env(safe-area-inset-top, 0px));
		right: max(1rem, env(safe-area-inset-right, 0px));
	}

	.lb-prev,
	.lb-next {
		top: 50%;
		margin-top: -1.25rem;
	}

	.lb-prev {
		left: max(1rem, env(safe-area-inset-left, 0px));
	}

	.lb-next {
		right: max(1rem, env(safe-area-inset-right, 0px));
	}

	/* On a phone the arrows would sit on top of the image and duplicate what the
	   swipe already does — the stepper is the control that stays. */
	@media (max-width: 640px), (pointer: coarse) {
		.lb-prev,
		.lb-next {
			display: none;
		}
	}

	.lb-bottom {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.625rem;
		padding: 0 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
	}

	.lb-caption-slot {
		display: grid;
		max-width: min(60ch, 100%);
	}

	.lb-caption {
		grid-area: 1 / 1;
		color: rgba(255, 255, 255, 0.78);
		font-size: 0.875rem;
		text-align: center;
		line-height: 1.45;
		margin: 0;
		text-shadow: 0 1px 8px rgba(0, 0, 0, 0.7);
		/* A caption is a caption, not an essay: two lines, then an ellipsis, so it
		   can never grow tall enough to push the image it describes off-screen. */
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		/* Exactly the two lines it clamps to, held open across the whole group. The
		   chrome's height reserves room for the photo, so a caption that wrapped
		   where its neighbour did not resized the photo mid-slide. */
		min-height: 2.9em;
		animation: lb-caption-in 0.2s var(--ease-out) both;
	}

	@keyframes lb-caption-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.lb-steps {
		pointer-events: auto;
	}

	.lb-steps :global(.lb-stepper) {
		--pill-bg: rgba(255, 255, 255, 0.28);
		--pill-active-bg: rgba(255, 255, 255, 0.95);
		--pill-fill-bg: rgba(255, 255, 255, 0.35);
		--pill-container-bg: rgba(0, 0, 0, 0.55);
		--pill-container-border: rgba(255, 255, 255, 0.12);
		--pill-focus-ring: rgba(255, 255, 255, 0.65);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
	}

	/* Fewer and gentler, not none: the fades stay (without them the lightbox
	   blinks in and out of existence), the movement goes. */
	@media (prefers-reduced-motion: reduce) {
		.lb-stage {
			animation-name: lb-fade-in;
		}

		.lb-root.closing .lb-stage {
			animation-name: lb-fade-out;
		}
	}

	@keyframes lb-fade-out {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}
</style>

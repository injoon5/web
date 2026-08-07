<script>
	import { lightboxStore, MAX_LIGHTBOX_HEIGHT, normalizeLightboxValue } from './lightbox.js';
	import Stepper from './pasito/Stepper.svelte';
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
	// The settle spring's initial velocity, in fractions of the remaining
	// distance per unit of its own duration. 6 is where a critically damped
	// spring starts to overshoot; a page that sailed past its slot and came back
	// would be a bounce the scroller outside does not have. Negative is a release
	// still travelling outward from a rubber band, which does carry on and return.
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
	// `index` a frame late, and the only thing that decides which slides carry a
	// `src`. Mounting the next neighbour's <img> in the same commit that starts
	// the page makes that one frame long, so the settle begins late and the whole
	// slide reads as a stutter — a frame later the track's transform is already
	// on the compositor and no DOM work can stall it. It catches up immediately
	// on a jump of more than one step, where there is no in-between to protect.
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
	// If any image in the group is captioned, the slot is held open for all of
	// them. Letting it collapse changes the chrome's height, which changes the
	// room reserved for the photo — so paging to an uncaptioned image resized
	// the photo you were already looking at.
	const anyCaption = $derived(items.some((i) => i?.alt));

	// --- gesture state --------------------------------------------------------
	// One pointer stream serves mouse, pen and touch. The axis is locked on the
	// first few pixels of movement — sideways pages, downward dismisses — and not
	// re-decided per move, or a diagonal flick would do both.
	/** @type {null | 'x' | 'y' | 'pan'} */
	let axis = $state(null);
	let dragging = $state(false);
	let pinching = $state(false);
	let dragX = $state(0);
	let dragY = $state(0);
	/** A trackpad swipe is moving the track right now, so nothing may transition it. */
	let wheeling = $state(false);
	/**
	 * The one-off `transition` a released gesture hands the track: its own
	 * duration and its own spring, built from how far it still has to go and how
	 * fast it was going. Null between gestures, where the shared `motion` applies
	 * — an arrow key or a tapped dot has no velocity to carry.
	 */
	let trackSettle = $state(null);

	// Zoom is one number. There used to be two (a click-to-zoom flag that swapped
	// the image's width, and a pinch scale), and they could disagree.
	let scale = $state(1);
	let panX = $state(0);
	let panY = $state(0);

	/**
	 * Live pointers, newest last. Deliberately not `$state` — nothing renders
	 * from it, and the values it holds change on every pointermove.
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

	/**
	 * Recent pointer positions, newest last. A release is judged on the whole
	 * `VELOCITY_WINDOW` rather than on the last pointermove: two events 4ms apart
	 * on a 120Hz screen make a single-sample velocity mostly noise, which is what
	 * let an obvious flick fail to page and a careful nudge shoot away.
	 * Deliberately not `$state` — nothing renders from it and it changes on every
	 * move.
	 * @type {Array<{ x: number, y: number, t: number }>}
	 */
	let samples = [];

	function sample(x, y, t) {
		samples.push({ x, y, t });
		if (samples.length > 16) samples.shift();
	}

	/**
	 * px/ms over the window ending at `now`. A finger that has been resting sends
	 * no moves at all, so its samples fall out of the window and it has no
	 * velocity — which is right: a held finger is not a flick, however fast it
	 * arrived.
	 */
	function velocityAt(now) {
		let first = null;
		for (const s of samples) {
			if (now - s.t <= VELOCITY_WINDOW) {
				first = s;
				break;
			}
		}
		const last = samples[samples.length - 1];
		if (!first || !last || first === last) return { x: 0, y: 0 };
		const dt = last.t - first.t;
		if (dt <= 0) return { x: 0, y: 0 };
		return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
	}

	let reduceMotion = $state(false);

	$effect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduceMotion = mq.matches;
		const onChange = () => (reduceMotion = mq.matches);
		mq.addEventListener?.('change', onChange);
		return () => mq.removeEventListener?.('change', onChange);
	});

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
		samples = [];
		slopX = slopY = carryX = 0;
		unbindPointerStream();
		endWheelGesture();
		moved = false;
		resetZoom();
		clearTimeout(settleTimer);
		trackSettle = null;
		flightAnim?.cancel();
		flightAnim = null;
	}

	// --- viewport -------------------------------------------------------------
	// `inset: 0` alone is not a full-screen guarantee: any ancestor that grows a
	// transform, a filter or `contain` becomes the containing block for a fixed
	// child, and on mobile the dynamic toolbar moves the bottom edge underneath
	// it. Both are answered here — the root is portalled to <body> so it has no
	// ancestor left to be trapped by, and its height is `100dvh` floored by the
	// measured `window.innerHeight` rather than left to the initial containing
	// block.
	let winW = $state(typeof window !== 'undefined' ? window.innerWidth : 0);
	let winH = $state(typeof window !== 'undefined' ? window.innerHeight : 0);

	const reserveBottom = $derived(Math.max(bottomH + 16, CHROME_BOTTOM_MIN));
	const availW = $derived(Math.max(80, winW - 32));
	const availH = $derived(
		Math.max(80, Math.min(winH - CHROME_TOP - reserveBottom, MAX_LIGHTBOX_HEIGHT))
	);

	/**
	 * Displayed size, computed the way `object-fit: contain` would but from the
	 * known natural dimensions, so the box has its final size before the src
	 * loads and nothing shifts when it arrives. Never upscales.
	 */
	function fitFor(item) {
		if (!item?.naturalWidth || !item?.naturalHeight || !winW || !winH) return null;
		const s = Math.min(availW / item.naturalWidth, availH / item.naturalHeight, 1);
		return { w: Math.round(item.naturalWidth * s), h: Math.round(item.naturalHeight * s) };
	}

	const currentFit = $derived(fitFor(current));

	/** Layout centre of the image box, in viewport coordinates. */
	const centreX = $derived(winW / 2);
	const centreY = $derived(CHROME_TOP + availH / 2);

	$effect(() => {
		const val = normalizeLightboxValue($lightboxStore);
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
	let savedThemeColor = null;
	let scrollLock = null;
	let inerted = [];

	// While the lightbox is open, darken the browser chrome (mobile address bar)
	// to match the dark blurred backdrop instead of the page's light/dark theme.
	function applyLightboxThemeColor() {
		if (typeof document === 'undefined' || savedThemeColor) return;
		const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
		if (metas.length === 0) {
			// Nothing to override — inject a temporary meta we remove on close.
			const el = document.createElement('meta');
			el.setAttribute('name', 'theme-color');
			el.setAttribute('content', LIGHTBOX_THEME_COLOR);
			document.head.appendChild(el);
			savedThemeColor = [{ el, content: null, media: null, injected: true }];
			return;
		}
		// Drop the media gate and force dark so the override wins in any scheme.
		savedThemeColor = metas.map((el) => ({
			el,
			content: el.getAttribute('content'),
			media: el.getAttribute('media')
		}));
		for (const { el } of savedThemeColor) {
			el.removeAttribute('media');
			el.setAttribute('content', LIGHTBOX_THEME_COLOR);
		}
	}

	function restoreThemeColor() {
		if (!savedThemeColor) return;
		for (const entry of savedThemeColor) {
			if (entry.injected) {
				entry.el.remove();
				continue;
			}
			if (entry.content === null) entry.el.removeAttribute('content');
			else entry.el.setAttribute('content', entry.content);
			if (entry.media === null) entry.el.removeAttribute('media');
			else entry.el.setAttribute('media', entry.media);
		}
		savedThemeColor = null;
	}

	/**
	 * The page behind a modal must not scroll. Compensating for the scrollbar's
	 * width keeps the (blurred, still visible) page from jumping sideways as it
	 * disappears.
	 */
	function lockScroll() {
		if (typeof document === 'undefined' || scrollLock) return;
		const body = document.body;
		const gap = window.innerWidth - document.documentElement.clientWidth;
		scrollLock = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
		body.style.overflow = 'hidden';
		// A scrollbar is a scrollbar, never half the window — anything wider than
		// that is a browser (or a jsdom) that does not lay out at all.
		if (gap > 0 && gap < 40) body.style.paddingRight = `${gap}px`;
	}

	function unlockScroll() {
		if (!scrollLock) return;
		document.body.style.overflow = scrollLock.overflow;
		document.body.style.paddingRight = scrollLock.paddingRight;
		scrollLock = null;
	}

	/**
	 * `aria-modal` is a promise to assistive tech that the rest of the page is
	 * unreachable; `inert` is what actually makes it true. Applied to <body>'s
	 * children rather than a wrapper because the dialog is portalled there.
	 */
	function inertBackground(root) {
		if (typeof document === 'undefined' || !root) return;
		for (const el of Array.from(document.body.children)) {
			if (el === root || el.contains(root)) continue;
			if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') continue;
			inerted.push({ el, inert: el.getAttribute('inert'), hidden: el.getAttribute('aria-hidden') });
			el.setAttribute('inert', '');
			el.setAttribute('aria-hidden', 'true');
		}
	}

	function releaseBackground() {
		for (const { el, inert, hidden } of inerted) {
			if (inert === null) el.removeAttribute('inert');
			else el.setAttribute('inert', inert);
			if (hidden === null) el.removeAttribute('aria-hidden');
			else el.setAttribute('aria-hidden', hidden);
		}
		inerted = [];
	}

	// Capture/restore focus only on the actual open<->close transition. Gating on
	// `wasVisible` stops a re-run (e.g. when `closeBtn` binds) from re-capturing
	// `previouslyFocused` as the close button itself, which would otherwise break
	// focus restoration to the element that opened the lightbox.
	$effect(() => {
		if (visible && !wasVisible) {
			previouslyFocused = document.activeElement;
			applyLightboxThemeColor();
			lockScroll();
			queueMicrotask(() => closeBtn?.focus());
			wasVisible = true;
		} else if (!visible && wasVisible) {
			restoreThemeColor();
			unlockScroll();
			// Release before restoring focus: focus cannot land inside an inert tree.
			releaseBackground();
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
	 * Move the dialog to <body>. Everything about a modal — covering the
	 * viewport, outranking the page's stacking contexts, inerting its siblings —
	 * is only true when nothing is above it in the tree.
	 */
	function portal(node) {
		if (typeof document === 'undefined') return;
		document.body.appendChild(node);
		// Inerting happens here rather than in the open effect because this is the
		// first moment the node is provably a child of <body>: `bind:this` and that
		// effect land in the same flush, and which of them runs first is not ours
		// to decide.
		inertBackground(node);
		// Same reason the inerting lives here: this is the first moment the whole
		// subtree is in the document and can be measured.
		startOpenFlight(node);
		return {
			destroy() {
				releaseBackground();
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
	 * An image collected from the page before it had loaded carries no natural
	 * size, and `fitFor` needs one to reserve the box. Fill it in once from the
	 * element the lightbox itself just loaded.
	 */
	function onImageLoad(e, item) {
		const el = e.currentTarget;
		item.loaded = true;
		if (item.naturalWidth) return;
		item.naturalWidth = el.naturalWidth;
		item.naturalHeight = el.naturalHeight;
	}

	// --- shared-element flight ------------------------------------------------
	// Driven through the Web Animations API rather than a class or an inline
	// transform. WAAPI runs off the main thread, and — unlike an imperative
	// `style.transform` — Svelte rewriting the `style` attribute mid-flight
	// (which it does whenever the fit is recomputed) cannot wipe it out. No
	// `fill: forwards` on the way in, so control returns to the inline transform
	// the moment it lands and pan/zoom still work.
	const IDENTITY = 'translate3d(0px, 0px, 0) scale(1)';
	const flightTransform = (f) => `translate3d(${f.x}px, ${f.y}px, 0) scale(${f.scale})`;

	/**
	 * A spring, written out as a `linear()` easing so WAAPI can still run it on
	 * the compositor — a real spring, not a curve that resembles one.
	 *
	 * Parameterised by bounce rather than by mass, stiffness and damping, which
	 * are three numbers that only mean something tuned together. `bounce` is the
	 * damping ratio read the other way up: 0 settles without ever passing its
	 * mark, 0.25 passes it by about 3%.
	 *
	 * The ease-out this replaces was 80% of the way there a quarter of the way
	 * through and then crawled, which is what made the lightbox feel stiff on the
	 * way in. A spring leaves at rest and accelerates.
	 *
	 * `velocity` is what the spring is already travelling at when it starts, in
	 * fractions of the distance per unit of the animation's own duration. A
	 * settle handed the speed the finger left at is continuous with the gesture;
	 * a fixed curve leaves at the same rate whether the photo was thrown or
	 * nudged, which is the whole of why paging felt detached from the swipe.
	 * Zero is a spring released from rest, which is every flight.
	 */
	function springEasing(bounce, velocity = 0, steps = 32) {
		const zeta = Math.min(1, Math.max(0.05, 1 - bounce));
		const omega = 2 * Math.PI;
		const omegaD = omega * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
		const points = [];
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			const v =
				zeta < 1
					? 1 -
						Math.exp(-zeta * omega * t) *
							(Math.cos(omegaD * t) + ((zeta * omega - velocity) / omegaD) * Math.sin(omegaD * t))
					: 1 + (-1 + (velocity - omega) * t) * Math.exp(-omega * t);
			points.push(Math.round(v * 1e4) / 1e4);
		}
		points[points.length - 1] = 1;
		return `linear(${points.join(',')})`;
	}

	// Opening overshoots a little — it is arriving. Coming home does not: past
	// the mark would mean past the slot the photo belongs in.
	const SPRING_IN = springEasing(0.25);
	const SPRING_HOME = springEasing(0);

	let linearEasing;
	function springOr(fallback, spring) {
		linearEasing ??= !!globalThis.CSS?.supports?.('animation-timing-function', 'linear(0, 1)');
		return linearEasing ? spring : fallback;
	}

	let flightAnim = null;
	let hiddenOrigin = null;

	function prefersReducedMotion() {
		return !!(
			typeof window !== 'undefined' &&
			window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
		);
	}

	/** The element on the page the current image came from, if it is still there. */
	function originEl() {
		const el = current?.el;
		return el && el.isConnected ? el : null;
	}

	/**
	 * `visibility`, not `display`: the element has to keep its box, both because
	 * the flight measures it and because collapsing it would reflow the article
	 * underneath the lightbox.
	 */
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
	 * Bring the element the lightbox is about to fly back to into view inside its
	 * own scroller, so closing on the fourth image of a strip lands on the fourth
	 * image rather than off the side of it. Horizontal scrollers only, and never
	 * the page — that one is locked while the lightbox is open.
	 */
	function alignOrigin(el) {
		for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
			if (node.scrollWidth - node.clientWidth < 2) continue;
			const overflowX = getComputedStyle(node).overflowX;
			if (overflowX !== 'auto' && overflowX !== 'scroll') continue;
			// This scroll has to land before the flight is measured a line later. A
			// scroller with `scroll-behavior: smooth` would animate instead, and the
			// flight would be measured against a position it has not reached yet.
			const behaviour = node.style.scrollBehavior;
			node.style.scrollBehavior = 'auto';
			const r = el.getBoundingClientRect();
			const cr = node.getBoundingClientRect();
			node.scrollLeft += r.left + r.width / 2 - (cr.left + cr.width / 2);
			node.style.scrollBehavior = behaviour;
		}
	}

	/**
	 * The transform that moves an element from the box it lays out in to some
	 * other box on screen.
	 *
	 * One uniform scale, not a separate scaleX and scaleY: both ends are
	 * `object-fit: contain` around the same file, so their aspect ratios agree
	 * and a second axis could only ever distort the photo in flight.
	 */
	function deltaBetween(base, target) {
		if (!base || !target) return null;
		if (base.width < 1 || base.height < 1 || target.width < 1 || target.height < 1) return null;
		return {
			scale: target.width / base.width,
			x: target.left + target.width / 2 - (base.left + base.width / 2),
			y: target.top + target.height / 2 - (base.top + base.height / 2)
		};
	}

	function flightBetween(fromEl, toEl) {
		if (!fromEl || !toEl || typeof toEl.animate !== 'function') return null;
		return deltaBetween(toEl.getBoundingClientRect(), fromEl.getBoundingClientRect());
	}

	/**
	 * A dismiss drag moves the strip, not the photo. Unwind it and hand the
	 * distance it had travelled to the photo's own first keyframe instead, so
	 * one animation carries the whole journey home rather than two transforms
	 * fighting over the same pixels.
	 */
	function unwindStrip() {
		const strip = rootEl?.querySelector('.lb-strip');
		if (!strip) return;
		strip.style.transition = 'none';
		strip.style.transform = 'none';
	}

	/** Called from the portal action — the first moment the subtree is laid out. */
	/**
	 * Track the running flight, and never let a stale handler clear its successor
	 * — `oncancel` is dispatched asynchronously, so it can land after the
	 * animation that replaced it has already been stored.
	 *
	 * `fill` is the whole difference between the two directions. On the way in,
	 * `backwards` puts the photo at its origin for the first paint and then hands
	 * the transform back, so pan and zoom work the moment it lands. On the way
	 * out, `forwards` holds it at the origin for the frame between the animation
	 * ending and the lightbox unmounting — without it the photo snaps back to
	 * full size for that frame.
	 */
	function runFlight(el, keyframes, duration, fill, easing, onfinish) {
		const anim = el.animate(keyframes, { duration, easing, fill });
		flightAnim = anim;
		anim.oncancel = () => {
			if (flightAnim === anim) flightAnim = null;
		};
		anim.onfinish = () => {
			if (flightAnim === anim) flightAnim = null;
			onfinish?.();
		};
		return anim;
	}

	function startOpenFlight(root) {
		const from = originEl();
		if (from) hideOrigin(from);
		// Without a known natural size the image has no settled box yet, and
		// `onload` would resize it out from under the animation.
		if (prefersReducedMotion() || !currentFit) return;
		const to = root.querySelector('.lb-img[data-current="true"]');
		const f = flightBetween(from, to);
		if (!f) return;
		flew = true;
		flightAnim?.cancel();
		runFlight(
			to,
			[{ transform: flightTransform(f) }, { transform: IDENTITY }],
			FLIGHT_IN_MS,
			'backwards',
			springOr(FLIGHT_EASE, SPRING_IN)
		);
	}

	/**
	 * A close that lands while the track is still settling from a page would
	 * measure the image mid-slide — and the track would go on moving underneath
	 * the flight. Dropping the transition snaps the track to the resting
	 * transform it is already on its way to, which is the one the flight assumes.
	 */
	function freezeTrack() {
		const track = rootEl?.querySelector('.lb-track');
		if (!track) return;
		track.style.transition = 'none';
	}

	/** Has the element been scrolled or laid out clean off the screen? */
	function offScreen(el) {
		const r = el.getBoundingClientRect();
		return r.bottom <= 0 || r.top >= winH || r.right <= 0 || r.left >= winW;
	}

	/**
	 * Fly the photo home. Returns false when there is nowhere to fly to — no
	 * origin element, no layout, reduced motion, or a zoomed image, whose
	 * on-screen box is no longer the one the flight maths assumes.
	 */
	/**
	 * Fly the photo home from wherever it currently is on screen — which is not
	 * its layout box if the opening flight is still running, or if a dismiss drag
	 * has carried it away from the middle.
	 *
	 * Every check that can refuse the flight runs before anything is unwound, so
	 * a refusal leaves the photo exactly where the fallback expects to find it.
	 */
	function startCloseFlight({ carried = false, duration = FLIGHT_OUT_MS } = {}) {
		if (prefersReducedMotion() || scale > 1) return false;
		const to = originEl();
		const img = currentImgEl();
		if (!to || !img || typeof img.animate !== 'function') return false;
		alignOrigin(to);
		// Aligned and still off-screen: there is nowhere on screen to fly to, and
		// a flight there would just be the photo leaving in a strange direction.
		if (offScreen(to)) return false;

		// Measured before anything is undone: this is the box the eye is on.
		const cur = img.getBoundingClientRect();
		if (cur.width < 1) return false;

		// Every write first, then every read. Interleaving them forces a fresh
		// layout per read, and this all happens inside the one frame a finger is
		// lifted — the frame the eye is most likely to catch.
		flightAnim?.cancel();
		if (carried) {
			unwindStrip();
			dragX = 0;
			dragY = 0;
		}
		freezeTrack();

		// ...and now the photo's own layout box, with every transform off it.
		const base = img.getBoundingClientRect();
		const from = deltaBetween(base, cur);
		const home = deltaBetween(base, to.getBoundingClientRect());
		if (!from || !home) return false;

		flyingHome = true;
		runFlight(
			img,
			[{ transform: flightTransform(from) }, { transform: flightTransform(home) }],
			duration,
			'forwards',
			springOr(FLIGHT_EASE, SPRING_HOME),
			() => {
				// Hand the page its photo back the instant the flying one lands on
				// it, not after Svelte has torn the dialog down. The two overlap
				// exactly, so the swap is invisible — where waiting left the photo
				// sitting above the article for the frames in between.
				showOrigin();
				lightboxStore.set(null);
			}
		);
		// A cancelled or dropped animation must not strand the lightbox open.
		scheduleClose(duration + 120);
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
	/** iOS's rubber band: resistance that grows with distance, never past `dim * RUBBER`. */
	function rubber(delta, dim) {
		const sign = Math.sign(delta);
		const a = Math.abs(delta);
		return (sign * (a * dim * RUBBER)) / (dim + RUBBER * a) || 0;
	}

	function clampPan() {
		const f = currentFit;
		if (!f) return;
		const maxX = Math.max(0, (f.w * scale - availW) / 2);
		const maxY = Math.max(0, (f.h * scale - availH) / 2);
		panX = Math.max(-maxX, Math.min(maxX, panX));
		panY = Math.max(-maxY, Math.min(maxY, panY));
	}

	/** Re-anchor the pan so the point under the fingers/cursor stays put. */
	function scaleAbout(nextScale, x, y, baseScale, basePanX, basePanY) {
		const r = nextScale / baseScale;
		panX = (1 - r) * (x - centreX) + r * basePanX;
		panY = (1 - r) * (y - centreY) + r * basePanY;
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
		samples = [{ x, y, t }];
		slopX = slopY = carryX = 0;
		panStartX = panX;
		panStartY = panY;
		dragging = true;
		axis = scale > 1 ? 'pan' : null;
	}

	/**
	 * The move/up pair lives on the window, not the element: a drag that leaves
	 * the viewport (or the browser) still has to end, and a `pointerup` the
	 * lightbox never hears would leave it stuck mid-gesture. Bound imperatively
	 * rather than through `svelte:window` so the listener exists before the
	 * first move, not after the next effect flush.
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

		sample(e.clientX, e.clientY, e.timeStamp);

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
			// Take the lock threshold back out, and — for a swipe — take the track
			// over wherever it happens to be. Both are measured now rather than at
			// pointerdown: until this moment the settle was still running and the
			// finger had not committed to anything.
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
	 * Where the track actually is, as an offset from the slot it is resting in or
	 * settling towards. A gesture that starts mid-settle picks up from there, so
	 * grabbing a page still in flight stops it under the finger instead of
	 * teleporting it to where it had been heading — the scroller in the article
	 * has been interruptible all along, and this is what the lightbox was missing.
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
	 * Give the track a transition of its own for this one settle, sprung from the
	 * speed the gesture ended at.
	 *
	 * Called before `goTo`, so `index` and `dragX` still describe where the photo
	 * is rather than where it is going.
	 */
	function armTrackSettle(target, velocity) {
		clearTimeout(settleTimer);
		trackSettle = null;
		if (reduceMotion) return;
		const page = winW || 1;
		const remaining = (index - target) * page - dragX;
		const distance = Math.abs(remaining);
		if (distance < 1) return;
		// A short journey takes less time than a whole page. Not proportional —
		// the square root keeps a small correction from being over before it can
		// be seen.
		const duration = Math.round(
			Math.max(SETTLE_MIN_MS, Math.min(SETTLE_MS, SETTLE_MS * Math.sqrt(distance / page)))
		);
		// Positive is already travelling towards the slot; negative is a release
		// still heading out of a rubber band, which carries on and comes back.
		const along = (velocity * Math.sign(remaining) * duration) / distance;
		const v0 = Math.max(SETTLE_V0_MIN, Math.min(SETTLE_V0_MAX, along));
		trackSettle = `transform ${duration}ms ${springOr(SETTLE_EASE, springEasing(0, v0))}`;
		// Back to the shared curve once it has landed, so the next arrow key does
		// not inherit this swipe's velocity. Changing the declaration alone moves
		// nothing.
		settleTimer = setTimeout(() => (trackSettle = null), duration + 60);
	}

	/** Which slide a released horizontal gesture belongs on. */
	function pageTarget(travelled, velocity) {
		const flick = Math.abs(velocity) > PAGE_VELOCITY && Math.abs(travelled) > AXIS_LOCK;
		const far = Math.abs(travelled) > (winW || 1) * PAGE_RATIO;
		const next = flick || far ? index + (travelled < 0 ? 1 : -1) : index;
		return Math.max(0, Math.min(count - 1, next));
	}

	function settleX(now) {
		const velocity = velocityAt(now).x;
		// Measured from where the drag took the track over, not from the resting
		// slot: a swipe that interrupted a settle starts with the whole of that
		// settle's remaining distance already on `dragX`, and counting it as
		// movement would page on a finger that never went anywhere.
		const target = pageTarget(dragX - carryX, velocity);
		armTrackSettle(target, velocity);
		goTo(target);
	}

	function settleY(now) {
		const velY = velocityAt(now).y;
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
			samples = [];
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
	 * The momentum a trackpad sends after the fingers lift has already decayed to
	 * nothing by the time the events stop, so where it came to rest is the whole
	 * of what it meant — there is no flick left to read off it.
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
	/** Everything inside the dialog a Tab can legitimately land on. */
	function focusables() {
		if (!rootEl) return [];
		return Array.from(
			rootEl.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]')
		);
	}

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
			const list = focusables();
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
		unbindPointerStream();
		flightAnim?.cancel();
		restoreThemeColor();
		unlockScroll();
		releaseBackground();
		showOrigin();
		previouslyFocused = null;
	});

	// --- derived presentation -------------------------------------------------
	const dismissProgress = $derived(Math.min(1, Math.abs(dragY) / ((winH || 1) * 0.5)));
	const settling = $derived(!dragging && !pinching && !reduceMotion);
	const motion = $derived(reduceMotion ? 'none' : `transform ${SETTLE_MS}ms ${SETTLE_EASE}`);

	// The track holds every slide at 100% of the viewport and overflows to the
	// right, so its own width stays one page — which is what makes a percentage
	// translate a whole page rather than a fraction of the whole strip.
	// Split into one binding per property. A single `style` string is re-parsed
	// in full on every frame of a drag, transition declaration and all; `style:`
	// directives only touch the declaration that actually changed.
	const trackTransform = $derived(`translate3d(calc(${-index * 100}% + ${dragX}px), 0, 0)`);
	// A gesture in hand transitions nothing — the track is following a finger. A
	// released one gets the spring `armTrackSettle` built for it; everything else
	// (an arrow key, a tapped dot) gets the shared curve.
	const trackTransition = $derived(
		wheeling || (dragging && axis === 'x') ? 'none' : (trackSettle ?? motion)
	);

	const stageTransform = $derived(
		`translate3d(0, ${dragY}px, 0) scale(${dismissing ? 0.9 : 1 - dismissProgress * 0.12})`
	);
	const stageTransition = $derived(settling ? motion : 'none');

	const imageTransform = $derived(`translate3d(${panX}px, ${panY}px, 0) scale(${scale})`);
	const imageTransition = $derived(
		`opacity 240ms var(--ease-out), box-shadow 200ms var(--ease-out), border-radius 200ms var(--ease-out)${
			dragging || pinching || reduceMotion ? '' : `, transform ${ZOOM_MS}ms ${SETTLE_EASE}`
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
							{@const f = fitFor(item)}
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
		<p class="lb-live" aria-live="polite">{position}</p>
	</div>
{/if}

<style>
	.lb-root {
		/* The built-in easings are too weak to read as intentional. These are the
		   two the whole component uses: a strong ease-out for anything entering,
		   leaving or responding to a press, and the drawer curve for anything a
		   finger is settling. Nothing here uses ease-in — it withholds movement at
		   the exact moment the eye is on it, which reads as lag. */
		--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
		--ease-entrance: cubic-bezier(0.16, 1, 0.3, 1);

		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		/* Not `inset: 0`: on mobile the bottom edge of the initial containing
		   block sits under the collapsing toolbar. `100dvh` tracks it, and the
		   measured innerHeight is the floor for browsers without `dvh`. */
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

	/* 8px rather than the 14px-plus-saturate this started at. A full-screen
	   backdrop filter is the single most expensive thing here — over a dismiss
	   drag at 6x CPU throttle it costs 8 missed frames against 0 with no blur at
	   all, and 8px halves that to 4. Side by side at the opacity the scrim
	   actually reaches, the two are indistinguishable.

	   The `-webkit-` prefix goes FIRST. Written the other way round the
	   minifier collapses the pair down to the prefixed declaration alone, and
	   Chrome and Firefox — which have never supported `-webkit-backdrop-filter`
	   — then render no blur at all. That had been shipping. */
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
		/* `backwards`, not `both`. A filling animation keeps applying its last
		   keyframe, and animations outrank inline styles in the cascade — so
		   `both` pinned this to opacity 1 forever and the drag-to-dismiss fade,
		   which is set inline, never showed at all. */
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
		/* The same spring the flight uses, so the fallback entrance — a store
		   value set by hand, an image with no size yet — is not a stiffer
		   animation than the one it stands in for. */
		animation: lb-in 0.36s var(--lb-spring, var(--ease-entrance)) both;
	}

	/* When the photo flies from the place it holds in the article, it *is* the
	   entrance — a stage scaling underneath it would be a second, contrary one.
	   Held for the whole open, not just the flight, so releasing it could never
	   replay `lb-in` half way through. */
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

	/* Only the photo on screen ever transforms under its own power — the others
	   ride along inside the track's layer, and promoting them would cost three
	   full-screen textures to animate one.

	   And only while it actually is: paging moves `data-current` from one image
	   to the next, so a hint that hung on that attribute alone tore a layer down
	   and built another in the very commit that starts the settle, which is the
	   one frame the page cannot afford to drop. The track is promoted either way,
	   so the slides are composited through it; this is for pinch and pan, which
	   are the only times an image moves inside the track. The flights need no
	   hint — a WAAPI transform is composited on its own. */
	.lb-root.zoomed .lb-img[data-current='true'] {
		will-change: transform;
	}

	/* A photo that has landed back in the article but still carries a lifted
	   photo's shadow and corners reads as sitting on top of the page rather than
	   in it. Both are shed on the way home, so what lands is the same shape as
	   what the page is about to show. */
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

	/* An image whose size wasn't known up front has nothing to hold its box, so
	   it would pop in at full opacity the instant it decodes. A spinner would be
	   one more thing on screen; a fade is the same information, quieter. */
	.lb-img.pending {
		opacity: 0;
	}

	.lb-chrome {
		position: absolute;
		inset: 0;
		pointer-events: none;
		transition: opacity 0.2s var(--ease-out);
		/* A beat behind the photo, so the controls arrive around what has landed
		   rather than over something still moving. `backwards` again — the inline
		   opacity has to keep working once this is done. */
		animation: lb-fade-in 0.3s var(--ease-out) 0.07s backwards;
	}

	/* A photo can be white to its edges, and then the close button, the caption
	   and the dots are sitting on it. Two long, shallow scrims: invisible against
	   the backdrop, just enough under a bright image. */
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

	/* Zoomed in, the image fills the frame and everything but the way out is in
	   the way — a caption and a row of dots over a photo blown up to inspect are
	   noise, and no scrim makes them readable against every image anyway. */
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
		/* Exactly the two lines it is clamped to, always — held open even for an
		   image with no caption, as long as something in the group has one. The
		   chrome's height is what reserves room for the photo, so a caption that
		   wrapped where its neighbour did not was resizing the photo you were
		   looking at, in the middle of the slide that swapped them. */
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

	.lb-live {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}

	/* Reduced motion means fewer and gentler animations, not none. The fades stay
	   — they are what stops the lightbox from blinking in and out of existence —
	   and it is the movement that goes: the stage stops scaling, and the track's
	   transform transition is already dropped in the script. */
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

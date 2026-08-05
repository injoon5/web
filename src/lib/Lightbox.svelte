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
	// as an interaction and not as a modal: 340ms with the drawer curve reads as
	// physical without ever feeling like a wait.
	const SETTLE_MS = 340;
	const ZOOM_MS = 280;
	// The curve every settle uses: fast out of the finger, long soft landing.
	// (Ionic's drawer curve — the same one Vaul uses.)
	const SETTLE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
	const CHROME_TOP = 72; // room the close button's row needs
	const CHROME_BOTTOM_MIN = 56;
	const LIGHTBOX_THEME_COLOR = '#0a0a0a';

	let visible = $state(false);
	// The group the lightbox was opened on. A single image is a group of one, so
	// there is only one code path through sizing, swiping and dismissal.
	let items = $state([]);
	let index = $state(0);
	let closing = $state(false);
	let dismissing = $state(false);

	let rootEl = $state(null);
	let viewportEl = $state(null);
	let closeBtn = $state(null);
	/** Measured, so the image box reserves exactly the room the chrome uses. */
	let bottomH = $state(0);

	const count = $derived(items.length);
	const grouped = $derived(count > 1);
	const current = $derived(items[index] ?? null);
	const alt = $derived(current?.alt ?? '');

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
	let lastX = 0;
	let lastY = 0;
	let lastT = 0;
	let velX = 0;
	let velY = 0;
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
	let wheelPage = 0;
	let wheelTimer;

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
		unbindPointerStream();
		moved = false;
		resetZoom();
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
		if (val) {
			items = val.items;
			index = val.index;
			resetGesture();
			closing = false;
			dismissing = false;
			visible = true;
		} else {
			visible = false;
			closing = false;
			dismissing = false;
		}
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
		return {
			destroy() {
				releaseBackground();
				node.remove();
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
		startX = lastX = x;
		startY = lastY = y;
		lastT = t;
		velX = velY = 0;
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

		const dt = Math.max(1, e.timeStamp - lastT);
		velX = (e.clientX - lastX) / dt;
		velY = (e.clientY - lastY) / dt;
		lastX = e.clientX;
		lastY = e.clientY;
		lastT = e.timeStamp;

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
		}

		if (axis === 'x') {
			// Rubber-band at the ends so the group's edges are felt, not hit.
			const atEnd = (dx > 0 && index === 0) || (dx < 0 && index === count - 1);
			dragX = atEnd ? rubber(dx, winW || 1) : dx;
		} else {
			dragY = dy;
		}
	}

	function settleX() {
		const flick = Math.abs(velX) > PAGE_VELOCITY && Math.abs(dragX) > AXIS_LOCK;
		const far = Math.abs(dragX) > (winW || 1) * PAGE_RATIO;
		goTo(flick || far ? index + (dragX < 0 ? 1 : -1) : index);
	}

	function settleY() {
		const far = Math.abs(dragY) > DISMISS_DISTANCE;
		const flick = Math.abs(velY) > DISMISS_VELOCITY && Math.abs(dragY) > 24;
		axis = null;
		if (far || flick) {
			dismissing = true;
			dragY = Math.sign(dragY || 1) * (winH || 800);
			scheduleClose(SETTLE_MS);
		} else {
			dragY = 0;
		}
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
		if (axis === 'x') settleX();
		else if (axis === 'y') settleY();
		axis = null;
	}

	function onPointerCancel(e) {
		dropPointer(e.pointerId);
		if (pointers.length === 0) {
			unbindPointerStream();
			dragging = false;
			pinching = false;
			axis = null;
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
		wheelPage += e.deltaX;
		clearTimeout(wheelTimer);
		wheelTimer = setTimeout(() => (wheelPage = 0), 240);
		if (Math.abs(wheelPage) < 80) return;
		goTo(index + (wheelPage > 0 ? 1 : -1));
		wheelPage = 0;
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
		unbindPointerStream();
		restoreThemeColor();
		unlockScroll();
		releaseBackground();
		previouslyFocused = null;
	});

	// --- derived presentation -------------------------------------------------
	const dismissProgress = $derived(Math.min(1, Math.abs(dragY) / ((winH || 1) * 0.5)));
	const settling = $derived(!dragging && !pinching && !reduceMotion);
	const motion = $derived(reduceMotion ? 'none' : `transform ${SETTLE_MS}ms ${SETTLE_EASE}`);

	// The track holds every slide at 100% of the viewport and overflows to the
	// right, so its own width stays one page — which is what makes a percentage
	// translate a whole page rather than a fraction of the whole strip.
	const trackStyle = $derived(
		`transform: translate3d(calc(${-index * 100}% + ${dragX}px), 0, 0);` +
			`transition: ${dragging && axis === 'x' ? 'none' : motion};`
	);

	const stageStyle = $derived(
		`transform: translate3d(0, ${dragY}px, 0) scale(${
			dismissing ? 0.9 : 1 - dismissProgress * 0.12
		});` + `transition: ${settling ? motion : 'none'};`
	);

	const imageStyle = $derived(
		`transform: translate3d(${panX}px, ${panY}px, 0) scale(${scale});` +
			`transition: opacity 240ms var(--ease-out)${
				dragging || pinching || reduceMotion ? '' : `, transform ${ZOOM_MS}ms ${SETTLE_EASE}`
			};`
	);

	const backdropOpacity = $derived(closing || dismissing ? 0 : 1 - dismissProgress * 0.8);
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
		class:dragging
		style="--lb-vh: {winH}px; --lb-pad-top: {CHROME_TOP}px; --lb-pad-bottom: {reserveBottom}px; --lb-max-height: {MAX_LIGHTBOX_HEIGHT}px"
		role="dialog"
		aria-modal="true"
		aria-label={dialogLabel}
		tabindex="-1"
	>
		<div class="lb-backdrop" style="opacity: {backdropOpacity}"></div>

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
				<div class="lb-strip" style={stageStyle}>
					<div class="lb-track" style={trackStyle}>
						{#each items as item, i (item.src + i)}
							{@const near = Math.abs(i - index) <= 1}
							{@const f = fitFor(item)}
							<div class="lb-slide" aria-hidden={i === index ? undefined : 'true'}>
								{#if near}
									<img
										src={item.src}
										alt={item.alt ?? ''}
										class="lb-img"
										class:pending={!item.loaded && !item.naturalWidth}
										data-current={i === index ? 'true' : 'false'}
										style="{f ? `width: ${f.w}px; height: ${f.h}px;` : ''}{i === index
											? imageStyle
											: ''}"
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
				{#if alt}
					<div class="lb-caption-slot">
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

	.lb-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.86);
		backdrop-filter: blur(14px) saturate(1.1);
		-webkit-backdrop-filter: blur(14px) saturate(1.1);
		transition: opacity 0.28s var(--ease-out);
		/* `backwards`, not `both`. A filling animation keeps applying its last
		   keyframe, and animations outrank inline styles in the cascade — so
		   `both` pinned this to opacity 1 forever and the drag-to-dismiss fade,
		   which is set inline, never showed at all. */
		animation: lb-fade-in 0.28s var(--ease-entrance) backwards;
		will-change: opacity;
	}

	.lb-root.dragging .lb-backdrop {
		transition: none;
	}

	/* Out faster than in, and faster than the photo it sits behind — a scrim that
	   outlives the image reads as the lightbox hanging. */
	.lb-root.closing .lb-backdrop,
	.lb-root.dismissing .lb-backdrop {
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
		animation: lb-in 0.36s var(--ease-entrance) both;
	}

	.lb-root.closing .lb-stage {
		animation: lb-out 0.22s var(--ease-out) forwards;
	}

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
		will-change: transform;
		transition: opacity 0.24s var(--ease-out);
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
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
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
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
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

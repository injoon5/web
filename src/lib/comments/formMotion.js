import { cubicOut } from 'svelte/easing';

/** Matches `--motion-base` / enter window (~180–220ms). */
const IN_MS = 200;
/** Faster, softer exit (~140–160ms). */
const OUT_MS = 150;
/** Fade-only duration when prefers-reduced-motion. */
const FADE_MS = 120;

const DEFAULT_Y = 8;
const DEFAULT_SCALE = 0.98;
const DEFAULT_BLUR = 2;

/** Subtler body ↔ edit / reply-button swap. */
const BODY_Y = 6;
const BODY_SCALE = 0.99;
const BODY_BLUR = 1.5;

function prefersReducedMotion() {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return false;
	}
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** jsdom / older environments lack WAAPI (`element.animate`). */
function canRunCssTransition() {
	return typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
}

/**
 * Soft fly + opacity + scale-from-~0.98 + light blur.
 * Enter is longer; exit is shorter. Reduced motion → opacity only.
 *
 * @param {Element} _node
 * @param {{
 *   direction?: 'in' | 'out';
 *   skip?: boolean;
 *   y?: number;
 *   scale?: number;
 *   blur?: number;
 *   inDuration?: number;
 *   outDuration?: number;
 *   reducedDuration?: number;
 * }} [params]
 */
function formMotion(
	_node,
	{
		direction = 'in',
		skip = false,
		y = DEFAULT_Y,
		scale = DEFAULT_SCALE,
		blur = DEFAULT_BLUR,
		inDuration = IN_MS,
		outDuration = OUT_MS,
		reducedDuration = FADE_MS
	} = {}
) {
	if (skip || !canRunCssTransition()) return { duration: 0 };

	const isOut = direction === 'out';
	const reduce = prefersReducedMotion();
	const duration = reduce ? reducedDuration : isOut ? outDuration : inDuration;

	if (reduce) {
		return {
			duration,
			easing: cubicOut,
			css: (t) => `opacity: ${t}`
		};
	}

	return {
		duration,
		easing: cubicOut,
		css: (t, u) => {
			const s = scale + (1 - scale) * t;
			return `opacity: ${t}; transform: translateY(${u * y}px) scale(${s}); filter: blur(${u * blur}px)`;
		}
	};
}

/** Enter for edit / reply / delete panels. */
export function formIn(node, params = {}) {
	return formMotion(node, { ...params, direction: 'in' });
}

/** Exit for edit / reply / delete panels (faster, softer). */
export function formOut(node, params = {}) {
	return formMotion(node, { ...params, direction: 'out' });
}

/**
 * Bidirectional panel transition (interruptible open/cancel).
 * Uses enter timing when direction is `both`/`in`.
 *
 * @param {Element} node
 * @param {object} [params]
 * @param {{ direction?: 'in' | 'out' | 'both' }} [options]
 */
export function formPanel(node, params = {}, options = {}) {
	const direction = options.direction === 'out' ? 'out' : 'in';
	return formMotion(node, { ...params, direction });
}

/**
 * Subtle crossfade for comment body ↔ edit form (and reply button).
 * Pass `{ skip: true }` to avoid animating on first paint.
 *
 * @param {Element} node
 * @param {object} [params]
 * @param {{ direction?: 'in' | 'out' | 'both' }} [options]
 */
export function bodySwap(node, params = {}, options = {}) {
	const direction = options.direction === 'out' ? 'out' : 'in';
	return formMotion(node, {
		y: BODY_Y,
		scale: BODY_SCALE,
		blur: BODY_BLUR,
		inDuration: 180,
		outDuration: 140,
		...params,
		direction
	});
}

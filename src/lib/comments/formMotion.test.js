import { describe, it, expect, vi, afterEach } from 'vitest';
import { formIn, formOut, formPanel, bodySwap } from './formMotion.js';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('formMotion', () => {
	it('returns zero duration when skip is set', () => {
		expect(formIn(null, { skip: true }).duration).toBe(0);
		expect(formPanel(null, { skip: true }, { direction: 'in' }).duration).toBe(0);
	});

	it('uses faster exit than enter', () => {
		vi.stubGlobal('Element', { prototype: { animate: () => {} } });
		vi.stubGlobal('window', {
			matchMedia: () => ({ matches: false })
		});

		const enter = formIn(null);
		const exit = formOut(null);
		expect(enter.duration).toBeGreaterThan(exit.duration);
		expect(enter.duration).toBeLessThanOrEqual(300);
		expect(exit.duration).toBeLessThanOrEqual(200);
	});

	it('falls back to opacity-only when reduced motion is preferred', () => {
		vi.stubGlobal('Element', { prototype: { animate: () => {} } });
		vi.stubGlobal('window', {
			matchMedia: () => ({ matches: true })
		});

		const cfg = formIn(null);
		expect(cfg.css(0.5)).toBe('opacity: 0.5');
		expect(cfg.css(0.5)).not.toContain('transform');
	});

	it('starts scale near 1 (never from 0)', () => {
		vi.stubGlobal('Element', { prototype: { animate: () => {} } });
		vi.stubGlobal('window', {
			matchMedia: () => ({ matches: false })
		});

		const css = formIn(null).css(0, 1);
		const scaleMatch = css.match(/scale\(([\d.]+)\)/);
		expect(scaleMatch).not.toBeNull();
		expect(Number(scaleMatch[1])).toBeGreaterThanOrEqual(0.95);
	});

	it('bodySwap is subtler than panel enter', () => {
		vi.stubGlobal('Element', { prototype: { animate: () => {} } });
		vi.stubGlobal('window', {
			matchMedia: () => ({ matches: false })
		});

		const panel = formPanel(null, {}, { direction: 'in' });
		const body = bodySwap(null, {}, { direction: 'in' });
		expect(body.duration).toBeLessThanOrEqual(panel.duration);
	});
});

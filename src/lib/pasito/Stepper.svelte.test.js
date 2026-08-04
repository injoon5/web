import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Stepper from './Stepper.svelte';

afterEach(() => vi.useRealTimers());

const stepsIn = (container) => Array.from(container.querySelectorAll('.pasito-step'));

describe('Stepper rendering', () => {
	it('renders one step per count and marks the active one', () => {
		const { container } = render(Stepper, { count: 4, active: 2 });
		const steps = stepsIn(container);
		expect(steps).toHaveLength(4);
		expect(steps[2]).toHaveClass('pasito-step-active');
		expect(steps.filter((s) => s.classList.contains('pasito-step-active'))).toHaveLength(1);
	});

	it('describes itself as a tablist of tabs by default, like upstream', () => {
		render(Stepper, { count: 3, active: 0 });
		expect(screen.getByRole('tablist', { name: 'Progress steps' })).toBeInTheDocument();
		const tabs = screen.getAllByRole('tab');
		expect(tabs).toHaveLength(3);
		expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
		expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
		expect(tabs[0]).toHaveAttribute('aria-label', 'Step 1');
	});

	it('takes the active step out of aria-selected when it is not a tab', () => {
		render(Stepper, {
			count: 2,
			active: 1,
			containerRole: 'group',
			stepRole: 'button',
			stepLabel: (i, total) => `Go to image ${i + 1} of ${total}`,
			onStepClick: () => {}
		});
		const buttons = screen.getAllByRole('button');
		expect(buttons[1]).toHaveAttribute('aria-current', 'true');
		expect(buttons[1]).not.toHaveAttribute('aria-selected');
		expect(buttons[0]).toHaveAttribute('aria-label', 'Go to image 1 of 2');
	});

	it('keeps only the active step in the tab order', () => {
		const { container } = render(Stepper, { count: 3, active: 1 });
		expect(stepsIn(container).map((s) => s.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
	});

	it('disables the steps when there is nothing to click', () => {
		const { container } = render(Stepper, { count: 3, active: 0 });
		expect(stepsIn(container).every((s) => s.disabled)).toBe(true);
	});

	it('reports the clicked index', async () => {
		const onStepClick = vi.fn();
		const { container } = render(Stepper, { count: 3, active: 0, onStepClick });
		stepsIn(container)[2].click();
		await tick();
		expect(onStepClick).toHaveBeenCalledWith(2);
	});
});

describe('Stepper theming and windowing', () => {
	it('passes duration and easing through as custom properties', () => {
		const { container } = render(Stepper, {
			count: 3,
			active: 0,
			transitionDuration: 200,
			easing: 'linear'
		});
		const el = container.querySelector('.pasito-container');
		expect(el.style.getPropertyValue('--pill-duration')).toBe('200ms');
		expect(el.style.getPropertyValue('--pill-easing')).toBe('linear');
	});

	it('sets no easing property when none is given, so the CSS default stands', () => {
		const { container } = render(Stepper, { count: 3, active: 0 });
		expect(
			container.querySelector('.pasito-container').style.getPropertyValue('--pill-easing')
		).toBe('');
	});

	it('only times the fill on the active step', () => {
		const { container } = render(Stepper, {
			count: 3,
			active: 1,
			filling: true,
			fillDuration: 2500
		});
		const steps = stepsIn(container);
		expect(steps[1]).toHaveClass('pasito-step-filling');
		expect(steps[1].style.getPropertyValue('--pill-fill-duration')).toBe('2500ms');
		expect(steps[0]).not.toHaveClass('pasito-step-filling');
		expect(steps[0].style.getPropertyValue('--pill-fill-duration')).toBe('');
	});

	it('leaves the track alone while everything fits', () => {
		const { container } = render(Stepper, { count: 4, active: 0, maxVisible: 5 });
		expect(container.querySelector('.pasito-track').style.transform).toBe('none');
		expect(container.querySelector('.pasito-container').style.width).toBe('');
	});

	it('slides the track and pins the container width once it does not', () => {
		const { container } = render(Stepper, { count: 20, active: 10, maxVisible: 5 });
		expect(container.querySelector('.pasito-track').style.transform).toBe('translateX(-112px)');
		// 4 dots + 1 pill + 4 gaps = 4*8 + 24 + 4*6
		expect(container.querySelector('.pasito-container').style.width).toBe('80px');
	});
});

describe('Stepper count changes', () => {
	it('renders an added step collapsed, then expands it', async () => {
		const { container, rerender } = render(Stepper, { count: 2, active: 0 });
		await rerender({ count: 3, active: 0 });

		const steps = stepsIn(container);
		expect(steps).toHaveLength(3);
		// It has to paint at width 0 first, or there is nothing to transition from.
		expect(steps[2]).toHaveClass('pasito-entering');

		await waitFor(() => expect(steps[2]).not.toHaveClass('pasito-entering'));
	});

	it('holds a removed step in the DOM until its collapse has run', async () => {
		vi.useFakeTimers();
		const { container, rerender } = render(Stepper, { count: 3, active: 0 });
		await rerender({ count: 2, active: 0 });

		expect(stepsIn(container)).toHaveLength(3);
		expect(stepsIn(container)[2]).toHaveClass('pasito-exiting');

		await vi.advanceTimersByTimeAsync(400);
		expect(stepsIn(container)).toHaveLength(2);
	});

	it('re-indexes the surviving steps so the active one stays marked', async () => {
		const { container, rerender } = render(Stepper, { count: 5, active: 1 });
		await rerender({ count: 2, active: 1 });

		const live = stepsIn(container).filter((s) => !s.classList.contains('pasito-exiting'));
		expect(live).toHaveLength(2);
		expect(live[1]).toHaveClass('pasito-step-active');
	});
});

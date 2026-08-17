import { describe, it, expect, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import MetricSection from './MetricSection.svelte';

// MetricChart (layerchart + d3) is loaded through a dynamic import in
// MetricSection, so it mounts a microtask after render rather than synchronously.
// The chart assertions wait for it; the numbers, dates and empty-state assertions
// stay synchronous because they render from MetricSection itself.

// Warm the lazy chart once up front: layerchart is heavy enough that a cold
// first import inside a single test races waitFor's default timeout. Loading it
// here means every test's own onMount import resolves from cache immediately.
beforeAll(async () => {
	await import('./MetricChart.svelte');
});

const DAY = 86400000;
const START = Date.parse('2026-07-27T00:00:00.000Z');

const steps = { key: 'steps', label: 'Steps', unit: '', decimals: 0, goal: 10000 };

const series = (values) => ({
	metric: 'steps',
	unit: 'count',
	kind: 'sum',
	start: START,
	step: DAY,
	count: values.length,
	values
});

describe('MetricSection', () => {
	/**
	 * The day someone sets the Shortcut up, there is one row in the table. The
	 * days before it are zeros rather than gaps, so there is a line to stroke —
	 * otherwise the page reads as broken at exactly the moment it starts working.
	 */
	it('draws a chart for a window holding a single day', async () => {
		const { container, getByText } = render(MetricSection, {
			props: { metric: steps, series: series([null, null, 8421, null, null]) }
		});

		expect(getByText('8,421')).toBeInTheDocument();
		await waitFor(() => expect(container.querySelector('svg')).toBeInTheDocument());
		expect(container.querySelector('path')).toBeInTheDocument();
	});

	// Only a window whose very first slot is its one reading has no second point
	// to stroke toward, and that one draws as a dot.
	it('draws a lone first-slot reading as a point', async () => {
		const { container } = render(MetricSection, {
			props: { metric: steps, series: series([8421, null, null]) }
		});

		await waitFor(() => expect(container.querySelectorAll('circle.health-dot')).toHaveLength(1));
	});

	it('leaves a continuous line to the stroke', async () => {
		const { container } = render(MetricSection, {
			props: { metric: steps, series: series([1000, 2000, 3000]) }
		});

		await waitFor(() => expect(container.querySelector('path')).toBeInTheDocument());
		expect(container.querySelectorAll('circle.health-dot')).toHaveLength(0);
	});

	it('shows the newest reading, not the newest slot', () => {
		const { getByText } = render(MetricSection, {
			props: { metric: steps, series: series([1000, 2000, null]) }
		});

		expect(getByText('2,000')).toBeInTheDocument();
		expect(getByText('Jul 28, 2026')).toBeInTheDocument();
	});

	// One hovered day reads across every chart on the page. Inside the tracked
	// window a day this metric skipped is a zero, not an absence.
	it('follows the page-wide scrub, zero and all', () => {
		const { container, getByText } = render(MetricSection, {
			props: { metric: steps, series: series([1000, null, 3000]), active: 1 }
		});

		// By class rather than by text: the y axis labels a zero too, and the
		// headline is the one that has to be reading the scrubbed day.
		expect(container.querySelector('.text-3xl')).toHaveTextContent('0');
		expect(getByText('Jul 28, 2026')).toBeInTheDocument();
	});

	// Past the newest reading the metric has nothing to report yet, so it dashes
	// rather than claiming a zero it has no basis for.
	it('dashes a day past its newest reading', () => {
		const { getByText } = render(MetricSection, {
			props: { metric: steps, series: series([1000, 2000, null]), active: 2 }
		});

		expect(getByText('—')).toBeInTheDocument();
	});

	it('says so when the window is empty', () => {
		const { getByText, container } = render(MetricSection, {
			props: { metric: steps, series: series([null, null]) }
		});

		expect(getByText('—')).toBeInTheDocument();
		expect(getByText('No data yet')).toBeInTheDocument();
		expect(container.querySelector('svg')).not.toBeInTheDocument();
	});
});

/**
 * The same awkward shapes as `metrics.test.js`, but rendered.
 *
 * The pure helpers can be right while the chart still throws on the way to the
 * DOM — a NaN reaching a path `d`, a domain layerchart refuses. These render for
 * real and assert a line came out the other side.
 */
describe('MetricSection — awkward real-world series', () => {
	const drawn = async (values, props = {}) => {
		const { container } = render(MetricSection, {
			props: { metric: steps, series: series(values), ...props }
		});

		let path;
		await waitFor(() => {
			path = container.querySelector('path');
			expect(path).toBeInTheDocument();
		});
		// A `d` carrying a NaN renders nothing and logs nothing — the exact
		// failure mode worth pinning.
		expect(path.getAttribute('d') ?? '').not.toMatch(/NaN/);
		return container;
	};

	it('draws wild volatility', async () => {
		await drawn([12, 41000, 3, 28000, 0, 39500, 7, 500, 44000, 1]);
	});

	it('draws sharp direction changes', async () => {
		await drawn([0, 20000, 0, 20000, 0, 20000, 0]);
	});

	it('draws an isolated spike on a flat line', async () => {
		await drawn([0, 0, 0, 0, 31000, 0, 0, 0]);
	});

	it('draws a spike over a non-zero baseline', async () => {
		await drawn([5200, 5100, 5300, 48000, 5150, 5250]);
	});

	it('draws through irregular arrival with random gaps', async () => {
		const container = await drawn([8000, null, null, 12000, null, 3000, null, null, null, 9000]);
		// Gaps are zeros in a continuous line now, not points stranded between
		// breaks, so nothing falls back to a dot.
		expect(container.querySelectorAll('circle.health-dot')).toHaveLength(0);
	});

	it('draws an all-zero window', async () => {
		await drawn([0, 0, 0, 0]);
	});

	it('draws while a day past the newest reading is scrubbed', async () => {
		const container = await drawn([8000, 9000, 7000, null, null], { active: 4 });
		expect(container.querySelector('.text-3xl')).toHaveTextContent('—');
	});

	it('draws while a gap day is scrubbed', async () => {
		const container = await drawn([8000, null, 7000], { active: 1 });
		expect(container.querySelector('.text-3xl')).toHaveTextContent('0');
	});
});

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MetricSection from './MetricSection.svelte';

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
	 * The day someone sets the Shortcut up, there is one row in the table. A line
	 * needs two points, so that day has to reach the chart as a dot — otherwise
	 * the page reads as broken at exactly the moment it starts working.
	 */
	it('draws a chart for a window holding a single day', () => {
		const { container, getByText } = render(MetricSection, {
			props: { metric: steps, series: series([null, null, 8421, null, null]) }
		});

		expect(getByText('8,421')).toBeInTheDocument();
		expect(container.querySelector('svg')).toBeInTheDocument();
		// The lone reading is marked with a point rather than an invisible stroke.
		expect(container.querySelectorAll('circle.health-dot')).toHaveLength(1);
	});

	it('leaves a continuous line to the stroke', () => {
		const { container } = render(MetricSection, {
			props: { metric: steps, series: series([1000, 2000, 3000]) }
		});

		expect(container.querySelector('path')).toBeInTheDocument();
		expect(container.querySelectorAll('circle.health-dot')).toHaveLength(0);
	});

	it('shows the newest reading, not the newest slot', () => {
		const { getByText } = render(MetricSection, {
			props: { metric: steps, series: series([1000, 2000, null]) }
		});

		expect(getByText('2,000')).toBeInTheDocument();
		expect(getByText('Jul 28, 2026')).toBeInTheDocument();
	});

	// One hovered day reads across every chart on the page, so a metric that did
	// not report that day says so instead of falling back to its own latest.
	it('follows the page-wide scrub, dash and all', () => {
		const { getByText } = render(MetricSection, {
			props: { metric: steps, series: series([1000, null, 3000]), active: 1 }
		});

		expect(getByText('—')).toBeInTheDocument();
		expect(getByText('Jul 28, 2026')).toBeInTheDocument();
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

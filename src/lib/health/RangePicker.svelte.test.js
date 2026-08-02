import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import RangePicker from './RangePicker.svelte';

const RANGES = [7, 30, 90, 365];

function setup(value = 30) {
	const onselect = vi.fn();
	const result = render(RangePicker, { props: { ranges: RANGES, value, onselect } });
	return { ...result, onselect };
}

describe('RangePicker', () => {
	it('is a radio group with exactly one checked option', () => {
		const { getByRole, getAllByRole } = setup();

		expect(getByRole('radiogroup', { name: 'Range in days' })).toBeInTheDocument();
		expect(getAllByRole('radio')).toHaveLength(4);
		expect(getByRole('radio', { checked: true })).toHaveTextContent('30');
	});

	// Roving tabindex: the group is one tab stop, and arrow keys move within it.
	it('keeps the group to a single tab stop', () => {
		const { getAllByRole } = setup();
		const tabbable = getAllByRole('radio').filter((el) => el.tabIndex === 0);

		expect(tabbable).toHaveLength(1);
		expect(tabbable[0]).toHaveTextContent('30');
	});

	it('selects on click', async () => {
		const user = userEvent.setup();
		const { getByRole, onselect } = setup();

		await user.click(getByRole('radio', { name: '90' }));
		expect(onselect).toHaveBeenCalledWith(90);
	});

	it('moves selection and focus with the arrow keys', async () => {
		const user = userEvent.setup();
		const { getByRole, onselect } = setup();

		getByRole('radio', { name: '30' }).focus();
		await user.keyboard('{ArrowRight}');

		expect(onselect).toHaveBeenCalledWith(90);
		expect(document.activeElement).toHaveTextContent('90');
	});

	it('wraps around both ends', async () => {
		const user = userEvent.setup();
		const { getByRole, onselect } = setup(7);

		getByRole('radio', { name: '7' }).focus();
		await user.keyboard('{ArrowLeft}');
		expect(onselect).toHaveBeenCalledWith(365);
	});

	it('jumps to the ends with Home and End', async () => {
		const user = userEvent.setup();
		const { getByRole, onselect } = setup();

		getByRole('radio', { name: '30' }).focus();
		await user.keyboard('{End}');
		expect(onselect).toHaveBeenCalledWith(365);

		await user.keyboard('{Home}');
		expect(onselect).toHaveBeenCalledWith(7);
	});

	it('ignores keys that are not navigation', async () => {
		const user = userEvent.setup();
		const { getByRole, onselect } = setup();

		getByRole('radio', { name: '30' }).focus();
		await user.keyboard('x');
		expect(onselect).not.toHaveBeenCalled();
	});

	it('does not re-fire for the option already selected', async () => {
		const user = userEvent.setup();
		const { getByRole, onselect } = setup();

		await user.click(getByRole('radio', { name: '30' }));
		expect(onselect).not.toHaveBeenCalled();
	});

	// Before the pill has a box to occupy — server-rendered HTML, and the frame
	// before the first measurement — the checked option carries its own
	// background, so the selection is never invisible.
	it('leaves the checked option a background until the pill is measured', () => {
		const { getByRole } = setup();
		const pill = document.querySelector('[aria-hidden="true"].pointer-events-none');

		// jsdom reports no layout, so the pill can never be measured here.
		expect(pill).toHaveClass('invisible');
		expect(getByRole('radio', { checked: true }).className).toContain('bg-neutral-100');
	});
});

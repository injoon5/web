import type { Post } from '$lib/types';

type DateStyle = Intl.DateTimeFormatOptions['dateStyle'];

export function formatDate(date: string, dateStyle: DateStyle = 'medium', locales = 'en') {
	// Safari is mad about dashes in the date
	const dateToFormat = new Date(date.replaceAll('-', '/'));
	const dateFormatter = new Intl.DateTimeFormat(locales, { dateStyle });
	return dateFormatter.format(dateToFormat);
}

export function sliceText(description: string, limit: number) {
	if (description.split(' ').length <= limit) {
		return description;
	} else {
		return description.split(' ').slice(0, 25).join(' ').concat('...');
	}
}

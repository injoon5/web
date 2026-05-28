type DateStyle = Intl.DateTimeFormatOptions['dateStyle'];

function formatDate(date: string, dateStyle: DateStyle = 'medium', locales = 'en') {
	// Safari is mad about dashes in the date
	const dateToFormat = new Date(date.replaceAll('-', '/'));
	const dateFormatter = new Intl.DateTimeFormat(locales, { dateStyle });
	return dateFormatter.format(dateToFormat);
}

function sliceText(description: string, limit: number) {
	const words = description.split(' ');
	return words.length <= limit ? description : words.slice(0, limit).join(' ') + '...';
}

export { sliceText, formatDate };

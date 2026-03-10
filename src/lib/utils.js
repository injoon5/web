function formatDate(date, dateStyle = 'medium', locales = 'en') {
	const dateToFormat = new Date(date.replaceAll('-', '/'));
	const dateFormatter = new Intl.DateTimeFormat(locales, { dateStyle });
	return dateFormatter.format(dateToFormat);
}

function sliceText(description, limit) {
	if (description.split(' ').length <= limit) {
		return description;
	} else {
		return description.split(' ').slice(0, limit).join(' ').concat('...');
	}
}

export { sliceText, formatDate };

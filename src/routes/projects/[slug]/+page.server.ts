export function load({ cookies, url }) {
	const fromQuery = url.searchParams.get('lang');
	const fromCookie = cookies.get('preferred-lang');
	return { prefLang: fromQuery || fromCookie || null };
}

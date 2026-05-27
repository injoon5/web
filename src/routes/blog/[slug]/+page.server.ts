import { building } from '$app/environment';

export function load({ cookies, url }) {
	if (building) return { prefLang: null };

	const fromQuery = url.searchParams.get('lang');
	const fromCookie = cookies.get('preferred-lang');
	return { prefLang: fromQuery || fromCookie || null };
}

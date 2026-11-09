/**
 * The only way components call the site's `/api` routes.
 *
 * @param {string} url
 * @param {{ method?: string, body?: unknown }} [options]
 * @returns {Promise<{ ok: boolean, data: any, message: string | null, networkError: boolean }>}
 *   `message` is the server-provided error text (null when missing or on
 *   network failure); `networkError` is true when the request never got a
 *   response.
 */
export async function apiFetch(url, { method = 'GET', body } = {}) {
	let res;
	try {
		res = await fetch(url, {
			method,
			...(body !== undefined && {
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			})
		});
	} catch {
		return { ok: false, data: {}, message: null, networkError: true };
	}

	const data = await res.json().catch(() => ({}));
	return {
		ok: res.ok,
		data,
		message: res.ok ? null : (data.message ?? data.error ?? null),
		networkError: false
	};
}

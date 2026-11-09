/**
 * The browser half of `npm run test:e2e`: drives a production build the way a
 * reader does and fails on anything a unit test cannot see — a hydration error,
 * a CSP violation, a route that 404s, a click that lands on the error page, a
 * write that reaches Convex without the server credential.
 */
import { chromium } from 'playwright';
import { SITE_URL } from '../../src/lib/content/article-paths.js';

// The fake Convex has no websocket.
const WEBSOCKET = /websocket|wss?:\/\//i;
const LOAD_FAILURE = /Failed to load resource|net::ERR_/;

/**
 * A console error the run does not count: the websocket, and a resource that
 * failed to load from another host — the fake Convex, or an image host this
 * machine may not reach. A same-origin image, chunk or font that fails counts.
 * The document itself does not: the 404 checks ask for one, and judge it by
 * `res.status()`.
 *
 * @param {import('playwright').ConsoleMessage} m
 * @param {string} origin
 * @param {string} pageUrl
 */
function ignoredConsole(m, origin, pageUrl) {
	const text = m.text();
	if (WEBSOCKET.test(text)) return true;
	if (!LOAD_FAILURE.test(text)) return false;
	// Chromium puts the failed resource's URL in the message's location.
	const url = m.location().url;
	if (!URL.canParse(url)) return false;
	return new URL(url).origin !== origin || url === pageUrl;
}

/**
 * @param {string} origin  e.g. http://localhost:4173
 * @param {{ calls: { path: string, credential: string }[] }} convex
 * @returns {Promise<number>} the number of failed checks
 */
export async function runChecks(origin, convex) {
	let failures = 0;
	/** @param {unknown} cond @param {string} message */
	const check = (cond, message) => {
		console.log(`${cond ? 'ok  ' : 'FAIL'} ${message}`);
		if (!cond) failures++;
	};

	const browser = await chromium.launch();
	const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
	/** @type {string[]} */
	const errors = [];
	await context.exposeBinding('__reportCsp', (_, v) => errors.push(`CSP ${v}`));
	await context.addInitScript(() => {
		document.addEventListener('securitypolicyviolation', (e) =>
			// @ts-expect-error -- exposed above
			window.__reportCsp(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'}`)
		);
	});
	context.on('page', (p) => {
		p.on('pageerror', (e) => errors.push(`${p.url()} ${String(e).slice(0, 200)}`));
		p.on('console', (m) => {
			if (m.type() === 'error' && !ignoredConsole(m, origin, p.url())) {
				errors.push(`${p.url()} ${m.text().slice(0, 200)} ${m.location().url}`);
			}
		});
	});
	const page = await context.newPage();
	const onErrorPage = () =>
		page.evaluate(() => /tripped over itself|Server error/.test(document.body.textContent ?? ''));
	const pathOf = () => new URL(page.url()).pathname;
	/** Whether the page reaches a URL within `timeout`, without aborting the run. */
	const reaches = (/** @type {(u: URL) => boolean} */ match, timeout = 5000) =>
		page.waitForURL(match, { timeout }).then(
			() => true,
			() => false
		);
	/** Whether `selector` reaches `state` within `timeout`, without aborting the run. */
	const settles = (
		/** @type {string} */ selector,
		/** @type {'attached' | 'detached'} */ state = 'attached',
		timeout = 5000
	) =>
		page.waitForSelector(selector, { state, timeout }).then(
			() => true,
			() => false
		);

	// Every URL in the sitemap renders, in the right language, with its own canonical.
	const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
	const urls = [...sitemap.matchAll(/<loc>https:\/\/injoon5\.com([^<]*)<\/loc>/g)].map(
		(m) => m[1] || '/'
	);
	check(urls.length > 20, `sitemap lists ${urls.length} URLs`);
	let rendered = 0;
	for (const url of urls) {
		const before = errors.length;
		const res = await page.goto(origin + url, { waitUntil: 'networkidle' });
		const info = await page.evaluate(() => ({
			lang: document.documentElement.lang,
			h1: document.querySelector('h1')?.textContent?.trim(),
			canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href')
		}));
		// Scroll to the foot: lazy images, the comments section and anything else
		// that mounts on approach only meet the CSP once they are near the screen.
		await page.evaluate(async () => {
			for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
				scrollTo(0, y);
				await new Promise((r) => setTimeout(r, 60));
			}
		});
		await page.waitForLoadState('networkidle');
		const article = /^\/(blog|projects)\/[^/]+/.test(url);
		const fine =
			res?.status() === 200 &&
			!(await onErrorPage()) &&
			errors.length === before &&
			(!article || (!!info.h1 && info.canonical === `${SITE_URL}${url}`));
		if (fine) rendered++;
		else check(false, `GET ${url} → ${res?.status()} lang=${info.lang} h1="${info.h1 ?? ''}"`);
	}
	check(rendered === urls.length, `${rendered}/${urls.length} sitemap URLs render cleanly`);

	for (const url of ['/blog/does-not-exist', '/projects/nope/en', '/nope']) {
		const res = await page.goto(origin + url);
		check(res?.status() === 404, `GET ${url} → ${res?.status()}`);
	}

	await page.goto(`${origin}/blog/us-camp?lang=en`, { waitUntil: 'networkidle' });
	await reaches((u) => u.pathname === '/blog/us-camp/en');
	check(pathOf() === '/blog/us-camp/en', `old ?lang=en lands on ${pathOf()}`);

	// Every article opens by a click from the listings.
	for (const listing of ['/', '/blog', '/projects']) {
		await page.goto(origin + listing, { waitUntil: 'networkidle' });
		const links = await page.$$eval('a[href^="/blog/"], a[href^="/projects/"]', (as) => [
			...new Set(as.map((a) => a.getAttribute('href') ?? ''))
		]);
		let opened = 0;
		for (const href of links) {
			await page.goto(origin + listing, { waitUntil: 'networkidle' });
			await page.click(`a[href="${href}"]`);
			const arrived = await reaches((u) => u.pathname.startsWith(href));
			if (arrived && (await settles('article h1')) && !(await onErrorPage())) opened++;
		}
		check(opened === links.length, `${listing}: ${opened}/${links.length} articles open by click`);
	}

	// The language switch, both ways; titles can be the same in both languages,
	// so the URL and <html lang> are what is compared.
	/** @param {string} lang */
	const langBecomes = (lang) =>
		page
			.waitForFunction((l) => document.documentElement.lang === l, lang, { timeout: 5000 })
			.then(
				() => lang,
				() => page.evaluate(() => document.documentElement.lang)
			);
	for (const url of ['/blog/us-camp', '/projects/school-watch']) {
		await page.goto(origin + url, { waitUntil: 'networkidle' });
		// Hydration: a click before it does nothing, and nothing in the DOM says
		// when it is done.
		await page.waitForTimeout(700);
		await page
			.getByRole('button', { name: /^(en|english)$/i })
			.first()
			.click();
		const toEn = await reaches((u) => u.pathname === `${url}/en`);
		const en = await langBecomes('en');
		await page
			.getByRole('button', { name: /^(ko|한국어)$/i })
			.first()
			.click();
		const toKo = await reaches((u) => u.pathname === url);
		const ko = await langBecomes('ko');
		check(
			toEn && toKo && en === 'en' && ko === 'ko' && !(await onErrorPage()),
			`language switch on ${url} (lang ${en} → ${ko})`
		);
	}
	await context.clearCookies();

	// The English series link stays in English.
	await page.goto(`${origin}/blog/us-camp/en`, { waitUntil: 'networkidle' });
	await page.click('a[href="/blog/lg-ai-youth-camp/en"]');
	await reaches((u) => u.pathname === '/blog/lg-ai-youth-camp/en');
	check(
		pathOf() === '/blog/lg-ai-youth-camp/en',
		`series link from /en stays in English (${pathOf()})`
	);

	// The lightbox opens and closes; the comments section mounts.
	const dialog = '[role=dialog][aria-modal=true]';
	await page.goto(`${origin}/blog/us-camp`, { waitUntil: 'networkidle' });
	// Hydration, as above: the lightbox's click handler is attached by it.
	await page.waitForTimeout(800);
	const image = await page.$('.prose-post img:not([data-no-lightbox])');
	await image?.scrollIntoViewIfNeeded();
	await image?.click();
	const opened = !!image && (await settles(dialog));
	await page.keyboard.press('Escape');
	const closed = await settles(dialog, 'detached');
	check(opened && closed, 'lightbox opens and closes');
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	check(
		await settles('#comments textarea, #comments input', 'attached', 10_000),
		'comments section mounts'
	);

	// The ISR pages carry their data in the HTML.
	const home = await (await fetch(`${origin}/`)).text();
	check(home.includes('Track One') && home.includes('Photo One'), 'home HTML has both feeds');
	const now = await (await fetch(`${origin}/now`)).text();
	check(now.includes('<strong>papers</strong>'), '/now HTML has its rendered markdown');

	// The API routes, through to Convex.
	/** @param {string} path @param {string} method @param {unknown} [body] */
	const api = (path, method, body) =>
		page.evaluate(
			async ({ path, method, body }) => {
				const res = await fetch(path, {
					method,
					headers: { 'content-type': 'application/json' },
					body: body === undefined ? undefined : JSON.stringify(body)
				});
				return { status: res.status, json: await res.json().catch(() => null) };
			},
			{ path, method, body }
		);
	const visitor = await api('/api/visitor', 'GET');
	check(/^[0-9a-f]{64}$/.test(visitor.json?.ipHash ?? ''), `GET /api/visitor → ${visitor.status}`);
	const like = await api('/api/likes', 'POST', { url: '/blog/us-camp', liked: true });
	check(
		like.status === 200 && like.json?.ipHash === visitor.json?.ipHash,
		`POST /api/likes → ${like.status}`
	);
	const comment = await api('/api/comments', 'POST', {
		url: '/blog/us-camp',
		username: 'tester',
		password: 'pw1234',
		text: 'hello'
	});
	check(comment.status === 201, `POST /api/comments → ${comment.status}`);
	const vote = await api('/api/comments/k57abc/vote', 'POST', { voteType: 'up' });
	check(vote.status === 200, `POST vote → ${vote.status}`);
	const edit = await api('/api/comments/k57abc', 'PATCH', { text: 'edited', password: 'pw1234' });
	check(edit.status === 200, `PATCH comment → ${edit.status}`);
	const del = await api('/api/comments/k57abc', 'DELETE', { password: 'pw1234' });
	check(del.status === 200, `DELETE comment → ${del.status}`);
	const writes = convex.calls.filter((c) => c.credential !== '-');
	check(
		writes.length >= 6 && writes.every((c) => c.credential === 'valid'),
		`${writes.length} gated Convex writes, all with a valid server credential`
	);

	for (const [url, pattern] of /** @type {const} */ ([
		['/rss.xml', /<item>/],
		['/sitemap.xml', /hreflang="en"/],
		['/api/articles.json', /"langs"/],
		['/robots.txt', /Sitemap: https:\/\/injoon5\.com\/sitemap\.xml/]
	])) {
		const res = await fetch(origin + url);
		check(res.status === 200 && pattern.test(await res.text()), `${url} → ${res.status}`);
	}
	const admin = await page.goto(`${origin}/admin`);
	check(admin?.status() === 200 && !(await onErrorPage()), `GET /admin → ${admin?.status()}`);

	check(errors.length === 0, `no page errors or CSP violations (${errors.length})`);
	for (const e of errors.slice(0, 15)) console.log(`     ${e}`);

	await browser.close();
	return failures;
}

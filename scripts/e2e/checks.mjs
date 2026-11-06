/**
 * The browser half of `npm run test:e2e`: drives a production build the way a
 * reader does and fails on anything a unit test cannot see — a hydration error,
 * a CSP violation, a route that 404s, a click that lands on the error page, a
 * write that reaches Convex without the server credential.
 */
import { chromium } from 'playwright';

// The fake Convex has no websocket, and the image hosts may be unreachable.
const IGNORED_CONSOLE =
	/websocket|ws:\/\/|wss:\/\/|ERR_CONNECTION|Failed to load resource|net::ERR/i;

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
			if (m.type() === 'error' && !IGNORED_CONSOLE.test(m.text())) {
				errors.push(`${p.url()} ${m.text().slice(0, 200)}`);
			}
		});
	});
	const page = await context.newPage();
	const onErrorPage = () =>
		page.evaluate(() => /tripped over itself|Server error/.test(document.body.textContent ?? ''));
	const pathOf = () => new URL(page.url()).pathname;

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
			(!article || (!!info.h1 && info.canonical === `https://injoon5.com${url}`));
		if (fine) rendered++;
		else check(false, `GET ${url} → ${res?.status()} lang=${info.lang} h1="${info.h1 ?? ''}"`);
	}
	check(rendered === urls.length, `${rendered}/${urls.length} sitemap URLs render cleanly`);

	for (const url of ['/blog/does-not-exist', '/projects/nope/en', '/nope']) {
		const res = await page.goto(origin + url);
		check(res?.status() === 404, `GET ${url} → ${res?.status()}`);
	}

	await page.goto(`${origin}/blog/us-camp?lang=en`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(500);
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
			await page.waitForURL((u) => u.pathname.startsWith(href));
			await page.waitForTimeout(250);
			if (!(await onErrorPage()) && (await page.$('article h1'))) opened++;
		}
		check(opened === links.length, `${listing}: ${opened}/${links.length} articles open by click`);
	}

	// The language switch, both ways; titles can be the same in both languages,
	// so the URL and <html lang> are what is compared.
	for (const url of ['/blog/us-camp', '/projects/school-watch']) {
		await page.goto(origin + url, { waitUntil: 'networkidle' });
		await page.waitForTimeout(700);
		await page
			.getByRole('button', { name: /^(en|english)$/i })
			.first()
			.click();
		await page.waitForURL((u) => u.pathname === `${url}/en`);
		await page.waitForTimeout(700);
		const en = await page.evaluate(() => document.documentElement.lang);
		await page
			.getByRole('button', { name: /^(ko|한국어)$/i })
			.first()
			.click();
		await page.waitForURL((u) => u.pathname === url);
		await page.waitForTimeout(700);
		const ko = await page.evaluate(() => document.documentElement.lang);
		check(en === 'en' && ko === 'ko' && !(await onErrorPage()), `language switch on ${url}`);
	}
	await context.clearCookies();

	// The English series link stays in English.
	await page.goto(`${origin}/blog/us-camp/en`, { waitUntil: 'networkidle' });
	await page.click('a[href="/blog/lg-ai-youth-camp/en"]');
	await page.waitForURL((u) => u.pathname === '/blog/lg-ai-youth-camp/en');
	check(true, 'series link from /en stays in English');

	// The lightbox opens and closes; the comments section mounts.
	await page.goto(`${origin}/blog/us-camp`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(800);
	const image = await page.$('.prose-post img:not([data-no-lightbox])');
	await image?.scrollIntoViewIfNeeded();
	await image?.click();
	await page.waitForTimeout(700);
	const opened = !!(await page.$('[role=dialog][aria-modal=true]'));
	await page.keyboard.press('Escape');
	await page.waitForTimeout(700);
	const closed = !(await page.$('[role=dialog][aria-modal=true]'));
	check(opened && closed, 'lightbox opens and closes');
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	await page.waitForTimeout(1500);
	check(!!(await page.$('#comments textarea, #comments input')), 'comments section mounts');

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

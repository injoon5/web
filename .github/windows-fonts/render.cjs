// Temporary: renders main (before) and this branch (after) on Windows, through
// DirectWrite, in Chrome, Edge and Firefox. node render.cjs <outdir>
const { chromium, firefox } = require('playwright');
const fs = require('fs');
const path = require('path');

const out = process.argv[2];
const origins = { before: 'http://localhost:4180', after: 'http://localhost:4174' };
const browsers = process.env.LOCAL
	? [['chromium', () => chromium.launch()]]
	: [
			['chrome', () => chromium.launch({ channel: 'chrome' })],
			['msedge', () => chromium.launch({ channel: 'msedge' })],
			['firefox', () => firefox.launch()]
		];
const pages = [
	['post-ko', '/blog/us-camp', 1100, 1500],
	['post-en', '/blog/us-camp?lang=en', 1100, 1100],
	['home', '/', 1280, 1500],
	['blog', '/blog', 1100, 1100],
	['project-ko', '/projects/school-watch', 1100, 1500]
];
const samples = {
	hangul: '한국어 타이포그래피 가나다라마바사',
	latin: 'Korean typography abcdefghij',
	mixed: 'SvelteKit으로 만든 웹사이트 (Apple, Google 방문)'
};
const WEIGHTS = [300, 400, 500, 600, 700, 900];
const SIZES = [12, 13, 14, 16, 18, 20, 24, 32];

const specimen = `<main lang="ko" style="padding:24px;max-width:1040px;background:#fff;color:#111">
${[
	[14, 400],
	[16, 400],
	[16, 500],
	[16, 600],
	[20, 700],
	[24, 600],
	[32, 700],
	[16, 300]
]
	.map(
		([s, w]) =>
			`<p style="font-size:${s}px;font-weight:${w};line-height:1.6;margin:0 0 6px"><span style="font:500 10px sans-serif;color:#999">${s}/${w}</span> SvelteKit으로 만든 개인 웹사이트 — 2026년 11월 2일. LG AI 청소년 캠프에서 우승한 뒤 Silicon Valley에 다녀왔습니다 (Apple, Google 방문). “지금 듣는 음악” 섹션은 Last.fm API와 GitHub Actions로 만들었어요.</p>`
	)
	.join('\n')}
</main>`;

// One block per (weight, size, sample), absolutely placed, measured offline.
function grid() {
	let y = 10;
	const blocks = [];
	let html = '<div style="position:relative;background:#fff;color:#000">';
	for (const w of WEIGHTS)
		for (const s of SIZES) {
			let x = 10;
			for (const [k, t] of Object.entries(samples)) {
				const id = `b-${w}-${s}-${k}`;
				html += `<div id="${id}" lang="ko" style="position:absolute;left:${x}px;top:${y}px;white-space:nowrap;font-size:${s}px;font-weight:${w};line-height:1.5">${t}</div>`;
				blocks.push({ id, wt: w, s, k });
				x += Math.round(s * 22);
			}
			y += Math.round(s * 2);
		}
	html += `</div><div style="height:${y + 20}px"></div>`;
	return { html, blocks, height: y + 20 };
}

(async () => {
	const stats = {};
	for (const [name, launch] of browsers) {
		const browser = await launch();
		for (const dpr of [1, 1.5]) {
			for (const [label, origin] of Object.entries(origins)) {
				const dir = path.join(out, `${name}-${dpr}x`, label);
				fs.mkdirSync(dir, { recursive: true });
				const ctx = await browser.newContext({
					viewport: { width: 1280, height: 900 },
					deviceScaleFactor: dpr,
					colorScheme: 'light',
					reducedMotion: 'reduce'
				});
				const settle = async (page) => {
					await page.waitForLoadState('networkidle');
					await page.evaluate(() => document.fonts.ready);
					await page.waitForTimeout(700);
					await page.evaluate(() => {
						const a = document.querySelector('a[href*="github.com/injoon5/web/commit"]');
						if (a) a.textContent = '0000000';
					});
				};
				for (const [key, url, width, height] of pages) {
					const page = await ctx.newPage();
					await page.setViewportSize({ width, height: 900 });
					await page.goto(origin + url, { waitUntil: 'networkidle' });
					await settle(page);
					await page.screenshot({
						path: path.join(dir, `${key}.png`),
						clip: { x: 0, y: 0, width, height },
						fullPage: true,
						animations: 'disabled'
					});
					if (key === 'post-ko') {
						const info = await page.evaluate(() => {
							const ps = [...document.querySelectorAll('.prose-post p')].filter((p) =>
								/[가-힣]/.test(p.textContent)
							);
							return ps.slice(0, 40).map((p) => {
								const lh = parseFloat(getComputedStyle(p).lineHeight);
								const h = p.getBoundingClientRect().height;
								return { lh, h, lines: h / lh };
							});
						});
						let fonts = null;
						if (name !== 'firefox') {
							const cdp = await ctx.newCDPSession(page);
							await cdp.send('DOM.enable');
							await cdp.send('CSS.enable');
							const { root } = await cdp.send('DOM.getDocument');
							const { nodeIds } = await cdp.send('DOM.querySelectorAll', {
								nodeId: root.nodeId,
								selector: '.prose-post p'
							});
							fonts = {};
							for (const id of nodeIds.slice(0, 20)) {
								const r = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: id });
								for (const f of r.fonts)
									fonts[f.familyName] = (fonts[f.familyName] || 0) + f.glyphCount;
							}
						}
						stats[`${name}-${dpr}x-${label}`] = { paragraphs: info, fonts };
					}
					await page.close();
				}
				for (const [key, html, height] of [
					['specimen', specimen, 900],
					['grid', null, null]
				]) {
					const page = await ctx.newPage();
					await page.goto(origin + '/nope-404', { waitUntil: 'networkidle' });
					const g = key === 'grid' ? grid() : null;
					await page.evaluate(
						(h) => {
							document.body.innerHTML = h;
							document.body.style.background = '#fff';
						},
						g ? g.html : html
					);
					await settle(page);
					if (g) {
						const rects = await page.evaluate(
							(ids) =>
								ids.map((b) => {
									const el = document.getElementById(b.id);
									const r = el.getBoundingClientRect();
									const range = document.createRange();
									range.selectNodeContents(el);
									const t = range.getBoundingClientRect();
									return {
										...b,
										x: r.left + scrollX,
										y: r.top + scrollY,
										width: t.width,
										h: r.height
									};
								}),
							g.blocks
						);
						fs.writeFileSync(path.join(dir, 'grid.json'), JSON.stringify(rects));
					}
					await page.screenshot({ path: path.join(dir, `${key}.png`), fullPage: true });
					await page.close();
				}
				await ctx.close();
				console.log('done', name, dpr, label);
			}
		}
		await browser.close();
	}
	fs.writeFileSync(path.join(out, 'stats.json'), JSON.stringify(stats, null, 1));
})();

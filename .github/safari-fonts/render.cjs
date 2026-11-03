// Temporary: renders each font variant in WebKit (CoreText on macOS). node render.cjs <outdir>
const { webkit, devices } = require('playwright');
const fs = require('fs');
const out = process.argv[2];
const ids = fs
	.readFileSync(__dirname + '/ids.txt', 'utf8')
	.trim()
	.split('\n');
(async () => {
	const browser = await webkit.launch();
	for (const [name, opts] of [
		['mac', { viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 }],
		['iphone', devices['iPhone 15 Pro']]
	]) {
		const ctx = await browser.newContext(opts);
		const page = await ctx.newPage();
		await page.goto('http://localhost:8123/index.html');
		await page.evaluate(async () => {
			await Promise.all([...document.fonts].map((f) => f.load().catch(() => {})));
			await document.fonts.ready;
		});
		await page.waitForTimeout(500);
		fs.mkdirSync(`${out}/${name}`, { recursive: true });
		await page.screenshot({ path: `${out}/${name}/page.png`, fullPage: true });
		const status = await page.evaluate(() =>
			[...document.fonts].map((f) => `${f.family}: ${f.status}`)
		);
		fs.writeFileSync(`${out}/${name}/status.txt`, status.join('\n'));
		for (const id of ids)
			await page.locator(`[id="${id}"]`).screenshot({ path: `${out}/${name}/${id}.png` });
		await ctx.close();
	}
	await browser.close();
})();

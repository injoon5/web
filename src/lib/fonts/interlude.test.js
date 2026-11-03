// The Interlude files are cut to what the site uses, by a script run by hand
// (scripts/fonts/build-interlude.py). These checks fail when the site starts
// using something the files were cut without — the cue to rerun it.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from './interlude.json' with { type: 'json' };

const root = join(import.meta.dirname, '../../..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** @param {string} ranges */
function parseRanges(ranges) {
	const out = new Set();
	for (const part of ranges.split(',')) {
		const [a, b = a] = part.trim().slice(2).split('-');
		for (let cp = parseInt(a, 16); cp <= parseInt(b, 16); cp++) out.add(cp);
	}
	return out;
}

/** @param {string} dir @returns {string[]} */
function walk(dir) {
	return readdirSync(dir).flatMap((name) => {
		const p = join(dir, name);
		return statSync(p).isDirectory() ? walk(p) : [p];
	});
}

/** Same comment stripping as the script, so the two agree on what "used" means. */
function stripComments(text, path) {
	if (/\.(js|svelte|css)$/.test(path)) {
		text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
	}
	if (/\.(svelte|html|md)$/.test(path)) text = text.replace(/<!--[\s\S]*?-->/g, '');
	return text;
}

const sources = walk(join(root, 'src'))
	.map((p) => relative(root, p))
	.filter((p) => /\.(md|svelte|js|css|html)$/.test(p))
	.filter((p) => !p.includes('.test.') && !p.startsWith('src/test/'));

describe('Interlude web fonts', () => {
	it('carry every Interlude character the site uses outside CJK', () => {
		const tail = parseRanges(manifest.tail);
		const strays = new Map();
		for (const p of sources) {
			for (const ch of stripComments(read(p), p)) {
				const cp = ch.codePointAt(0) ?? 0;
				if (tail.has(cp)) strays.set(`U+${cp.toString(16).toUpperCase()} ${ch}`, p);
			}
		}
		// Each of these still renders, from upstream's long-tail file — but that
		// file is a CJK-sized download for one glyph. Rerun the script and it
		// moves into the extended file.
		expect(Object.fromEntries(strays)).toEqual({});
	});

	it('are not asked for an axis or feature they were cut without', () => {
		const css = sources.filter((p) => /\.(css|svelte)$/.test(p));
		const offending = [];
		const rules = [
			// The files have no width axis.
			[/font-stretch\s*:(?![^;]*75% 125%)/, 'font-stretch'],
			[/\bfont-stretch-/, 'font-stretch utility'],
			[
				/font-variation-settings\s*:(?!\s*(inherit|normal|var\(--default))/,
				'font-variation-settings'
			],
			// Only the default features and `tnum` were kept.
			[/font-feature-settings\s*:(?!\s*(inherit|normal|var\(--default))/, 'font-feature-settings'],
			[/font-variant-(?!numeric\s*:\s*(tabular-nums|normal|var\())[a-z-]+\s*:/, 'font-variant'],
			[
				/(?<![\w-])(ordinal|slashed-zero|lining-nums|oldstyle-nums|proportional-nums|diagonal-fractions|stacked-fractions)(?![\w-])/,
				'font-variant-numeric utility'
			]
		];
		for (const p of css) {
			const text = stripComments(read(p), p);
			for (const [re, what] of rules) if (re.test(text)) offending.push(`${p}: ${what}`);
		}
		expect(offending).toEqual([]);
	});

	it('are the files app.css declares and app.html preloads', () => {
		const appCss = read('src/app.css');
		const appHtml = read('src/app.html');
		for (const file of Object.values(manifest.files)) {
			expect(existsSync(join(root, 'static', file.url))).toBe(true);
			expect(appCss).toContain(`url(${file.url})`);
		}
		expect(appHtml).toContain(`href="${manifest.files.core.url}"`);
	});
});

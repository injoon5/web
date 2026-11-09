import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import type { Config } from '@sveltejs/kit/vite';
import { mdsvex } from 'mdsvex';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import mdsvexConfig from './mdsvex.config.js';
import { EMBED_ORIGIN as YOUTUBE_EMBED_ORIGIN } from './src/lib/markdown/remark-youtube.js';

function gitInfo() {
	try {
		// One `git log` for both fields — this config is evaluated more than once
		// per build, and each spawn is a process.
		const [sha, isoDate] = execSync('git log -1 --format=%h%n%cI').toString().trim().split('\n');
		return { sha, isoDate };
	} catch {
		return { sha: '', isoDate: '' };
	}
}

const { sha, isoDate } = gitInfo();
// Read at build time and inlined by src/env.js (`static: true`).
process.env.PUBLIC_GIT_COMMIT = sha;
process.env.PUBLIC_GIT_COMMIT_DATE = isoDate;

/**
 * Whether this build ships the DialKit tuning panels.
 *
 * Deliberately not an env var read at runtime: a runtime check still bundles
 * DialKit for everyone and pays for it on production's first load. Baked in as a
 * literal, `if (__DIALS__)` folds to `if (false)` and the dynamic import inside
 * it becomes unreachable, so Rollup emits no chunk for the panels at all.
 *
 * `VERCEL_ENV` is `production` | `preview` | `development`, and is set at build
 * time as well as runtime — so everything that isn't production gets the panel,
 * including `vercel dev`. Off Vercel entirely, fall back to the Node env.
 */
const dials = process.env.VERCEL_ENV
	? process.env.VERCEL_ENV !== 'production'
	: process.env.NODE_ENV !== 'production';

/**
 * Content-Security-Policy, enforced. Prerendered pages carry it as a <meta> that
 * SvelteKit puts in the head, hashing its own inline bootstrap script; rendered
 * pages (home, /now, /health, /admin) get it as a header, with a nonce.
 *
 * - The one inline script of our own is app.html's theme script, allowed by its
 *   hash, computed here from the file so an edit can never leave it stale. It
 *   also flips the deferred font sheet to `media=all`, so there is no inline
 *   event handler to allow.
 * - `style-src 'unsafe-inline'`: Svelte writes `style` attributes, and
 *   transitions and the dials add <style>. Styles cannot run script.
 * - Images may come from any https host (see img-src). Every other origin is
 *   one the site actually talks to: Convex (its HTTP and websocket origin),
 *   the analytics collector, YouTube's no-cookie embeds, Cloudflare's beacon
 *   while the domain is proxied, the Vercel toolbar on preview deployments, and
 *   Google Fonts where the dials ship (DialKit's theme imports Geist Mono).
 */
function contentSecurityPolicy(): Config['csp'] {
	const appHtml = readFileSync(new URL('./src/app.html', import.meta.url), 'utf8');
	const inline = [...appHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
		([, body]) => `sha256-${createHash('sha256').update(body).digest('base64')}` as const
	);

	const convexUrl =
		process.env.PUBLIC_CONVEX_URL ??
		loadEnv('production', process.cwd(), 'PUBLIC_').PUBLIC_CONVEX_URL ??
		'';
	// CSP's host-source shape: scheme, a dotted host, optional port.
	type HostSource = `${string}://${string}.${string}`;
	const convex: HostSource[] = ['https://*.convex.cloud', 'wss://*.convex.cloud'];
	try {
		const { origin, host, protocol } = new URL(convexUrl);
		if (!host.endsWith('.convex.cloud')) {
			convex.push(
				origin as HostSource,
				`${protocol === 'https:' ? 'wss' : 'ws'}://${host}` as HostSource
			);
		}
	} catch {
		// No URL at config time: the wildcard covers every hosted deployment.
	}

	const vercelLive = 'https://vercel.live';
	// DialKit's theme @imports Geist Mono from Google Fonts. Only builds that ship
	// the panels allow it; production never loads the sheet.
	const dialFonts = dials
		? {
				style: ['https://fonts.googleapis.com'] as const,
				font: ['https://fonts.gstatic.com'] as const
			}
		: { style: [] as const, font: [] as const };
	return {
		// Hashes for prerendered pages; a nonce for rendered ones, because /health
		// streams its data and SvelteKit writes each streamed chunk as an inline
		// script after the header has gone out — no hash could cover it. An ISR
		// page's nonce is fixed until it regenerates: its header and HTML are
		// cached together, so they still agree.
		mode: 'auto',
		directives: {
			'default-src': ['self'],
			'script-src': ['self', ...inline, vercelLive, 'https://static.cloudflareinsights.com'],
			'style-src': ['self', 'unsafe-inline', vercelLive, ...dialFonts.style],
			// Any https image: an image cannot run script, and a host list broke
			// Now Listening the moment it was enforced — Last.fm serves covers from
			// lastfm-img.freetls.fastly.net, and /now or a post may embed anything.
			'img-src': ['self', 'data:', 'blob:', 'https:'],
			'font-src': ['self', 'data:', vercelLive, ...dialFonts.font],
			'connect-src': [
				'self',
				...convex,
				'https://collector.onedollarstats.com',
				'https://cloudflareinsights.com',
				vercelLive,
				'wss://ws-us3.pusher.com'
			],
			'media-src': ['self'],
			'frame-src': [YOUTUBE_EMBED_ORIGIN, vercelLive],
			'object-src': ['none'],
			'base-uri': ['self'],
			'form-action': ['self']
		}
	};
}

export default defineConfig({
	define: {
		__DIALS__: JSON.stringify(dials)
	},
	server: {
		fs: {
			allow: ['..']
		},
		allowedHosts: true
	},
	// Tailwind runs as a Vite plugin rather than through PostCSS: Vite's own
	// postcss-import pass resolves `@import 'tailwindcss'` as a file path and
	// fails before `@tailwindcss/postcss` ever sees it.
	plugins: [
		tailwindcss(),
		sveltekit({
			extensions: ['.svelte', '.md'],
			// remark-math 3 in mdsvex.config.js doesn't fit mdsvex's plugin types. That
			// went unnoticed while this call lived in svelte.config.js, which is unchecked.
			preprocess: [vitePreprocess(), mdsvex(mdsvexConfig as Parameters<typeof mdsvex>[0])],
			onwarn(warning, handler) {
				const mdA11y =
					warning.filename?.endsWith('.md') &&
					(warning.code === 'a11y_no_noninteractive_tabindex' ||
						warning.code === 'a11y_img_redundant_alt');
				if (mdA11y) return;
				handler(warning);
			},
			adapter: adapter(),
			csp: contentSecurityPolicy()
		})
	]
});

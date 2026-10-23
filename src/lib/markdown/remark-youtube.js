/**
 * Turn a YouTube link written on its own line into an embedded player.
 *
 * This replaced `@remark-embedder` with its oEmbed transformer, which on every
 * build fetched oembed.com's list of ~300 providers and then each video's
 * oEmbed record — the slowest thing in the markdown pipeline by far, and a
 * network dependency for markup that is entirely predictable. It also tested
 * every one-word paragraph ("endpoints", "no.") against every provider as
 * `https://endpoints/`. YouTube is the only provider any post has used.
 *
 * The iframe it wrote also loaded eagerly: every embed pulled YouTube's player
 * in with the page. This one is `loading="lazy"` and on the privacy-enhanced
 * domain, which sets no cookies until the video is played.
 *
 * The rule matches `remarkLazyVideo`'s: **a top-level paragraph that is nothing
 * but one YouTube link**. `[Title](https://youtu.be/…)` names the frame for
 * screen readers — the title oEmbed used to supply — and a bare URL gets
 * YouTube's own default. A link inside a sentence stays a link.
 */

import { toString } from 'mdast-util-to-string';

/** What YouTube's own embed snippet calls a frame it knows nothing else about. */
const DEFAULT_TITLE = 'YouTube video player';

const ALLOW =
	'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

const VIDEO_ID = /^[\w-]{11}$/;
const HOSTS = new Set([
	'youtube.com',
	'm.youtube.com',
	'music.youtube.com',
	'youtube-nocookie.com'
]);

/** `90`, `90s`, `1m30s`, `1h2m3s` → seconds. */
function seconds(value) {
	if (!value) return 0;
	if (/^\d+$/.test(value)) return Number(value);
	const m = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
	return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}

/**
 * @param {string} href
 * @returns {{ id: string, start: number } | null}
 */
export function youTubeVideo(href) {
	let url;
	try {
		url = new URL(href);
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

	const host = url.hostname.replace(/^www\./, '');
	let id = null;
	if (host === 'youtu.be') id = url.pathname.slice(1);
	else if (HOSTS.has(host)) {
		const [, kind, rest] = url.pathname.split('/');
		if (kind === 'watch') id = url.searchParams.get('v');
		else if (['embed', 'shorts', 'live'].includes(kind)) id = rest;
	}
	if (!id || !VIDEO_ID.test(id)) return null;
	return { id, start: seconds(url.searchParams.get('t') ?? url.searchParams.get('start')) };
}

/** Attribute-safe, and safe in Svelte markup, where `{` opens an expression. */
const escape = (s) =>
	s.replace(
		/[&<>"{}]/g,
		(c) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '{': '&#123;', '}': '&#125;' })[c]
	);

/**
 * @param {{ id: string, start: number }} video
 * @param {string} title
 */
export function youTubeIframe({ id, start }, title) {
	const src = `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}`;
	return (
		`<iframe src="${src}" title="${escape(title)}" loading="lazy" allow="${ALLOW}" ` +
		`referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`
	);
}

/**
 * The paragraph's lone link as `{ href, text }`, or null. A bare URL is a link
 * node under mdsvex's parser (GFM autolinks are built in) and a text node under
 * a plain CommonMark one; both count.
 *
 * @param {any} node
 */
function loneLink(node) {
	if (node.type !== 'paragraph') return null;
	const children = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
	if (children.length !== 1) return null;
	const [child] = children;
	if (child.type === 'link') return { href: child.url, text: toString(child).trim() };
	if (child.type === 'text' && /^https?:\/\/\S+$/.test(child.value.trim())) {
		return { href: child.value.trim(), text: child.value.trim() };
	}
	return null;
}

export function remarkYouTube() {
	/** @param {any} tree */
	return (tree) => {
		tree.children = tree.children.map((node) => {
			const link = loneLink(node);
			const video = link && youTubeVideo(link.href);
			if (!video) return node;
			const titled = link.text && link.text !== link.href;
			return { type: 'html', value: youTubeIframe(video, titled ? link.text : DEFAULT_TITLE) };
		});
	};
}

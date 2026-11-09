import path from 'node:path';

/** SvelteKit's `static/`, which every root-relative media URL in a post resolves in. */
export const STATIC_ROOT = path.join(process.cwd(), 'static');

/**
 * The file a root-relative URL names inside `root`, or null for anything else:
 * a remote file is somebody else's and cannot be measured here, and `../`
 * would climb out of `static/`.
 *
 * @param {string} url
 * @param {string} root
 */
export function resolveLocal(url, root) {
	if (!url || !url.startsWith('/') || url.startsWith('//')) return null;
	const clean = url.split(/[?#]/)[0];
	const file = path.join(root, decodeURIComponent(clean));
	const within = path.relative(root, file);
	if (within.startsWith('..') || path.isAbsolute(within)) return null;
	return file;
}

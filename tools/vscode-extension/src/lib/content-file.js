'use strict';

/**
 * Where a markdown file sits in the content tree.
 *
 * The tree is `<contentRoot>/<kind>/<lang>/<slug>.md`, and the two languages of
 * one post share a slug — which is also what lets them share an asset folder.
 */

/** @param {string} p */
function toPosix(p) {
	return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

/**
 * @typedef {Object} ContentFile
 * @property {string} kind  `blog`, `projects`, ...
 * @property {string} lang
 * @property {string} slug
 * @property {string} path  the workspace-relative path it was read from
 */

/**
 * @param {string} relPath  workspace-relative path, posix or windows separators
 * @param {{ contentRoot?: string, languages?: string[] }} [options]
 * @returns {ContentFile | null}
 */
function classifyContentPath(relPath, options = {}) {
	const contentRoot = toPosix(options.contentRoot ?? 'src/content');
	const languages = options.languages ?? ['en', 'ko'];

	const file = toPosix(relPath);
	if (!file.endsWith('.md')) return null;
	if (!(file === contentRoot || file.startsWith(contentRoot + '/'))) return null;

	const rest = file.slice(contentRoot.length + 1).split('/');
	if (rest.length !== 3) return null;

	const [kind, lang, name] = rest;
	if (!languages.includes(lang)) return null;

	return { kind, lang, slug: name.slice(0, -3), path: file };
}

/**
 * The same entry in another language.
 *
 * @param {ContentFile} file
 * @param {string} lang
 * @param {{ contentRoot?: string }} [options]
 */
function counterpartPath(file, lang, options = {}) {
	const contentRoot = toPosix(options.contentRoot ?? 'src/content');
	return `${contentRoot}/${file.kind}/${lang}/${file.slug}.md`;
}

/**
 * The language to jump to from `lang`, cycling through the configured list.
 *
 * @param {string} lang
 * @param {string[]} languages
 */
function nextLanguage(lang, languages) {
	const at = languages.indexOf(lang);
	if (at === -1) return languages[0];
	return languages[(at + 1) % languages.length];
}

/**
 * The folder a dropped file belongs in, relative to the static root.
 *
 * Both languages resolve to the same folder: `{slug}` is the entry's slug, not
 * the file's language.
 *
 * @param {ContentFile | { kind: string, slug: string } | null} file
 * @param {'image' | 'video'} media
 * @param {{ assetFolders?: Record<string, Record<string, string>>, fallbackAssetFolder?: Record<string, string> }} config
 * @param {string} [fallbackSlug]  slug for a file outside the content tree
 */
function assetFolderFor(file, media, config, fallbackSlug = 'misc') {
	const folders = config.assetFolders ?? {};
	const fallback = config.fallbackAssetFolder ?? {};

	const kind = file?.kind ?? '';
	const slug = file?.slug ?? fallbackSlug;
	const template = folders[kind]?.[media] ?? fallback[media] ?? `${media}s/{slug}`;

	return toPosix(template.replace(/\{slug\}/g, slug).replace(/\{kind\}/g, kind || 'misc'));
}

module.exports = {
	assetFolderFor,
	classifyContentPath,
	counterpartPath,
	nextLanguage,
	toPosix
};

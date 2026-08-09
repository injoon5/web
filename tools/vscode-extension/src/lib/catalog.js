'use strict';

const vscode = require('vscode');

const { classifyContentPath } = require('./content-file');
const { parseFields } = require('./frontmatter');
const { scanMarkdown } = require('./markdown-scan');
const workspace = require('./workspace');

/**
 * An index of the content tree — every slug, which languages it exists in, and
 * the tags and series already in use.
 *
 * It is what makes the completions worth having: a cross-link suggests the
 * slugs that are actually there, and `series:` suggests the exact string a
 * sibling post used rather than a near-miss that splits the series in two.
 *
 * The tree is a few dozen files, so it is read whole and re-read on change.
 */

/**
 * @typedef {Object} CatalogEntry
 * @property {string} kind
 * @property {string} slug
 * @property {Map<string, { title: string, published: boolean, path: string }>} langs
 */

class Catalog {
	/**
	 * @param {vscode.WorkspaceFolder} folder
	 */
	constructor(folder) {
		this.folder = folder;
		/** @type {Map<string, CatalogEntry>} */
		this.entries = new Map();
		/** @type {Set<string>} */
		this.tags = new Set();
		/** @type {Set<string>} */
		this.series = new Set();

		/** @type {Promise<void> | null} */
		this.loading = null;
		this.stale = true;

		const config = workspace.getConfig(folder.uri);
		this.watcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(folder, `${config.contentRoot}/**/*.md`)
		);

		const invalidate = () => {
			this.stale = true;
		};
		this.watcher.onDidCreate(invalidate);
		this.watcher.onDidDelete(invalidate);
		this.watcher.onDidChange(invalidate);
	}

	async ready() {
		if (!this.stale && this.loading) return this.loading;
		this.stale = false;
		this.loading = this.#load();
		return this.loading;
	}

	async #load() {
		const config = workspace.getConfig(this.folder.uri);
		const files = await vscode.workspace.findFiles(
			new vscode.RelativePattern(this.folder, `${config.contentRoot}/**/*.md`)
		);

		/** @type {Map<string, CatalogEntry>} */
		const entries = new Map();
		const tags = new Set();
		const series = new Set();

		for (const uri of files) {
			const rel = workspace.relativeTo(this.folder, uri);
			const content = classifyContentPath(rel, config);
			if (!content) continue;

			let fields;
			try {
				const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
				const scan = scanMarkdown(text);
				fields = scan.frontmatter ? parseFields(scan.frontmatter.body, 1) : new Map();
			} catch {
				continue;
			}

			const key = `${content.kind}/${content.slug}`;
			if (!entries.has(key)) {
				entries.set(key, { kind: content.kind, slug: content.slug, langs: new Map() });
			}

			entries.get(key).langs.set(content.lang, {
				title: String(fields.get('title')?.value ?? content.slug),
				published: fields.get('published')?.value === true,
				path: rel
			});

			const tagValue = fields.get('tags')?.value;
			if (Array.isArray(tagValue)) for (const tag of tagValue) if (tag) tags.add(String(tag));

			const seriesValue = fields.get('series')?.value;
			if (typeof seriesValue === 'string' && seriesValue) series.add(seriesValue);
		}

		this.entries = entries;
		this.tags = tags;
		this.series = series;
	}

	/** @param {string} kind */
	slugsOf(kind) {
		return [...this.entries.values()].filter((entry) => entry.kind === kind);
	}

	/**
	 * @param {string} kind
	 * @param {string} slug
	 */
	get(kind, slug) {
		return this.entries.get(`${kind}/${slug}`) ?? null;
	}

	dispose() {
		this.watcher.dispose();
	}
}

/** @type {Map<string, Catalog>} */
const catalogs = new Map();

/** @param {vscode.WorkspaceFolder} folder */
function catalogFor(folder) {
	const key = folder.uri.toString();
	if (!catalogs.has(key)) catalogs.set(key, new Catalog(folder));
	return catalogs.get(key);
}

function disposeCatalogs() {
	for (const catalog of catalogs.values()) catalog.dispose();
	catalogs.clear();
}

module.exports = { Catalog, catalogFor, disposeCatalogs };

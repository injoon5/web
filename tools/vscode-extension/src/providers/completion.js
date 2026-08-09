'use strict';

const vscode = require('vscode');

const { catalogFor } = require('../lib/catalog');
const { componentImportEdit } = require('../lib/insert');
const { parseFields, requiredKeys } = require('../lib/frontmatter');
const { scanMarkdown } = require('../lib/markdown-scan');
const { imageSize } = require('../lib/image-size');
const media = require('../lib/media');
const workspace = require('../lib/workspace');

/**
 * Completions for the three things that are tedious to type correctly in a
 * post: a media path, a frontmatter field, and a cross-link to another entry.
 *
 * All three are checkable against the repo, which is the point — a suggested
 * `series` is one a sibling post already uses, and a suggested `/projects/...`
 * link is one that resolves.
 */

const LINK_TARGET = /\]\(\s*([^()\s]*)$/;
const ATTR_TARGET = /\b(?:src|poster|coverimage)\s*=?\s*["']?([^"'\s]*)$/;
const FRONTMATTER_KEY = /^([A-Za-z][\w-]*)?$/;
const FRONTMATTER_PAIR = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/;
const SEQUENCE_ITEM = /^\s+-\s*(.*)$/;

/** @param {number} bytes */
function humanSize(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Frontmatter fields the site reads, per content kind. */
function knownFields(kind, helpers) {
	const shared = [
		['title', "'$1'"],
		['description', "'$1'"],
		['coverimage', "'$1'"],
		['published', '${1|true,false|}'],
		['aiTranslated', '${1|true,false|}'],
		['tags', '\n  - $1']
	];

	if (kind === 'blog') {
		return [
			['type', '${1|blog,book,note|}'],
			...shared.slice(0, 2),
			['slug', `'${helpers.slug}'`],
			['date', `'${helpers.today}'`],
			['series', "'$1'"],
			...shared.slice(2)
		];
	}

	return [...shared.slice(0, 2), ['year', `'${helpers.year}'`], ...shared.slice(2)];
}

class ContentCompletionProvider {
	/**
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Position} position
	 */
	async provideCompletionItems(document, position) {
		const context = workspace.describe(document);
		if (!context) return undefined;

		const scan = scanMarkdown(document.getText());
		const offset = document.offsetAt(position);
		const linePrefix = document.getText(
			new vscode.Range(position.with({ character: 0 }), position)
		);

		if (scan.frontmatter && offset <= scan.frontmatter.end) {
			return this.#frontmatter(context, scan, linePrefix, position, document);
		}

		const attr = ATTR_TARGET.exec(linePrefix);
		const link = LINK_TARGET.exec(linePrefix);
		const typed = link?.[1] ?? (attr && /["']/.test(linePrefix) ? attr[1] : null);

		if (typed !== null && typed !== undefined) {
			return this.#paths(context, typed, position, Boolean(link));
		}

		if (/(^|\s)<[A-Za-z]*$/.test(linePrefix)) {
			return this.#components(context, document, position, linePrefix);
		}

		if (/^:{1,3}$/.test(linePrefix.trim()) && linePrefix.trimStart() === linePrefix.trim()) {
			return [this.#galleryFence(position, linePrefix)];
		}

		return undefined;
	}

	/**
	 * @param {ReturnType<typeof workspace.describe>} context
	 * @param {ReturnType<typeof scanMarkdown>} scan
	 * @param {string} linePrefix
	 * @param {vscode.Position} position
	 * @param {vscode.TextDocument} document
	 */
	async #frontmatter(context, scan, linePrefix, position, document) {
		const kind = context.content?.kind ?? 'blog';
		const catalog = catalogFor(context.folder);
		await catalog.ready();

		const fields = parseFields(scan.frontmatter.body, 1);
		const today = new Date().toISOString().slice(0, 10);
		const helpers = { slug: context.content?.slug ?? '', today, year: today.slice(0, 4) };

		const item = SEQUENCE_ITEM.exec(linePrefix);
		if (item) {
			// The only block sequence the tree uses is `tags`.
			return [...catalog.tags].sort().map((tag) => {
				const completion = new vscode.CompletionItem(tag, vscode.CompletionItemKind.Value);
				completion.range = new vscode.Range(position.translate(0, -item[1].length), position);
				return completion;
			});
		}

		const pair = FRONTMATTER_PAIR.exec(linePrefix);
		if (pair) {
			return this.#frontmatterValue(pair[1], pair[2], position, catalog, helpers, context);
		}

		if (!FRONTMATTER_KEY.test(linePrefix)) return undefined;

		const required = new Set(requiredKeys(kind));
		return knownFields(kind, helpers)
			.filter(([key]) => !fields.has(key) || document.lineAt(position.line).text.trim() === '')
			.map(([key, value]) => {
				const completion = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field);
				completion.insertText = new vscode.SnippetString(`${key}: ${value}`);
				completion.detail = required.has(key) ? 'required' : 'optional';
				completion.sortText = `${required.has(key) ? '0' : '1'}${key}`;
				completion.range = new vscode.Range(position.with({ character: 0 }), position);
				return completion;
			});
	}

	/**
	 * @param {string} key
	 * @param {string} typed
	 * @param {vscode.Position} position
	 * @param {import('../lib/catalog').Catalog} catalog
	 * @param {{ slug: string, today: string, year: string }} helpers
	 * @param {ReturnType<typeof workspace.describe>} context
	 */
	async #frontmatterValue(key, typed, position, catalog, helpers, context) {
		const range = new vscode.Range(position.translate(0, -typed.length), position);

		/** @param {string[]} values @param {vscode.CompletionItemKind} kind */
		const values = (list, kind = vscode.CompletionItemKind.Value) =>
			list.map((value) => {
				const completion = new vscode.CompletionItem(value, kind);
				completion.range = range;
				return completion;
			});

		switch (key) {
			case 'type':
				return values(['blog', 'book', 'note'], vscode.CompletionItemKind.EnumMember);
			case 'published':
			case 'aiTranslated':
				return values(['true', 'false'], vscode.CompletionItemKind.Keyword);
			case 'series':
				return values([...catalog.series].sort());
			case 'tags':
				return values([`\n  - ${[...catalog.tags][0] ?? ''}`.trimEnd()]);
			case 'date':
				return values([`'${helpers.today}'`]);
			case 'year':
				return values([`'${helpers.year}'`]);
			case 'slug':
				return values([`'${helpers.slug}'`]);
			case 'coverimage':
				return this.#paths(context, typed.replace(/^['"]|['"]$/g, ''), position, false);
			default:
				return undefined;
		}
	}

	/**
	 * Path completion, one folder at a time, plus two shortcuts: the media this
	 * post already has, and the entries it could link to.
	 *
	 * @param {ReturnType<typeof workspace.describe>} context
	 * @param {string} typed
	 * @param {vscode.Position} position
	 * @param {boolean} allowRoutes
	 */
	async #paths(context, typed, position, allowRoutes) {
		const { folder, config } = context;
		/** @type {vscode.CompletionItem[]} */
		const items = [];

		const lastSlash = typed.lastIndexOf('/');
		const dirUrl = lastSlash === -1 ? '' : typed.slice(0, lastSlash + 1);
		const partial = typed.slice(lastSlash + 1);
		const range = new vscode.Range(position.translate(0, -partial.length), position);

		if (dirUrl.startsWith('/')) {
			const dirUri = workspace.uriForUrl(folder, config, dirUrl);
			if (dirUri) {
				/** @type {[string, vscode.FileType][]} */
				let listing;
				try {
					listing = await vscode.workspace.fs.readDirectory(dirUri);
				} catch {
					listing = [];
				}

				for (const [name, type] of listing) {
					if (name.startsWith('.')) continue;
					const isDir = type === vscode.FileType.Directory;
					if (!isDir && !media.mediaKind(name)) continue;

					const completion = new vscode.CompletionItem(
						isDir ? `${name}/` : name,
						isDir ? vscode.CompletionItemKind.Folder : vscode.CompletionItemKind.File
					);
					completion.range = range;
					completion.sortText = `${isDir ? '0' : '1'}${name}`;
					completion.insertText = isDir ? `${name}/` : name;

					if (isDir) {
						completion.command = {
							command: 'editor.action.triggerSuggest',
							title: 'Continue'
						};
					} else {
						completion.detail = await describeAsset(vscode.Uri.joinPath(dirUri, name));
					}

					items.push(completion);
				}
			}
		}

		// Nothing typed yet: put this post's own media first, since that is
		// overwhelmingly what an image link in it points at.
		if (!typed || typed === '/') {
			const fullRange = new vscode.Range(position.translate(0, -typed.length), position);
			for (const kind of /** @type {const} */ (['image', 'video'])) {
				const target = workspace.assetTarget(context, kind);
				if (!target) continue;

				/** @type {[string, vscode.FileType][]} */
				let listing;
				try {
					listing = await vscode.workspace.fs.readDirectory(target.uri);
				} catch {
					continue;
				}

				for (const [name, type] of listing) {
					if (type === vscode.FileType.Directory || name.startsWith('.')) continue;
					const url = `${target.url}/${name}`;
					const completion = new vscode.CompletionItem(url, vscode.CompletionItemKind.File);
					completion.detail = `this ${context.content?.kind ?? 'page'}`;
					completion.range = fullRange;
					completion.sortText = `0${name}`;
					completion.filterText = `${url} ${name}`;
					items.push(completion);
				}
			}

			for (const root of ['/images/', '/videos/']) {
				const completion = new vscode.CompletionItem(root, vscode.CompletionItemKind.Folder);
				completion.range = fullRange;
				completion.sortText = `1${root}`;
				completion.command = { command: 'editor.action.triggerSuggest', title: 'Continue' };
				items.push(completion);
			}
		}

		if (allowRoutes && typed.split('/').length <= 2) {
			const catalog = catalogFor(folder);
			await catalog.ready();
			const fullRange = new vscode.Range(position.translate(0, -typed.length), position);

			for (const entry of catalog.entries.values()) {
				const url = `/${entry.kind}/${entry.slug}`;
				const lang = entry.langs.get(context.content?.lang ?? 'en') ?? [...entry.langs.values()][0];
				const completion = new vscode.CompletionItem(url, vscode.CompletionItemKind.Reference);
				completion.detail = lang?.title;
				completion.range = fullRange;
				completion.sortText = `2${url}`;
				items.push(completion);
			}
		}

		return items;
	}

	/**
	 * `<LazyVideo` and `<Gallery` bring their own import.
	 *
	 * @param {ReturnType<typeof workspace.describe>} context
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Position} position
	 * @param {string} linePrefix
	 */
	#components(context, document, position, linePrefix) {
		const typed = /<([A-Za-z]*)$/.exec(linePrefix)?.[1] ?? '';
		const range = new vscode.Range(position.translate(0, -(typed.length + 1)), position);

		const components = [
			{
				name: context.config.videoComponent?.name ?? 'LazyVideo',
				path: context.config.videoComponent?.path ?? '$lib/ui/LazyVideo.svelte',
				body: '<${1:LazyVideo} src="${2:/videos/}" label="${3:Play demo video}" />'
			}
		];

		return components.map((component) => {
			const completion = new vscode.CompletionItem(component.name, vscode.CompletionItemKind.Class);
			completion.detail = component.path;
			completion.range = range;
			completion.insertText = new vscode.SnippetString(
				component.body.replace('${1:LazyVideo}', component.name)
			);

			const importEdit = componentImportEdit(document.getText(), component);
			if (importEdit) {
				completion.additionalTextEdits = [
					vscode.TextEdit.insert(document.positionAt(importEdit.offset), importEdit.insert)
				];
				completion.documentation = new vscode.MarkdownString(
					`Also adds \`import ${component.name} from '${component.path}';\``
				);
			}

			return completion;
		});
	}

	/**
	 * @param {vscode.Position} position
	 * @param {string} linePrefix
	 */
	#galleryFence(position, linePrefix) {
		const completion = new vscode.CompletionItem(':::gallery', vscode.CompletionItemKind.Snippet);
		completion.detail = 'Explicit gallery fence';
		completion.documentation = new vscode.MarkdownString(
			'Groups the images inside it however they are spaced — including a single image.'
		);
		completion.range = new vscode.Range(position.translate(0, -linePrefix.trim().length), position);
		completion.insertText = new vscode.SnippetString(':::gallery\n$0\n:::');
		return completion;
	}
}

/** @param {vscode.Uri} uri */
async function describeAsset(uri) {
	try {
		const stat = await vscode.workspace.fs.stat(uri);
		const parts = [humanSize(stat.size)];

		if (stat.size < 8 * 1024 * 1024) {
			const size = imageSize(await vscode.workspace.fs.readFile(uri));
			if (size) parts.unshift(`${size.width}×${size.height}`);
		}

		return parts.join(' · ');
	} catch {
		return undefined;
	}
}

/** @param {vscode.DocumentSelector} selector */
function register(selector) {
	return vscode.languages.registerCompletionItemProvider(
		selector,
		new ContentCompletionProvider(),
		'/',
		'(',
		'"',
		"'",
		':',
		'<',
		'-'
	);
}

module.exports = { register };

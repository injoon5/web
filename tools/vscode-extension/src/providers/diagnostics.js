'use strict';

const vscode = require('vscode');

const { catalogFor } = require('../lib/catalog');
const { imageSize } = require('../lib/image-size');
const { parseFields, requiredKeys } = require('../lib/frontmatter');
const { scanMarkdown } = require('../lib/markdown-scan');
const media = require('../lib/media');
const workspace = require('../lib/workspace');

/**
 * The failure modes of this content tree, checked while the file is open.
 *
 * Every one of these has actually shipped at least once somewhere: a media path
 * that points at a file nobody committed, a `:::gallery` that never closes (and
 * so silently transforms nothing), a component used without its import, and a
 * smart quote inside `{}` — which is a parse error, not a typo.
 */

const SOURCE = 'web-authoring';

const CODE = {
	missingMedia: 'missing-media',
	emptyAlt: 'empty-alt',
	unclosedGallery: 'unclosed-gallery',
	smartQuote: 'smart-quote',
	missingField: 'missing-field',
	slugMismatch: 'slug-mismatch',
	missingTranslation: 'missing-translation',
	oversize: 'oversize-image',
	missingImport: 'missing-import',
	unsupportedFormat: 'unsupported-format'
};

const SMART_QUOTES = /[‘’“”]/g;

/** @type {Map<string, { exists: boolean, size: number, width?: number, height?: number }>} */
const assetCache = new Map();

/** @param {vscode.Uri} uri */
async function assetInfo(uri) {
	const key = uri.toString();
	const cached = assetCache.get(key);
	if (cached) return cached;

	/** @type {{ exists: boolean, size: number, width?: number, height?: number }} */
	let info;

	try {
		const stat = await vscode.workspace.fs.stat(uri);
		info = { exists: true, size: stat.size };

		if (media.mediaKind(uri.fsPath) === 'image' && stat.size < 16 * 1024 * 1024) {
			const dimensions = imageSize(await vscode.workspace.fs.readFile(uri));
			if (dimensions) {
				info.width = dimensions.width;
				info.height = dimensions.height;
			}
		}
	} catch {
		info = { exists: false, size: 0 };
	}

	assetCache.set(key, info);
	return info;
}

/**
 * @param {vscode.TextDocument} document
 * @param {number} index
 * @param {number} length
 */
function rangeAt(document, index, length) {
	return new vscode.Range(document.positionAt(index), document.positionAt(index + length));
}

/**
 * @param {vscode.TextDocument} document
 * @returns {Promise<vscode.Diagnostic[]>}
 */
async function analyze(document) {
	const context = workspace.describe(document);
	if (!context || !context.config.diagnostics.enabled) return [];

	const settings = context.config.diagnostics;
	const text = document.getText();
	const scan = scanMarkdown(text);

	/** @type {vscode.Diagnostic[]} */
	const diagnostics = [];

	/** @param {vscode.Range} range @param {string} message @param {vscode.DiagnosticSeverity} severity @param {string} code */
	const push = (range, message, severity, code) => {
		const diagnostic = new vscode.Diagnostic(range, message, severity);
		diagnostic.source = SOURCE;
		diagnostic.code = code;
		diagnostics.push(diagnostic);
		return diagnostic;
	};

	// Media references -------------------------------------------------------
	/** @type {{ url: string, index: number, length: number }[]} */
	const refs = [
		...scan.images.map((image) => ({
			url: image.url,
			index: image.urlIndex,
			length: image.url.length
		})),
		...scan.attrUrls.map((attr) => ({ url: attr.url, index: attr.index, length: attr.url.length }))
	];

	for (const ref of refs) {
		if (!ref.url.startsWith('/')) continue;

		const uri = workspace.uriForUrl(context.folder, context.config, ref.url);
		if (!uri) continue;

		const info = await assetInfo(uri);
		const range = rangeAt(document, ref.index, ref.length);

		if (!info.exists) {
			push(
				range,
				`No file at ${context.config.staticRoot}${ref.url}`,
				vscode.DiagnosticSeverity.Error,
				CODE.missingMedia
			);
			continue;
		}

		if (media.needsConversion(media.extensionOf(ref.url))) {
			push(
				range,
				`Browsers cannot display ${media.extensionOf(ref.url)}. Convert it to JPEG or WebP.`,
				vscode.DiagnosticSeverity.Warning,
				CODE.unsupportedFormat
			);
		}

		const limit = Number(settings.oversizeWidth) || 0;
		if (limit > 0 && info.width && info.width > limit) {
			push(
				range,
				`${info.width}px wide. The build caps images at 2400px — run npm run optimize-images, or downscale before committing.`,
				vscode.DiagnosticSeverity.Information,
				CODE.oversize
			);
		}
	}

	// Alt text ---------------------------------------------------------------
	if (settings.requireAltText) {
		for (const image of scan.images) {
			if (image.alt.trim()) continue;
			push(
				rangeAt(document, image.index, image.length),
				'Image has no alt text. It is also the lightbox caption unless data-lightbox-caption overrides it.',
				vscode.DiagnosticSeverity.Warning,
				CODE.emptyAlt
			);
		}
	}

	// Gallery fences ---------------------------------------------------------
	for (const fence of scan.galleryFences) {
		if (fence.closeIndex !== null) continue;
		push(
			rangeAt(document, fence.index, 10),
			'Unclosed :::gallery fence. An unclosed fence transforms nothing — the images render one by one.',
			vscode.DiagnosticSeverity.Warning,
			CODE.unclosedGallery
		);
	}

	// Smart quotes in compiled expressions -----------------------------------
	/** @type {{ index: number, text: string }[]} */
	const compiled = [...scan.braceSpans];
	if (scan.script && scan.script.close !== null) {
		compiled.push({
			index: scan.script.openEnd,
			text: text.slice(scan.script.openEnd, scan.script.close)
		});
	}

	for (const span of compiled) {
		SMART_QUOTES.lastIndex = 0;
		let match;
		while ((match = SMART_QUOTES.exec(span.text))) {
			push(
				rangeAt(document, span.index + match.index, 1),
				`Smart quote ${match[0]} inside a compiled expression. Svelte's parser throws js_parse_error on these — use a straight quote.`,
				vscode.DiagnosticSeverity.Error,
				CODE.smartQuote
			);
		}
	}

	// Components used without an import --------------------------------------
	const scriptText =
		scan.script && scan.script.close !== null
			? text.slice(scan.script.openEnd, scan.script.close)
			: '';

	const usage = /<([A-Z][A-Za-z0-9]*)[\s/>]/g;
	/** @type {Set<string>} */
	const reported = new Set();
	let usageMatch;
	while ((usageMatch = usage.exec(text))) {
		if (scan.protectedMask[usageMatch.index]) continue;
		const name = usageMatch[1];
		if (reported.has(name)) continue;
		if (new RegExp(`\\bimport\\s+${name}\\b`).test(scriptText)) continue;

		reported.add(name);
		push(
			rangeAt(document, usageMatch.index + 1, name.length),
			`<${name}> is not imported. mdsvex compiles this file as a Svelte component, so it needs an import in an instance <script>.`,
			vscode.DiagnosticSeverity.Error,
			CODE.missingImport
		);
	}

	// Frontmatter ------------------------------------------------------------
	if (context.content) {
		if (!scan.frontmatter) {
			push(
				new vscode.Range(0, 0, 0, 1),
				'No frontmatter. Without `published: true` this entry is invisible to every listing and to the RSS feed.',
				vscode.DiagnosticSeverity.Error,
				CODE.missingField
			);
		} else {
			const fields = parseFields(scan.frontmatter.body, 1);
			const missing = requiredKeys(context.content.kind).filter((key) => !fields.has(key));

			if (missing.length) {
				push(
					new vscode.Range(0, 0, 0, 3),
					`Frontmatter is missing ${missing.join(', ')}.`,
					vscode.DiagnosticSeverity.Warning,
					CODE.missingField
				);
			}

			const slug = fields.get('slug');
			if (slug && typeof slug.value === 'string' && slug.value !== context.content.slug) {
				push(
					new vscode.Range(slug.line, slug.column, slug.line, slug.column + slug.raw.length),
					`slug is '${slug.value}' but the file is ${context.content.slug}.md. The route comes from the filename.`,
					vscode.DiagnosticSeverity.Warning,
					CODE.slugMismatch
				);
			}

			if (settings.missingTranslation) {
				const catalog = catalogFor(context.folder);
				await catalog.ready();

				const entry = catalog.get(context.content.kind, context.content.slug);
				const absent = context.config.languages.filter((lang) => !entry?.langs.has(lang));

				if (entry && absent.length) {
					const title = fields.get('title');
					const line = title ? title.line : 1;
					push(
						new vscode.Range(line, 0, line, document.lineAt(line).text.length),
						`No ${absent.join('/')} translation of this entry.`,
						vscode.DiagnosticSeverity.Information,
						CODE.missingTranslation
					);
				}
			}
		}
	}

	return diagnostics;
}

function register() {
	const collection = vscode.languages.createDiagnosticCollection(SOURCE);
	/** @type {Map<string, NodeJS.Timeout>} */
	const pending = new Map();

	/** @param {vscode.TextDocument} document */
	const refresh = async (document) => {
		if (document.languageId !== 'markdown' || document.uri.scheme !== 'file') return;
		collection.set(document.uri, await analyze(document));
	};

	/** @param {vscode.TextDocument} document */
	const schedule = (document) => {
		const key = document.uri.toString();
		clearTimeout(pending.get(key));
		pending.set(
			key,
			setTimeout(() => {
				pending.delete(key);
				refresh(document);
			}, 350)
		);
	};

	const staticWatcher = vscode.workspace.createFileSystemWatcher('**/static/**');
	const clearCache = () => {
		assetCache.clear();
		for (const document of vscode.workspace.textDocuments) schedule(document);
	};
	staticWatcher.onDidCreate(clearCache);
	staticWatcher.onDidDelete(clearCache);
	staticWatcher.onDidChange(clearCache);

	for (const document of vscode.workspace.textDocuments) refresh(document);

	return [
		collection,
		staticWatcher,
		vscode.workspace.onDidOpenTextDocument(refresh),
		vscode.workspace.onDidChangeTextDocument((event) => schedule(event.document)),
		vscode.workspace.onDidCloseTextDocument((document) => collection.delete(document.uri)),
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('webAuthoring')) clearCache();
		})
	];
}

module.exports = { CODE, SOURCE, analyze, register };

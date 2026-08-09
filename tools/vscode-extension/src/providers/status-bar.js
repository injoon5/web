'use strict';

const vscode = require('vscode');

const { catalogFor } = require('../lib/catalog');
const { parseFields } = require('../lib/frontmatter');
const { scanMarkdown } = require('../lib/markdown-scan');
const workspace = require('../lib/workspace');

/**
 * What entry is open, which languages it exists in, and whether it is
 * published — the three things that are invisible while you are inside the
 * body of the file.
 */
function register() {
	const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	item.command = 'webAuthoring.openCounterpart';

	const update = async () => {
		const editor = vscode.window.activeTextEditor;
		const context = editor ? workspace.describe(editor.document) : null;

		if (!context || !context.content || !context.config.statusBar) {
			item.hide();
			return;
		}

		const catalog = catalogFor(context.folder);
		await catalog.ready();

		const entry = catalog.get(context.content.kind, context.content.slug);
		const langs = context.config.languages
			.map((lang) => (entry?.langs.has(lang) ? lang : `${lang}?`))
			.join(' · ');

		const scan = scanMarkdown(editor.document.getText());
		const fields = scan.frontmatter ? parseFields(scan.frontmatter.body, 1) : new Map();
		const published = fields.get('published')?.value === true;

		item.text = `$(${published ? 'globe' : 'circle-slash'}) ${context.content.slug} · ${langs}`;
		item.tooltip = new vscode.MarkdownString(
			[
				`**${context.content.kind}/${context.content.slug}** (${context.content.lang})`,
				'',
				published ? 'Published.' : 'Not published — invisible to every listing and to RSS.',
				'',
				'Click to open the translation counterpart.'
			].join('\n')
		);
		item.show();
	};

	update();

	return [
		item,
		vscode.window.onDidChangeActiveTextEditor(update),
		vscode.workspace.onDidSaveTextDocument(update),
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('webAuthoring')) update();
		})
	];
}

module.exports = { register };

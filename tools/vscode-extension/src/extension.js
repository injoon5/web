'use strict';

const vscode = require('vscode');

const commands = require('./commands');
const codeActions = require('./providers/code-actions');
const completion = require('./providers/completion');
const diagnostics = require('./providers/diagnostics');
const mediaLinks = require('./providers/media-links');
const mediaTransfer = require('./providers/media-transfer');
const statusBar = require('./providers/status-bar');
const { disposeCatalogs } = require('./lib/catalog');

/** Markdown on disk. Untitled buffers have nowhere to file media. */
const SELECTOR = [{ language: 'markdown', scheme: 'file' }];

/** @param {vscode.ExtensionContext} context */
function activate(context) {
	context.subscriptions.push(
		...commands.register(),
		...mediaTransfer.register(SELECTOR),
		...mediaLinks.register(SELECTOR),
		completion.register(SELECTOR),
		codeActions.register(SELECTOR),
		...diagnostics.register(),
		...statusBar.register(),
		new vscode.Disposable(disposeCatalogs)
	);
}

function deactivate() {
	disposeCatalogs();
}

module.exports = { activate, deactivate };

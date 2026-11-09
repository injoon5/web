'use strict';

// `workspace.siteModule` imports these straight from the repository in plain
// Node. A Vite-only import in either (`$app/*`, `?raw`, `import.meta.glob`)
// would quietly turn the extension's answers off, so it fails here instead.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../../../..');
const load = (rel) => import(pathToFileURL(path.join(root, rel)).href);

test('the site modules the extension loads stay plain ES modules', async () => {
	const { imageSize } = await load('src/lib/markdown/image-size.js');
	assert.equal(imageSize(new Uint8Array(4)), null);

	const paths = await load('src/lib/content/article-paths.js');
	assert.equal(paths.articlePath('blog', 'x', 'en', ['ko', 'en']), '/blog/x/en');
});

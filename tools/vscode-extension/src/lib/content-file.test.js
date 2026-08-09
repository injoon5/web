'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
	assetFolderFor,
	classifyContentPath,
	counterpartPath,
	nextLanguage
} = require('./content-file');

const config = {
	contentRoot: 'src/content',
	languages: ['en', 'ko'],
	assetFolders: {
		blog: { image: 'images/uploads/{slug}', video: 'videos/uploads/{slug}' },
		projects: { image: 'images/projects/{slug}', video: 'videos/projects/{slug}' }
	},
	fallbackAssetFolder: { image: 'images/uploads/{slug}', video: 'videos/uploads/{slug}' }
};

test('a content file is kind, language and slug', () => {
	assert.deepEqual(classifyContentPath('src/content/blog/en/us-camp.md', config), {
		kind: 'blog',
		lang: 'en',
		slug: 'us-camp',
		path: 'src/content/blog/en/us-camp.md'
	});
});

test('windows separators and a leading ./ are the same path', () => {
	assert.equal(
		classifyContentPath('.\\src\\content\\projects\\ko\\sirius.md', config)?.slug,
		'sirius'
	);
});

test('anything not shaped like the tree is not a content file', () => {
	assert.equal(classifyContentPath('README.md', config), null);
	assert.equal(classifyContentPath('src/content/blog/us-camp.md', config), null);
	assert.equal(classifyContentPath('src/content/blog/fr/us-camp.md', config), null);
	assert.equal(classifyContentPath('src/content/blog/en/deep/us-camp.md', config), null);
	assert.equal(classifyContentPath('src/lib/nav/NavBar.svelte', config), null);
});

test('the counterpart keeps the slug and swaps the language', () => {
	const file = classifyContentPath('src/content/blog/en/us-camp.md', config);
	assert.equal(counterpartPath(file, 'ko', config), 'src/content/blog/ko/us-camp.md');
});

test('languages cycle', () => {
	assert.equal(nextLanguage('en', ['en', 'ko']), 'ko');
	assert.equal(nextLanguage('ko', ['en', 'ko']), 'en');
	assert.equal(nextLanguage('fr', ['en', 'ko']), 'en');
});

test('both languages of an entry file media in one folder', () => {
	const en = classifyContentPath('src/content/blog/en/us-camp.md', config);
	const ko = classifyContentPath('src/content/blog/ko/us-camp.md', config);

	assert.equal(assetFolderFor(en, 'image', config), 'images/uploads/us-camp');
	assert.equal(assetFolderFor(ko, 'image', config), 'images/uploads/us-camp');
});

test('a project files media somewhere else than a post', () => {
	const project = classifyContentPath('src/content/projects/en/sirius.md', config);
	assert.equal(assetFolderFor(project, 'image', config), 'images/projects/sirius');
	assert.equal(assetFolderFor(project, 'video', config), 'videos/projects/sirius');
});

test('a markdown file outside the tree falls back to its own name', () => {
	assert.equal(assetFolderFor(null, 'image', config, 'scratch'), 'images/uploads/scratch');
});

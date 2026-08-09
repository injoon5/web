'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
	blockInsertPadding,
	buildMediaSnippet,
	componentImportEdit,
	galleryFence
} = require('./insert');

const component = { name: 'LazyVideo', path: '$lib/ui/LazyVideo.svelte' };

test('one image is one figure', () => {
	const snippet = buildMediaSnippet([{ media: 'image', url: '/images/uploads/trip/gate.jpeg' }]);
	assert.equal(snippet, '![${1:alt}](/images/uploads/trip/gate.jpeg)$0');
});

test('several images go on consecutive lines, which is what makes a gallery', () => {
	const snippet = buildMediaSnippet(
		[
			{ media: 'image', url: '/images/a.png' },
			{ media: 'image', url: '/images/b.png' }
		],
		{ altPlaceholder: false }
	);

	assert.equal(snippet, '![](/images/a.png)\n![](/images/b.png)');
	assert.equal(snippet.includes('\n\n'), false);
});

test('a video is the component, not an image', () => {
	const snippet = buildMediaSnippet([{ media: 'video', url: '/videos/projects/x/demo.mp4' }], {
		altPlaceholder: false
	});

	assert.equal(snippet, '<LazyVideo src="/videos/projects/x/demo.mp4" label="Play demo video" />');
});

test('spaces and parentheses in a url are encoded, other scripts are not', () => {
	const snippet = buildMediaSnippet(
		[{ media: 'image', url: '/images/uploads/a/초과의날 (1).png' }],
		{ altPlaceholder: false }
	);

	assert.equal(snippet, '![](/images/uploads/a/초과의날%20%281%29.png)');
});

test('the import goes into the instance script that is already there', () => {
	const text = [
		'---',
		'title: x',
		'---',
		'',
		'<script>',
		"\timport A from 'a';",
		'</script>',
		''
	].join('\n');

	const edit = componentImportEdit(text, component);
	const next = text.slice(0, edit.offset) + edit.insert + text.slice(edit.offset);

	assert.match(
		next,
		/<script>\n\timport LazyVideo from '\$lib\/ui\/LazyVideo\.svelte';\n\timport A/
	);
});

test('with no script block, one is opened under the frontmatter', () => {
	const text = '---\ntitle: x\n---\n\nBody.\n';
	const edit = componentImportEdit(text, component);
	const next = text.slice(0, edit.offset) + edit.insert + text.slice(edit.offset);

	assert.match(next, /---\n\n<script>\n\timport LazyVideo/);
	assert.match(next, /<\/script>\n\n?\nBody\./);
});

test('an import already present is not added twice', () => {
	const text = "<script>\n\timport LazyVideo from '$lib/ui/LazyVideo.svelte';\n</script>\n";
	assert.equal(componentImportEdit(text, component), null);
});

test('media lands in its own block, never mid-sentence', () => {
	assert.deepEqual(blockInsertPadding('Some prose.', 'Some prose.'.length), {
		prefix: '\n\n',
		suffix: ''
	});
	assert.deepEqual(blockInsertPadding('Para.\n\n', 7), { prefix: '', suffix: '' });
	assert.deepEqual(blockInsertPadding('', 0), { prefix: '', suffix: '' });
});

test('the explicit fence trims what it wraps', () => {
	assert.equal(
		galleryFence('\n![a](/a.png)\n![b](/b.png)\n\n'),
		':::gallery\n![a](/a.png)\n![b](/b.png)\n:::'
	);
});

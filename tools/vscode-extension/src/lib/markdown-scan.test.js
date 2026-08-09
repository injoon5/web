'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { scanMarkdown } = require('./markdown-scan');

const post = [
	'---',
	'type: blog',
	"title: 'Silicon Valley Camp'",
	'published: true',
	'---',
	'',
	'<script>',
	"\timport LazyVideo from '$lib/ui/LazyVideo.svelte';",
	'</script>',
	'',
	'## Airport',
	'',
	'![Korean Air](/images/uploads/us-camp/IMG_8658.jpeg)',
	'',
	'<LazyVideo src="/videos/projects/watch.mp4" label="Play demo" />',
	''
].join('\n');

test('frontmatter is found and bounded', () => {
	const scan = scanMarkdown(post);
	assert.ok(scan.frontmatter);
	assert.equal(post.slice(0, scan.frontmatter.end).endsWith('---'), true);
	assert.match(scan.frontmatter.body, /title: 'Silicon Valley Camp'/);
	assert.equal(scan.frontmatter.body.includes('## Airport'), false);
});

test('images and src attributes are both media references', () => {
	const scan = scanMarkdown(post);

	assert.equal(scan.images.length, 1);
	assert.equal(scan.images[0].alt, 'Korean Air');
	assert.equal(scan.images[0].url, '/images/uploads/us-camp/IMG_8658.jpeg');
	assert.equal(post.slice(scan.images[0].urlIndex, scan.images[0].urlIndex + 10), '/images/up');

	assert.deepEqual(
		scan.attrUrls.map((entry) => entry.url),
		['/videos/projects/watch.mp4']
	);
});

test('the instance script is located and its body is not scanned', () => {
	const scan = scanMarkdown(post);
	assert.ok(scan.script);
	assert.equal(post.slice(scan.script.openStart, scan.script.openEnd), '<script>');
	assert.equal(post.slice(scan.script.close, scan.script.close + 9), '</script>');
});

test('a module script is not the instance script', () => {
	const scan = scanMarkdown('<script module>\n\texport const x = 1;\n</script>\n');
	assert.equal(scan.script, null);
});

test('fenced code is not content', () => {
	const text = [
		'Here is how you write one:',
		'',
		'```md',
		'![alt](url)',
		':::gallery',
		'```',
		'',
		'![Real](/images/a.png)'
	].join('\n');

	const scan = scanMarkdown(text);
	assert.deepEqual(
		scan.images.map((image) => image.url),
		['/images/a.png']
	);
	assert.equal(scan.galleryFences.length, 0);
});

test('inline code is not content either', () => {
	const scan = scanMarkdown('Use `![alt](/images/x.png)` to embed.\n');
	assert.equal(scan.images.length, 0);
});

test('a gallery fence knows whether it closed', () => {
	const closed = scanMarkdown(':::gallery\n![a](/a.png)\n:::\n');
	assert.equal(closed.galleryFences.length, 1);
	assert.notEqual(closed.galleryFences[0].closeIndex, null);

	const open = scanMarkdown(':::gallery\n![a](/a.png)\n');
	assert.equal(open.galleryFences.length, 1);
	assert.equal(open.galleryFences[0].closeIndex, null);
});

test('brace expressions are collected, and only outside code', () => {
	const scan = scanMarkdown('Value is {count} and `{notThis}`.\n');
	assert.deepEqual(
		scan.braceSpans.map((span) => span.text),
		['{count}']
	);
});

test('an image with a title and angle-bracketed url still parses', () => {
	const scan = scanMarkdown('![A](</images/with space.png> "Caption")\n');
	assert.equal(scan.images[0].url, '/images/with space.png');
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseFields, quote, requiredKeys, stringifyFrontmatter } = require('./frontmatter');

const body = [
	'type: blog',
	"title: 'Silicon Valley Camp'",
	'description: After winning, I went.',
	"date: '2024-07-16'",
	'tags:',
	'  - Swift',
	'  - Python',
	'published: true',
	'aiTranslated: false',
	''
].join('\n');

test('scalars, quotes and booleans', () => {
	const fields = parseFields(body, 1);

	assert.equal(fields.get('type').value, 'blog');
	assert.equal(fields.get('title').value, 'Silicon Valley Camp');
	assert.equal(fields.get('description').value, 'After winning, I went.');
	assert.equal(fields.get('published').value, true);
	assert.equal(fields.get('aiTranslated').value, false);
});

test('a block sequence collects its items', () => {
	const fields = parseFields(body, 1);
	assert.deepEqual(fields.get('tags').value, ['Swift', 'Python']);
});

test('fields carry the line and column of their value', () => {
	const fields = parseFields(body, 1);

	assert.equal(fields.get('type').line, 1);
	assert.equal(fields.get('published').line, 8);
	assert.equal(fields.get('published').column, 'published: '.length);
	assert.equal(fields.get('published').raw, 'true');
});

test('an inline array is an array', () => {
	const fields = parseFields("tags: ['a', 'b']\n", 1);
	assert.deepEqual(fields.get('tags').value, ['a', 'b']);
});

test('required keys differ by kind', () => {
	assert.deepEqual(requiredKeys('projects'), ['title', 'description', 'year', 'published']);
	assert.ok(requiredKeys('blog').includes('date'));
});

test('quoting only where it changes meaning', () => {
	assert.equal(quote('Silicon Valley Camp'), 'Silicon Valley Camp');
	assert.equal(quote('2024-07-16'), "'2024-07-16'");
	assert.equal(quote('true'), "'true'");
	assert.equal(quote(''), "''");
	assert.equal(quote(false), 'false');
	assert.equal(quote("it's"), '"it\'s"');
});

test('a rendered block parses back to what went in', () => {
	const rendered = stringifyFrontmatter([
		['title', 'Sirius App'],
		['tags', ['Swift', 'Python']],
		['published', false]
	]);

	assert.equal(rendered.startsWith('---\n'), true);
	assert.equal(rendered.endsWith('\n---'), true);

	const fields = parseFields(rendered.slice(4, -4), 1);
	assert.equal(fields.get('title').value, 'Sirius App');
	assert.deepEqual(fields.get('tags').value, ['Swift', 'Python']);
	assert.equal(fields.get('published').value, false);
});

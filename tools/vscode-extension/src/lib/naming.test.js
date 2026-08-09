'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { fileNameFor, isGenericName, kebabCase, preferredStem } = require('./naming');

test('kebabCase splits camel case and collapses separators', () => {
	assert.equal(kebabCase('Korean Air Gate'), 'korean-air-gate');
	assert.equal(kebabCase('slideDeck_02 (final).png'), 'slide-deck-02-final-png');
	assert.equal(kebabCase('---messy---'), 'messy');
});

test('kebabCase keeps letters from other scripts', () => {
	assert.equal(kebabCase('Country_Trends_초과의날'), 'country-trends-초과의날');
});

test('camera, screenshot and clipboard names carry no meaning', () => {
	for (const name of [
		'IMG_8650',
		'img8650',
		'DSC00123',
		'PXL_20240716_101112',
		'Screen Shot 2024-07-16 at 10.32.11',
		'스크린샷 2024-07-16',
		'Untitled',
		'pasted image',
		'12345',
		'C13C2332-0685-4D54-A17B-92B63D415233_1_105_c'
	]) {
		assert.equal(isGenericName(name), true, name);
	}
});

test('a name someone chose is kept', () => {
	for (const name of ['korean-air', 'dev-log', 'slide-11', 'app-1']) {
		assert.equal(isGenericName(name), false, name);
	}
});

test('preferredStem honours the strategy', () => {
	assert.equal(preferredStem({ original: 'IMG_8650.jpeg', strategy: 'auto' }), null);
	assert.equal(preferredStem({ original: 'IMG_8650.jpeg', strategy: 'original' }), 'img-8650');
	assert.equal(preferredStem({ original: 'Dev Log.png', strategy: 'sequence' }), null);
	assert.equal(preferredStem({ original: 'Dev Log.png', strategy: 'auto' }), 'dev-log');
});

test('generic names are numbered after the slug, skipping what is there', () => {
	const taken = new Set(['us-camp-1', 'us-camp-2']);

	assert.equal(
		fileNameFor({ original: 'IMG_8650.jpeg', extension: '.jpeg', slug: 'us-camp' }, taken),
		'us-camp-3.jpeg'
	);
	assert.equal(
		fileNameFor({ original: 'IMG_8651.jpeg', extension: '.jpeg', slug: 'us-camp' }, taken),
		'us-camp-4.jpeg'
	);
});

test('a collision on a real name gets a suffix, not a new number', () => {
	const taken = new Set(['dev-log']);
	assert.equal(
		fileNameFor({ original: 'dev-log.png', extension: '.png', slug: 'solar-system' }, taken),
		'dev-log-2.png'
	);
});

test('the same batch does not hand out one name twice', () => {
	const taken = new Set();
	const names = ['IMG_1.png', 'IMG_2.png', 'IMG_3.png'].map((original) =>
		fileNameFor({ original, extension: '.png', slug: 'trip' }, taken)
	);

	assert.deepEqual(names, ['trip-1.png', 'trip-2.png', 'trip-3.png']);
});

test('stems collide across extensions, so a sequence never reuses a number', () => {
	const taken = new Set(['trip-1']);
	assert.equal(
		fileNameFor({ original: 'IMG_9.jpeg', extension: '.jpeg', slug: 'trip' }, taken),
		'trip-2.jpeg'
	);
});

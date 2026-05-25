import assert from 'node:assert/strict';
import { parseFrontmatter } from '../src/lib/server/frontmatter.js';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Frontmatter
const meta = parseFrontmatter(`title: "What's next?"
description: A guide: for beginners
published: true`);
assert.equal(meta.title, "What's next?");
assert.equal(meta.published, true);

// Admin session token shape (from admin.ts logic)
function verifyToken(token, secret) {
	const parts = token.split('.');
	if (parts.length !== 3) return false;
	const [expiresRaw, , sig] = parts;
	if (Date.now() > Number(expiresRaw)) return false;
	const payload = `${expiresRaw}.${parts[1]}`;
	const expected = createHmac('sha256', secret).update(payload).digest('hex');
	try {
		return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
	} catch {
		return false;
	}
}

const secret = 'test-secret-12345678';
const expires = Date.now() + 60000;
const nonce = 'abc123';
const payload = `${expires}.${nonce}`;
const sig = createHmac('sha256', secret).update(payload).digest('hex');
const token = `${payload}.${sig}`;
assert.equal(verifyToken(token, secret), true);
assert.equal(verifyToken(token, 'wrong'), false);

console.log('smoke-test: ok');

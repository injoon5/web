import { describe, it, expect, vi } from 'vitest';

vi.mock('#lib/server/convex.js', () => ({ serverCredential: 'server-credential' }));

import { ADMIN_SECRET } from '$app/env/private';
import { adminArgs, visitorArgs } from './callers.js';

const asAdmin = () => new Request('http://x/api', { headers: { 'x-admin-secret': ADMIN_SECRET } });
const asVisitor = () => new Request('http://x/api', { headers: { 'x-real-ip': '203.0.113.7' } });

describe('adminArgs', () => {
	it('is a 401 for anyone but the admin', () => {
		expect(() => adminArgs(asVisitor())).toThrow(expect.objectContaining({ status: 401 }));
	});

	it("carries the admin secret for the admin's request", () => {
		expect(adminArgs(asAdmin())).toEqual({ adminSecret: ADMIN_SECRET });
	});
});

describe('visitorArgs', () => {
	it('sends the server credential and no admin secret for a visitor', () => {
		const args = visitorArgs(asVisitor());
		expect(args).toMatchObject({ serverCredential: 'server-credential', adminSecret: undefined });
		expect(args.ipHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('adds the admin secret for the admin', () => {
		expect(visitorArgs(asAdmin()).adminSecret).toBe(ADMIN_SECRET);
	});
});

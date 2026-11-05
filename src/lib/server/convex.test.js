import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/env/public', () => ({ PUBLIC_CONVEX_URL: 'https://example-123.convex.cloud' }));

import { serverCredential } from './convex.js';
import { deriveServerCredential } from '../../../convex/lib/serverCall.js';
import { ADMIN_SECRET } from '$app/env/private';

describe('serverCredential', () => {
	// Node's crypto on this side, Web Crypto in the Convex runtime: if the two
	// ever derive different strings, every like, vote and comment is refused.
	it('is what Convex derives from the same ADMIN_SECRET', async () => {
		expect(serverCredential).toMatch(/^[0-9a-f]{64}$/);
		expect(serverCredential).toBe(await deriveServerCredential(ADMIN_SECRET));
	});

	it('is not ADMIN_SECRET itself', () => {
		expect(serverCredential).not.toBe(ADMIN_SECRET);
	});
});

// Test stand-in for SvelteKit's `$env/static/private` virtual module. Aliased in
// via vitest.config.ts so server helpers (admin.ts, ip.ts) have deterministic
// secrets during unit tests. Individual tests can override with vi.doMock to
// exercise the "secret not configured" branches.
export const ADMIN_SECRET = 'test-admin-secret-value';
export const IP_HASH_SECRET = 'test-ip-hash-secret';

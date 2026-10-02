import { defineEnvVars } from '@sveltejs/kit/env';

/** @param {string | undefined} input */
const optional = (input) => input ?? '';

export const variables = defineEnvVars({
	PUBLIC_CONVEX_URL: { public: true, static: true },
	// Set on `process.env` by vite.config.ts from `git log`, so they exist at
	// build time and nowhere else — inlined, not read when the app starts.
	PUBLIC_GIT_COMMIT: { public: true, static: true, schema: optional },
	PUBLIC_GIT_COMMIT_DATE: { public: true, static: true, schema: optional },
	ADMIN_SECRET: { static: true },
	IP_HASH_SECRET: { static: true }
});

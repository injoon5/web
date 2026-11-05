/**
 * End-to-end check of a production build: `npm run test:e2e`.
 *
 * Starts a fake Convex HTTP API (scripts/e2e/fake-convex.mjs), builds the site
 * against it, serves the build with `vite preview`, and drives it in Chromium
 * (scripts/e2e/checks.mjs). Pass `--no-build` to reuse the last build — it must
 * have been built against the fake (PUBLIC_CONVEX_URL=http://127.0.0.1:3299).
 *
 * Needs Playwright's Chromium: `npx playwright install chromium` on a machine
 * that does not already have it.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { startFakeConvex } from './e2e/fake-convex.mjs';
import { runChecks } from './e2e/checks.mjs';

const CONVEX_PORT = 3299;
const PREVIEW_PORT = 4173;
const origin = `http://localhost:${PREVIEW_PORT}`;

/** ADMIN_SECRET as the build will see it: the environment, else .env. */
function adminSecret() {
	if (process.env.ADMIN_SECRET) return process.env.ADMIN_SECRET;
	const line = readFileSync('.env', 'utf8')
		.split('\n')
		.find((l) => l.startsWith('ADMIN_SECRET='));
	return (
		line
			?.slice('ADMIN_SECRET='.length)
			.trim()
			.replace(/^["']|["']$/g, '') ?? ''
	);
}

const env = { ...process.env, PUBLIC_CONVEX_URL: `http://127.0.0.1:${CONVEX_PORT}` };
const convex = await startFakeConvex({ port: CONVEX_PORT, adminSecret: adminSecret() });

if (!process.argv.includes('--no-build')) {
	console.log('Building against the fake Convex…');
	const build = spawnSync('npm', ['run', 'build'], { env, stdio: ['ignore', 'ignore', 'inherit'] });
	if (build.status !== 0) {
		convex.close();
		process.exit(build.status ?? 1);
	}
}

const preview = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
	env,
	stdio: 'ignore',
	detached: true
});

// If the checks throw, the finally block still tears the servers down and the
// error exits non-zero on its own.
/** @type {number} */
let failures;
try {
	for (let i = 0; i < 60; i++) {
		const up = await fetch(origin).then(
			() => true,
			() => false
		);
		if (up) break;
		await new Promise((r) => setTimeout(r, 500));
	}
	failures = await runChecks(origin, convex);
} finally {
	if (preview.pid) process.kill(-preview.pid);
	convex.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

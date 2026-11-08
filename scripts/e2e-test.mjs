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
import { existsSync } from 'node:fs';
import { startFakeConvex } from './e2e/fake-convex.mjs';
import { runChecks } from './e2e/checks.mjs';

const CONVEX_PORT = 3299;
const PREVIEW_PORT = 4173;
const origin = `http://localhost:${PREVIEW_PORT}`;

// ADMIN_SECRET as the build will see it: the environment, else .env.
if (existsSync('.env')) process.loadEnvFile('.env');

const env = { ...process.env, PUBLIC_CONVEX_URL: `http://127.0.0.1:${CONVEX_PORT}` };
const convex = await startFakeConvex({
	port: CONVEX_PORT,
	adminSecret: process.env.ADMIN_SECRET ?? ''
});

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
	let up = false;
	for (let i = 0; i < 60 && !up; i++) {
		up = await fetch(origin).then(
			() => true,
			() => false
		);
		if (!up) await new Promise((r) => setTimeout(r, 500));
	}
	if (!up) throw new Error(`vite preview never answered at ${origin}`);
	failures = await runChecks(origin, convex);
} finally {
	if (preview.pid) process.kill(-preview.pid);
	convex.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

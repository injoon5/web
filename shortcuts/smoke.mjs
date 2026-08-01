#!/usr/bin/env node
/**
 * Replay the Shortcut payloads against a live deployment.
 *
 * Run this before building anything in the Shortcuts app: if it prints `ok`,
 * the endpoint and the key are good, and any later failure is app-side.
 *
 *   HEALTH_API_KEY=<key> node shortcuts/smoke.mjs https://<deployment>.convex.site
 *
 * It writes real rows. The dates in the fixtures are fixed, so a run leaves five
 * day rows on that date, four heart-rate samples, and two workouts — re-running
 * is idempotent rather than additive.
 */

import { readFile } from 'node:fs/promises';

const base = (process.argv[2] ?? '').replace(/\/$/, '');
const key = process.env.HEALTH_API_KEY;

if (!base || !key) {
	console.error(
		'usage: HEALTH_API_KEY=<key> node shortcuts/smoke.mjs https://<deployment>.convex.site'
	);
	process.exit(2);
}

const here = new URL('./payloads/', import.meta.url);
const load = async (name) => JSON.parse(await readFile(new URL(name, here), 'utf8'));

const auth = { Authorization: `Bearer ${key}` };
let failed = false;

function report(label, ok, detail) {
	console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
	if (!ok) failed = true;
}

async function post(name) {
	const res = await fetch(`${base}/health/ingest`, {
		method: 'POST',
		headers: { ...auth, 'Content-Type': 'application/json' },
		body: JSON.stringify(await load(name))
	});
	const body = await res.json().catch(() => ({}));
	report(
		`POST /health/ingest (${name})`,
		res.ok,
		res.ok
			? `${body.metrics ?? 0} metrics, ${body.samplesInserted ?? 0} new samples, ` +
					`${(body.workoutsInserted ?? 0) + (body.workoutsUpdated ?? 0)} workouts`
			: `${res.status} ${body.error ?? ''}`
	);
}

async function get(path, describe) {
	const res = await fetch(`${base}${path}`, { headers: auth });
	const body = await res.json().catch(() => ({}));
	report(`GET ${path}`, res.ok, res.ok ? describe(body) : `${res.status} ${body.error ?? ''}`);
}

// An unauthenticated call must be refused — worth knowing before the key ends
// up in a Shortcut on a phone.
const open = await fetch(`${base}/health`);
report('GET /health without a key', open.status === 401, `got ${open.status}`);

await post('metrics-hourly.json');
await post('workouts-daily.json');

await get('/health', (b) => `latest ${b.latestDate}, ${Object.keys(b.metrics).length} metrics`);
await get(
	'/health/series?metrics=steps,restingHeartRate&days=30',
	(b) => `${b.series.length} series of ${b.series[0]?.count} points from ${b.startDate}`
);
await get('/health/workouts?days=365', (b) => `${b.workouts.length} workouts`);

process.exit(failed ? 1 : 0);

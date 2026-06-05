import { OG_FIXTURES, OG_FIXTURE_IDS } from '$lib/og/fixtures.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	const origin = url.origin;
	const cards = OG_FIXTURE_IDS.map((id) => {
		const fixture = OG_FIXTURES[id];
		const src = `${origin}/api/og?fixture=${encodeURIComponent(id)}`;
		const sub = fixture.description
			? fixture.description.slice(0, 100) + (fixture.description.length > 100 ? '\u2026' : '')
			: '';

		return `
			<section class="card">
				<header>
					<h2><a href="${src}">${escapeHtml(id)}</a></h2>
					<p class="meta">${escapeHtml(fixture.template)}${sub ? ` · ${escapeHtml(sub)}` : ''}</p>
				</header>
				<div class="previews">
					<figure>
						<img src="${src}" width="600" height="315" alt="${escapeHtml(id)} full" loading="lazy" />
						<figcaption>600px (50%)</figcaption>
					</figure>
					<figure class="thumb">
						<img src="${src}" width="400" height="210" alt="${escapeHtml(id)} thumb" loading="lazy" />
						<figcaption>400px (~social preview)</figcaption>
					</figure>
				</div>
			</section>`;
	}).join('\n');

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="robots" content="noindex" />
	<title>OG card test</title>
	<style>
		* { box-sizing: border-box; }
		body {
			margin: 0;
			padding: 32px 24px 64px;
			font-family: system-ui, sans-serif;
			background: #0a0a0a;
			color: #e5e5e5;
			line-height: 1.5;
		}
		h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 8px; letter-spacing: -0.02em; }
		.lead { color: #a3a3a3; margin: 0 0 32px; max-width: 52rem; font-size: 0.95rem; }
		.lead code { font-size: 0.9em; color: #d4d4d4; }
		.grid { display: flex; flex-direction: column; gap: 40px; max-width: 72rem; }
		.card header { margin-bottom: 12px; }
		.card h2 { margin: 0; font-size: 1.1rem; font-weight: 600; }
		.card h2 a { color: inherit; text-decoration: none; }
		.card h2 a:hover { text-decoration: underline; }
		.meta { margin: 4px 0 0; font-size: 0.85rem; color: #737373; }
		.previews {
			display: flex;
			flex-wrap: wrap;
			gap: 24px;
			align-items: flex-start;
		}
		figure { margin: 0; }
		figure img {
			display: block;
			width: 100%;
			height: auto;
			border-radius: 8px;
			border: 1px solid #262626;
			background: #111;
		}
		figure:first-child { flex: 1 1 600px; max-width: 600px; }
		figure.thumb { flex: 0 0 400px; max-width: 400px; }
		figcaption {
			margin-top: 8px;
			font-size: 0.75rem;
			color: #737373;
		}
	</style>
</head>
<body>
	<h1>OG card test</h1>
	<p class="lead">
		Fixture gallery for <code>/api/og</code>. Render a single card with
		<code>?fixture=lg-ai-blog</code> or pass <code>template</code> / <code>title</code> manually.
	</p>
	<div class="grid">${cards}</div>
</body>
</html>`;

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'no-store'
		}
	});
}

/** @param {string} s */
function escapeHtml(s) {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

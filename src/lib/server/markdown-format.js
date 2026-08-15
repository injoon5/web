// @ts-check
import { homeSchema } from '$lib/seo/jsonld.js';
import { PAGE_METRICS } from '$lib/health/metrics.js';
import { SITE_URL } from './sitemap.js';

/** @typedef {import('$lib/types').Post} Post */
/** @typedef {import('$lib/types').Project} Project */
/** @typedef {Record<string, unknown>} Metadata */

/**
 * YAML frontmatter. Only fields with a value are emitted, matching Cloudflare's
 * Markdown-for-Agents layout.
 *
 * @param {Record<string, string | undefined | null>} fields
 */
export function yamlFrontmatter(fields) {
	const lines = [];
	for (const [key, value] of Object.entries(fields)) {
		if (value == null || value === '') continue;
		lines.push(`${key}: ${yamlEscape(value)}`);
	}
	if (lines.length === 0) return '';
	return `---\n${lines.join('\n')}\n---\n\n`;
}

/** @param {string} value */
function yamlEscape(value) {
	if (/[:#{}[\],&*?|>!%@`'"]/.test(value) || value !== value.trim()) {
		return JSON.stringify(value);
	}
	return value;
}

/**
 * Rewrite root-relative markdown links (`](/x)`) to absolute URLs so the
 * document still resolves off-site. Already-absolute, hash, and mailto targets
 * are left alone.
 *
 * @param {string} markdown
 * @param {string} origin
 */
export function absolutizeMarkdown(markdown, origin) {
	return markdown.replace(/\]\((\/[^)]*)\)/g, (_m, path) => `](${origin}${path})`);
}

/**
 * @param {string} markdown
 * @param {unknown} schema
 */
export function withJsonLd(markdown, schema) {
	return `${markdown.trimEnd()}\n\n\`\`\`json\n${JSON.stringify(schema, null, '\t')}\n\`\`\`\n`;
}

/**
 * @param {{ title: string, href: string, description?: string, when?: string }} item
 */
function listItem(item) {
	const when = item.when ? ` (${item.when})` : '';
	const description = item.description?.trim() ? ` — ${item.description.trim()}` : '';
	return `- [${item.title}](${item.href})${description}${when}`;
}

/**
 * @param {{ title: string, description: string, items: { title: string, href: string, description?: string, when?: string }[] }} opts
 */
export function listingMarkdown({ title, description, items }) {
	return [
		yamlFrontmatter({ title, description }),
		`# ${title}`,
		'',
		description,
		'',
		...items.map(listItem),
		''
	].join('\n');
}

/**
 * @param {{ posts: Post[], projects: Project[] }} opts
 */
export function homeMarkdown({ posts, projects }) {
	const description =
		'Injoon Oh (오인준) — a student interested in math, science, and computers. Blog, projects, and more.';
	const body = [
		yamlFrontmatter({
			title: 'Injoon Oh',
			description,
			image: `${SITE_URL}/api/og?template=home`
		}),
		'# Injoon Oh',
		'',
		'I am a student who is interested in math, science, and computers.',
		'',
		"I love exploring new concepts and getting to know cool new things. Whether it's tackling complex equations, researching about scientific stuff, or trying the latest tech, I'm always eager to learn.",
		'',
		'Although I have not decided the specific domain due to the industry evolving so rapidly, I want to be a computer programmer when I grow up.',
		'',
		'## Blog',
		'',
		...posts.map((post) =>
			listItem({
				title: post.title,
				href: `${SITE_URL}/blog/${post.slug}`,
				description: post.description,
				when: post.date
			})
		),
		'',
		'## Projects',
		'',
		...projects.map((project) =>
			listItem({
				title: project.title,
				href: `${SITE_URL}/projects/${project.slug}`,
				description: project.description,
				when: project.year
			})
		),
		'',
		'## Elsewhere',
		'',
		`- [Now](${SITE_URL}/now) — what I'm doing now`,
		`- [Health](${SITE_URL}/health) — Apple Watch metrics`,
		`- [RSS](${SITE_URL}/rss.xml)`,
		''
	].join('\n');
	return withJsonLd(body, homeSchema());
}

export function nowMarkdown() {
	const description = 'What Injoon Oh is doing now.';
	return [
		yamlFrontmatter({
			title: 'Now — Injoon Oh',
			description,
			image: `${SITE_URL}/api/og?template=now`
		}),
		'# Now',
		'',
		description,
		'',
		`The live page is at ${SITE_URL}/now.`,
		''
	].join('\n');
}

export function healthMarkdown() {
	const description = 'Steps, movement and energy, straight off an Apple Watch.';
	return [
		yamlFrontmatter({
			title: 'Health — Injoon Oh',
			description,
			image: `${SITE_URL}/api/og?template=health`
		}),
		'# Health',
		'',
		description,
		'',
		'Daily metrics from an Apple Watch:',
		'',
		...PAGE_METRICS.map((metric) => `- ${metric.label}`),
		'',
		`The charts live at ${SITE_URL}/health.`,
		''
	].join('\n');
}

/**
 * Pick the published raw source for one slug. Korean is the site default;
 * `lang=en` (or the language cookie) selects English when that twin exists.
 *
 * @param {Record<string, string>} rawEn
 * @param {Record<string, string>} rawKo
 * @param {Record<string, unknown>} metaEn
 * @param {Record<string, unknown>} metaKo
 * @param {string} kind  `'blog'` | `'projects'`
 * @param {string} slug
 * @param {string | null | undefined} langPref
 * @returns {{ raw: string, meta: Metadata, lang: 'en' | 'ko' } | null}
 */
export function pickArticle(rawEn, rawKo, metaEn, metaKo, kind, slug, langPref) {
	const enKey = `/src/content/${kind}/en/${slug}.md`;
	const koKey = `/src/content/${kind}/ko/${slug}.md`;
	const enMeta = /** @type {Metadata | undefined} */ (metaEn[enKey]);
	const koMeta = /** @type {Metadata | undefined} */ (metaKo[koKey]);
	const enRaw = enMeta?.published === true ? rawEn[enKey] : undefined;
	const koRaw = koMeta?.published === true ? rawKo[koKey] : undefined;
	if (!enRaw && !koRaw) return null;

	const preferEn = langPref === 'en';
	if (preferEn && enRaw && enMeta) return { raw: enRaw, meta: { ...enMeta, slug }, lang: 'en' };
	if (koRaw && koMeta) return { raw: koRaw, meta: { ...koMeta, slug }, lang: 'ko' };
	if (enRaw && enMeta) return { raw: enRaw, meta: { ...enMeta, slug }, lang: 'en' };
	return null;
}

/** @param {string | undefined} cover */
export function coverUrl(cover) {
	if (!cover) return undefined;
	if (/^https?:\/\//i.test(cover)) return cover;
	return `${SITE_URL}${cover.startsWith('/') ? cover : `/${cover}`}`;
}

/** @param {string} path */
export function notFoundMarkdown(path) {
	return yamlFrontmatter({ title: 'Not found' }) + `# Not found\n\nNo page at ${path}.\n`;
}

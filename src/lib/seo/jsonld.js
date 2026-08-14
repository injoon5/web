// @ts-check

/**
 * The canonical origin. This module runs in the browser, so it can't reach into
 * `$lib/server/*` — the value is a public constant and lives here directly.
 */
const SITE_URL = 'https://www.injoon5.com';

/** The author's romanised and Korean names, kept together so search for either resolves. */
export const AUTHOR_NAME = 'Injoon Oh';
export const AUTHOR_NAME_KO = '오인준';

/**
 * The site's author, referenced by every schema. `alternateName` carries the
 * Korean name (오인준) so a Person/Article result can be matched by it — the
 * structured-data half of ranking for the name.
 */
const PERSON = {
	'@type': 'Person',
	name: AUTHOR_NAME,
	alternateName: AUTHOR_NAME_KO,
	url: SITE_URL,
	email: 'me@injoon5.com',
	sameAs: ['https://github.com/injoon5']
};

/**
 * A frontmatter language code (`ko`|`en`) as a BCP-47 tag for `inLanguage`.
 * @param {string | undefined} lang
 */
function bcp47(lang) {
	return lang === 'en' ? 'en-US' : 'ko-KR';
}

/**
 * Drop keys whose value is null/undefined/'' (or an empty array) so the emitted
 * JSON-LD carries no empty fields — an empty `description` or `keywords` is
 * worse than an absent one.
 * @template {Record<string, unknown>} T
 * @param {T} obj
 * @returns {T}
 */
function compact(obj) {
	return /** @type {T} */ (
		Object.fromEntries(
			Object.entries(obj).filter(
				([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0)
			)
		)
	);
}

/**
 * Build the keyword list every content page shares: the author's two names lead
 * (so the site is discoverable by 오인준 / Injoon Oh), then the page's own terms.
 * De-duplicated, blanks dropped.
 * @param {(string | undefined | null)[]} extra
 * @returns {string[]}
 */
export function keywordsFor(extra = []) {
	const all = [AUTHOR_NAME_KO, AUTHOR_NAME, ...extra];
	return [...new Set(all.map((k) => (k ?? '').trim()).filter(Boolean))];
}

/**
 * BlogPosting schema for a `/blog/[slug]` page.
 * @param {{ title: string, description?: string, date?: string, url: string, image?: string, lang?: string, keywords?: string[], section?: string }} p
 */
export function blogPostingSchema({
	title,
	description,
	date,
	url,
	image,
	lang,
	keywords,
	section
}) {
	return compact({
		'@context': 'https://schema.org',
		'@type': 'BlogPosting',
		headline: title,
		description,
		datePublished: date,
		dateModified: date,
		inLanguage: bcp47(lang),
		keywords: keywords ?? [],
		articleSection: section,
		author: PERSON,
		publisher: PERSON,
		image: image ? [image] : undefined,
		url,
		mainEntityOfPage: { '@type': 'WebPage', '@id': url }
	});
}

/**
 * CreativeWork schema for a `/projects/[slug]` page.
 * @param {{ title: string, description?: string, year?: string, url: string, image?: string, lang?: string, keywords?: string[] }} p
 */
export function projectSchema({ title, description, year, url, image, lang, keywords }) {
	return compact({
		'@context': 'https://schema.org',
		'@type': 'CreativeWork',
		name: title,
		description,
		dateCreated: year,
		inLanguage: bcp47(lang),
		keywords: keywords ?? [],
		author: PERSON,
		image: image ? [image] : undefined,
		url
	});
}

/**
 * BreadcrumbList schema. `items` are `{ name, url }` in trail order (Home first).
 * Gives search results the "site › section › page" trail instead of a bare URL.
 * @param {{ name: string, url: string }[]} items
 */
export function breadcrumbSchema(items) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: item.name,
			item: item.url
		}))
	};
}

/**
 * WebSite + Person graph for the home page. Both names ride along so a search
 * for 오인준 or Injoon Oh resolves to the site and its owner.
 */
export function homeSchema() {
	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebSite',
				name: `${AUTHOR_NAME} (${AUTHOR_NAME_KO})`,
				alternateName: AUTHOR_NAME_KO,
				url: SITE_URL,
				inLanguage: 'ko-KR'
			},
			{
				...PERSON,
				jobTitle: 'Student',
				description: 'A student who is interested in math, science, and computers.'
			}
		]
	};
}

/**
 * Serialise a schema object as a ready-to-inject `<script type="application/ld+json">`
 * tag. `<` is escaped so a value containing `</script>` can never break the tag.
 * @param {unknown} schema
 */
export function jsonLdScript(schema) {
	return `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`;
}

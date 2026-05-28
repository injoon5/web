/**
 * OG image templates.
 *
 * Each function returns a satori-compatible React element tree
 * (plain objects with { type, props, children } shape).
 * Dimensions: 1200 x 630
 *
 * Type scale is tuned for thumbnail readability: stronger weights,
 * gentler tracking (especially Hangul), and higher contrast.
 */

export const WIDTH = 1200;
export const HEIGHT = 630;

// ── Shared palette ──────────────────────────────────────────────
const bg = '#0a0a0a';
const textPrimary = '#fafafa';
const textSecondary = '#c4c4c4';
const textMuted = '#8f8f8f';
const borderColor = '#2e2e2e';
const dotColor = '#161616';
const font = 'Pretendard';

// Non-title type scale (labels, body, descriptions, meta, footer, tags)
const type = {
	label: 26,
	body: 34,
	description: 32,
	meta: 28,
	footerName: 30,
	footerUrl: 28,
	tag: 22
};

// ── Typography helpers ──────────────────────────────────────────

const CJK_RE = /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/;

/** Rough visual width for mixed Latin / Hangul titles. */
function titleVisualLength(str) {
	if (!str) return 0;
	let len = 0;
	for (const ch of str) {
		len += CJK_RE.test(ch) ? 1.75 : 1;
	}
	return len;
}

function hasCjk(str) {
	return CJK_RE.test(str || '');
}

/** Letter-spacing: Latin can tighten slightly; Hangul needs neutral tracking. */
function tracking(str, { latin = '-0.025em', cjk = '-0.008em', neutral = '-0.012em' } = {}) {
	if (!str) return neutral;
	const cjkChars = [...str].filter((ch) => CJK_RE.test(ch)).length;
	const ratio = cjkChars / Math.max(str.length, 1);
	if (ratio >= 0.35) return cjk;
	if (ratio <= 0.1) return latin;
	return neutral;
}

function titleFontSize(str, sizes = [58, 50, 44]) {
	const vlen = titleVisualLength(str);
	if (vlen > 52) return sizes[2];
	if (vlen > 34) return sizes[1];
	return sizes[0];
}

function truncate(str, max) {
	if (!str) return '';
	return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

function formatDate(dateStr) {
	if (!dateStr) return '';
	try {
		const d = new Date(dateStr);
		return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', year: 'numeric' });
	} catch {
		return dateStr;
	}
}

/** Primary heading block (list pages, home). */
function displayText(children, { cjk = false } = {}) {
	return {
		type: 'span',
		props: {
			style: {
				fontSize: cjk ? 70 : 76,
				fontWeight: 700,
				color: textPrimary,
				letterSpacing: cjk ? '-0.01em' : '-0.03em',
				lineHeight: cjk ? 1.22 : 1.12
			},
			children
		}
	};
}

/** Article / project title with length-aware sizing. */
function titleText(str, fallback = '제목 없음') {
	const text = truncate(str || fallback, 80);
	return {
		type: 'div',
		props: {
			style: {
				fontSize: titleFontSize(text),
				fontWeight: 700,
				color: textPrimary,
				letterSpacing: tracking(text, { latin: '-0.028em', cjk: '-0.006em' }),
				lineHeight: hasCjk(text) ? 1.28 : 1.2,
				maxWidth: 1000
			},
			children: text
		}
	};
}

/** Secondary body copy. */
function bodyText(children, { marginTop = 22, maxWidth = 780 } = {}) {
	return {
		type: 'p',
		props: {
			style: {
				fontSize: type.body,
				fontWeight: 500,
				color: textSecondary,
				lineHeight: 1.55,
				marginTop,
				maxWidth,
				letterSpacing: hasCjk(children) ? '-0.004em' : '-0.01em'
			},
			children
		}
	};
}

/** Post / project description paragraph. */
function descriptionText(str) {
	if (!str) return null;
	return {
		type: 'p',
		props: {
			style: {
				fontSize: type.description,
				fontWeight: 500,
				color: textSecondary,
				lineHeight: 1.52,
				marginTop: 20,
				maxWidth: 900,
				letterSpacing: tracking(str, { latin: '-0.01em', cjk: '-0.002em' })
			},
			children: truncate(str, 120)
		}
	};
}

/** Date, year, and other tertiary lines. */
function metaText(children, { marginTop = 20 } = {}) {
	return {
		type: 'span',
		props: {
			style: {
				fontSize: type.meta,
				fontWeight: 500,
				color: textMuted,
				marginTop,
				letterSpacing: '-0.004em',
				lineHeight: 1.35
			},
			children
		}
	};
}

// ── Layout ──────────────────────────────────────────────────────

function container(children) {
	return {
		type: 'div',
		props: {
			style: {
				width: WIDTH,
				height: HEIGHT,
				display: 'flex',
				flexDirection: 'column',
				backgroundColor: bg,
				fontFamily: font,
				position: 'relative',
				overflow: 'hidden'
			},
			children: [
				{
					type: 'div',
					props: {
						style: {
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							backgroundImage: `radial-gradient(circle at 1px 1px, ${dotColor} 1px, transparent 0)`,
							backgroundSize: '40px 40px',
							opacity: 0.45
						}
					}
				},
				{
					type: 'div',
					props: {
						style: {
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							height: 2,
							background: `linear-gradient(90deg, transparent, ${borderColor} 25%, ${textMuted} 50%, ${borderColor} 75%, transparent)`
						}
					}
				},
				{
					type: 'div',
					props: {
						style: {
							display: 'flex',
							flexDirection: 'column',
							width: '100%',
							height: '100%',
							padding: '60px 68px 44px',
							position: 'relative',
							zIndex: 1
						},
						children
					}
				}
			]
		}
	};
}

function bottomBar(name = 'Injoon Oh') {
	return {
		type: 'div',
		props: {
			style: {
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				marginTop: 'auto',
				paddingTop: 22,
				borderTop: `1px solid ${borderColor}`
			},
			children: [
				{
					type: 'span',
					props: {
						style: {
							fontSize: type.footerName,
							fontWeight: 600,
							color: textSecondary,
							letterSpacing: '-0.008em'
						},
						children: name
					}
				},
				{
					type: 'span',
					props: {
						style: {
							fontSize: type.footerUrl,
							fontWeight: 500,
							color: textMuted,
							letterSpacing: '0.01em'
						},
						children: 'injoon5.com'
					}
				}
			]
		}
	};
}

function label(text) {
	return {
		type: 'span',
		props: {
			style: {
				display: 'flex',
				fontSize: type.label,
				fontWeight: 600,
				color: textMuted,
				letterSpacing: tracking(text, { latin: '-0.012em', cjk: '0', neutral: '-0.006em' }),
				marginBottom: 14
			},
			children: text
		}
	};
}

function mainColumn(children) {
	return {
		type: 'div',
		props: {
			style: {
				display: 'flex',
				flexDirection: 'column',
				flex: 1,
				justifyContent: 'center'
			},
			children
		}
	};
}

// ── Templates ───────────────────────────────────────────────────

export function homeTemplate() {
	return container([
		mainColumn([
			displayText('Injoon Oh'),
			bodyText('A student interested in math, science, and computers.', { marginTop: 26 })
		]),
		bottomBar()
	]);
}

export function blogListTemplate() {
	return container([
		mainColumn([
			label('Injoon Oh'),
			displayText('블로그', { cjk: true }),
			bodyText('겨우 온라인에 올린 글들.', { marginTop: 22 })
		]),
		bottomBar()
	]);
}

export function blogPostTemplate({ title, description, date }) {
	return container([
		mainColumn([
			label('블로그'),
			titleText(title),
			...(description ? [descriptionText(description)] : []),
			...(date ? [metaText(formatDate(date))] : [])
		]),
		bottomBar()
	]);
}

export function projectsListTemplate() {
	return container([
		mainColumn([
			label('Injoon Oh'),
			displayText('Projects'),
			bodyText('Some of the stuff I did to escape from a boring day.', { marginTop: 22 })
		]),
		bottomBar()
	]);
}

export function projectTemplate({ title, description, year, tags }) {
	return container([
		mainColumn([
			label('프로젝트'),
			titleText(title),
			...(description ? [descriptionText(description)] : []),
			{
				type: 'div',
				props: {
					style: {
						display: 'flex',
						alignItems: 'center',
						flexWrap: 'wrap',
						gap: 10,
						marginTop: 20
					},
					children: [
						...(year ? [metaText(year, { marginTop: 0 })] : []),
						...(tags && tags.length > 0
							? [
									...(year
										? [
												{
													type: 'span',
													props: {
														style: {
															fontSize: type.meta,
															color: textMuted,
															fontWeight: 500
														},
														children: '\u00B7'
													}
												}
											]
										: []),
									...tags.slice(0, 4).map((tag) => ({
										type: 'span',
										props: {
											style: {
												fontSize: type.tag,
												fontWeight: 600,
												color: textSecondary,
												border: `1px solid ${borderColor}`,
												borderRadius: 999,
												padding: '7px 18px',
												letterSpacing: tracking(tag, {
													latin: '-0.01em',
													cjk: '0'
												})
											},
											children: tag
										}
									}))
								]
							: [])
					]
				}
			}
		]),
		bottomBar()
	]);
}

export function nowTemplate() {
	return container([
		mainColumn([
			label('Injoon Oh'),
			displayText('Now'),
			bodyText("What I'm doing now.", { marginTop: 22 })
		]),
		bottomBar()
	]);
}

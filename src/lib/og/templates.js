/**
 * OG image templates.
 *
 * Each function returns a satori-compatible React element tree
 * (plain objects with { type, props, children } shape).
 * Dimensions: 1200 x 630
 */

const WIDTH = 1200;
const HEIGHT = 630;

// ── Shared palette ──────────────────────────────────────────────
const bg = '#0a0a0a';
const textPrimary = '#fafafa';
const textSecondary = '#a3a3a3';
const textMuted = '#737373';
const borderColor = '#262626';
const dotColor = '#1a1a1a';
const font = 'Pretendard';

// ── Helpers ─────────────────────────────────────────────────────

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

/** Wrapping container with background pattern */
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
				// Subtle dot grid pattern
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
							backgroundSize: '32px 32px',
							opacity: 0.8
						}
					}
				},
				// Top accent line
				{
					type: 'div',
					props: {
						style: {
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							height: 2,
							background: `linear-gradient(90deg, transparent, ${borderColor} 20%, ${textMuted} 50%, ${borderColor} 80%, transparent)`
						}
					}
				},
				// Content wrapper
				{
					type: 'div',
					props: {
						style: {
							display: 'flex',
							flexDirection: 'column',
							width: '100%',
							height: '100%',
							padding: '64px 72px 48px',
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

/** Bottom bar with site URL and name */
function bottomBar(name = 'Injoon Oh') {
	return {
		type: 'div',
		props: {
			style: {
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				marginTop: 'auto',
				paddingTop: 24,
				borderTop: `1px solid ${borderColor}`
			},
			children: [
				{
					type: 'span',
					props: {
						style: {
							fontSize: 24,
							fontWeight: 500,
							color: textSecondary,
							letterSpacing: '-0.01em'
						},
						children: name
					}
				},
				{
					type: 'span',
					props: {
						style: {
							fontSize: 22,
							fontWeight: 400,
							color: textMuted,
							letterSpacing: '0.02em'
						},
						children: 'injoon5.com'
					}
				}
			]
		}
	};
}

/** Small label (no uppercase) */
function label(text) {
	return {
		type: 'span',
		props: {
			style: {
				display: 'flex',
				fontSize: 20,
				fontWeight: 500,
				color: textMuted,
				letterSpacing: '-0.01em',
				marginBottom: 12
			},
			children: text
		}
	};
}

// ── Templates ───────────────────────────────────────────────────

export function homeTemplate() {
	return container([
		{
			type: 'div',
			props: {
				style: {
					display: 'flex',
					flexDirection: 'column',
					flex: 1,
					justifyContent: 'center'
				},
				children: [
					{
						type: 'span',
						props: {
							style: {
								fontSize: 88,
								fontWeight: 700,
								color: textPrimary,
								letterSpacing: '-0.04em',
								lineHeight: 1.05
							},
							children: 'Injoon Oh'
						}
					},
					{
						type: 'p',
						props: {
							style: {
								fontSize: 32,
								fontWeight: 400,
								color: textSecondary,
								lineHeight: 1.4,
								marginTop: 24,
								maxWidth: 800,
								letterSpacing: '-0.015em'
							},
							children: 'A student interested in math, science, and computers.'
						}
					}
				]
			}
		},
		bottomBar()
	]);
}

export function blogListTemplate() {
	return container([
		{
			type: 'div',
			props: {
				style: {
					display: 'flex',
					flexDirection: 'column',
					flex: 1,
					justifyContent: 'center'
				},
				children: [
					label('Injoon Oh'),
					{
						type: 'span',
						props: {
							style: {
								fontSize: 72,
								fontWeight: 700,
								color: textPrimary,
								letterSpacing: '-0.04em',
								lineHeight: 1.1
							},
							children: '블로그'
						}
					},
					{
						type: 'p',
						props: {
							style: {
								fontSize: 28,
								fontWeight: 400,
								color: textSecondary,
								lineHeight: 1.4,
								marginTop: 20,
								maxWidth: 750,
								letterSpacing: '-0.01em'
							},
							children: '겨우 온라인에 올린 글들.'
						}
					}
				]
			}
		},
		bottomBar()
	]);
}

export function blogPostTemplate({ title, description, date }) {
	const longTitle = title && title.length > 40;
	return container([
		{
			type: 'div',
			props: {
				style: {
					display: 'flex',
					flexDirection: 'column',
					flex: 1,
					justifyContent: 'center'
				},
				children: [
					label('블로그'),
					{
						type: 'span',
						props: {
							style: {
								fontSize: longTitle ? 48 : 64,
								fontWeight: 700,
								color: textPrimary,
								letterSpacing: '-0.035em',
								lineHeight: 1.15,
								maxWidth: 1000
							},
							children: truncate(title || '제목 없음', 80)
						}
					},
					...(description
						? [
								{
									type: 'p',
									props: {
										style: {
											fontSize: 26,
											fontWeight: 400,
											color: textSecondary,
											lineHeight: 1.45,
											marginTop: 18,
											maxWidth: 900,
											letterSpacing: '-0.01em'
										},
										children: truncate(description, 120)
									}
								}
							]
						: []),
					...(date
						? [
								{
									type: 'span',
									props: {
										style: {
											fontSize: 22,
											fontWeight: 500,
											color: textMuted,
											marginTop: 22,
											letterSpacing: '-0.005em'
										},
										children: formatDate(date)
									}
								}
							]
						: [])
				]
			}
		},
		bottomBar()
	]);
}

export function projectsListTemplate() {
	return container([
		{
			type: 'div',
			props: {
				style: {
					display: 'flex',
					flexDirection: 'column',
					flex: 1,
					justifyContent: 'center'
				},
				children: [
					label('Injoon Oh'),
					{
						type: 'span',
						props: {
							style: {
								fontSize: 72,
								fontWeight: 700,
								color: textPrimary,
								letterSpacing: '-0.04em',
								lineHeight: 1.1
							},
							children: '프로젝트'
						}
					},
					{
						type: 'p',
						props: {
							style: {
								fontSize: 28,
								fontWeight: 400,
								color: textSecondary,
								lineHeight: 1.4,
								marginTop: 20,
								maxWidth: 750,
								letterSpacing: '-0.01em'
							},
							children: '지루한 하루를 피하기 위해 했던 것들.'
						}
					}
				]
			}
		},
		bottomBar()
	]);
}

export function projectTemplate({ title, description, year, tags }) {
	const longTitle = title && title.length > 40;
	return container([
		{
			type: 'div',
			props: {
				style: {
					display: 'flex',
					flexDirection: 'column',
					flex: 1,
					justifyContent: 'center'
				},
				children: [
					label('프로젝트'),
					{
						type: 'span',
						props: {
							style: {
								fontSize: longTitle ? 48 : 64,
								fontWeight: 700,
								color: textPrimary,
								letterSpacing: '-0.035em',
								lineHeight: 1.15,
								maxWidth: 1000
							},
							children: truncate(title || '제목 없음', 80)
						}
					},
					...(description
						? [
								{
									type: 'p',
									props: {
										style: {
											fontSize: 26,
											fontWeight: 400,
											color: textSecondary,
											lineHeight: 1.45,
											marginTop: 18,
											maxWidth: 900,
											letterSpacing: '-0.01em'
										},
										children: truncate(description, 120)
									}
								}
							]
						: []),
					{
						type: 'div',
						props: {
							style: {
								display: 'flex',
								alignItems: 'center',
								gap: 12,
								marginTop: 22
							},
							children: [
								...(year
									? [
											{
												type: 'span',
												props: {
													style: {
														fontSize: 22,
														fontWeight: 500,
														color: textMuted
													},
													children: year
												}
											}
										]
									: []),
								...(tags && tags.length > 0
									? [
											...(year
												? [
														{
															type: 'span',
															props: {
																style: { fontSize: 22, color: textMuted },
																children: '\u00B7'
															}
														}
													]
												: []),
											...tags.slice(0, 4).map((tag) => ({
												type: 'span',
												props: {
													style: {
														fontSize: 16,
														fontWeight: 500,
														color: textSecondary,
														border: `1px solid ${borderColor}`,
														borderRadius: 999,
														padding: '5px 14px'
													},
													children: tag
												}
											}))
										]
									: [])
							]
						}
					}
				]
			}
		},
		bottomBar()
	]);
}

export function nowTemplate() {
	return container([
		{
			type: 'div',
			props: {
				style: {
					display: 'flex',
					flexDirection: 'column',
					flex: 1,
					justifyContent: 'center'
				},
				children: [
					label('Injoon Oh'),
					{
						type: 'span',
						props: {
							style: {
								fontSize: 72,
								fontWeight: 700,
								color: textPrimary,
								letterSpacing: '-0.04em',
								lineHeight: 1.1
							},
							children: 'Now'
						}
					},
					{
						type: 'p',
						props: {
							style: {
								fontSize: 28,
								fontWeight: 400,
								color: textSecondary,
								lineHeight: 1.4,
								marginTop: 20,
								maxWidth: 750,
								letterSpacing: '-0.01em'
							},
							children: "What I'm doing now."
						}
					}
				]
			}
		},
		bottomBar()
	]);
}

// @ts-check

/**
 * The site's Content Signals preference. Duplicated into `static/robots.txt`
 * (a static file cannot import this) — keep the two in lockstep. Tests assert
 * they match.
 *
 * search: cite and index. ai-input: agents may ground on the page (the reason
 * markdown negotiation exists). ai-train: do not use the text to train models.
 *
 * @see https://contentsignals.org/
 */
export const CONTENT_SIGNAL = 'ai-train=no, search=yes, ai-input=yes';

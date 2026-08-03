import { adjustCount } from './counter.js';

const TABLE = 'commentUrlCounts';

export function incrementUrlCount(ctx, url) {
	return adjustCount(ctx, TABLE, url, 1);
}

/**
 * Apply a whole batch of counted URLs at once — one read-modify-write per
 * distinct URL rather than per comment. Hard-deleting a thread retires up to
 * 200 comments that all share one URL.
 *
 * @param {Map<string, number>} deltas  url -> signed change
 */
export async function applyUrlCountDeltas(ctx, deltas) {
	for (const [url, delta] of deltas) {
		if (delta !== 0) await adjustCount(ctx, TABLE, url, delta);
	}
}

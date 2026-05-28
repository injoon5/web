import { incrementCount, decrementCount } from './counter.js';

const TABLE = 'commentUrlCounts';

export function incrementUrlCount(ctx, url) {
	return incrementCount(ctx, TABLE, url);
}

export function decrementUrlCount(ctx, url) {
	return decrementCount(ctx, TABLE, url);
}

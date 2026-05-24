import { ConvexError } from 'convex/values';

export function isAdmin(secret) {
	return Boolean(process.env.ADMIN_SECRET) && secret === process.env.ADMIN_SECRET;
}

export function assertServer(secret) {
	if (!isAdmin(secret)) {
		throw new ConvexError({ kind: 'Unauthorized' });
	}
}

export function assertAdmin(secret) {
	if (!isAdmin(secret)) {
		throw new ConvexError({ kind: 'Unauthorized' });
	}
}

import { ConvexError } from 'convex/values';
import { secretsMatch } from './secrets.js';

export async function isAdmin(secret) {
	return (
		Boolean(process.env.ADMIN_SECRET) && (await secretsMatch(secret, process.env.ADMIN_SECRET))
	);
}

export async function assertAdmin(secret) {
	if (!(await isAdmin(secret))) {
		throw new ConvexError({ kind: 'Unauthorized' });
	}
}

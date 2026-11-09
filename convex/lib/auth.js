import { secretsMatch } from './crypto.js';
import { fail } from './errors.js';

export async function isAdmin(secret) {
	return secretsMatch(secret, process.env.ADMIN_SECRET);
}

export async function assertAdmin(secret) {
	if (!(await isAdmin(secret))) fail('Unauthorized');
}

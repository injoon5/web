import { createHmac, timingSafeEqual } from 'crypto';
import { ADMIN_SECRET } from '$env/static/private';

export function secretsMatch(candidate: string): boolean {
	if (!ADMIN_SECRET) return false;
	const a = createHmac('sha256', ADMIN_SECRET).update(candidate).digest();
	const b = createHmac('sha256', ADMIN_SECRET).update(ADMIN_SECRET).digest();
	return timingSafeEqual(a, b);
}

export function verifyAdminSecret(request: Request): boolean {
	const header = request.headers.get('x-admin-secret');
	if (header) return secretsMatch(header);

	const cookie = request.headers.get('cookie') ?? '';
	const match = cookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
	if (match) return secretsMatch(decodeURIComponent(match[1]));

	return false;
}

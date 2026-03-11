import { env } from '$env/dynamic/private';

export function verifyAdminSecret(request: Request): boolean {
	const header = request.headers.get('x-admin-secret');
	if (!env.ADMIN_SECRET || !header) return false;
	return header === env.ADMIN_SECRET;
}

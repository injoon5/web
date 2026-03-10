import { ADMIN_SECRET } from '$env/static/private';

export function verifyAdminSecret(request) {
	const header = request.headers.get('x-admin-secret');
	if (!ADMIN_SECRET || !header) return false;
	return header === ADMIN_SECRET;
}

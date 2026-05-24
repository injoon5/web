import { verifyAdminCookie } from '$lib/server/admin';

export const load = async ({ cookies }) => {
	return { isAdmin: verifyAdminCookie(cookies.get('admin_token')) };
};

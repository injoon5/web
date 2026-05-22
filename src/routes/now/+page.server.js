import { ADMIN_SECRET } from '$env/static/private';

export const load = async ({ cookies }) => {
	const token = cookies.get('admin_token');
	const isAdmin = Boolean(ADMIN_SECRET && token === ADMIN_SECRET);
	return { isAdmin };
};

import { secretsMatch } from '$lib/server/admin';

export const load = async ({ cookies }) => {
	const token = cookies.get('admin_token');
	return { isAdmin: secretsMatch(token ?? '') };
};

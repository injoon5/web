import { type Handle } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { building } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
    event.locals.id = '';
    event.locals.email = '';
    event.locals.pb = new PocketBase('https://pb.injoon5.com');

    const isBlogPost = event.url.pathname.startsWith('/blog/') && event.url.pathname !== '/blog/';
    const isAuth = event.url.pathname === '/auth';

    if (building || !isBlogPost || isAuth) {
        return await resolve(event);
    }

    const pb_auth = event.request.headers.get('cookie') ?? '';
    event.locals.pb.authStore.loadFromCookie(pb_auth);

    try {
        if (event.locals.pb.authStore.isValid) {
            const auth = await event.locals.pb
                .collection('users')
                .authRefresh<{ id: string; email: string }>();
            event.locals.id = auth.record.id;
            event.locals.email = auth.record.email;
        }
    } catch (_) {
        event.locals.pb.authStore.clear();
    }

    const response = await resolve(event);

    // Create a new response with the updated headers
    const newResponse = new Response(response.body, response);

    // Export the auth cookie and append it to the new response headers
    const cookie = event.locals.pb.authStore.exportToCookie({ sameSite: 'lax' });
    newResponse.headers.append('set-cookie', cookie);

    return newResponse;
};
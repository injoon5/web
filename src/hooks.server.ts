import { redirect, type Handle } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { building } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
    event.locals.id = '';
    event.locals.email = '';
    event.locals.pb = new PocketBase('https://pb.injoon5.com');

    const isAuth: boolean = event.url.pathname === '/auth';
    if (isAuth || building) {
        event.cookies.set('pb_auth', '', { path: '/' });
        return await resolve(event);
    }

    const pb_auth = event.request.headers.get('cookie') ?? '';
    event.locals.pb.authStore.loadFromCookie(pb_auth);

    try {
        const auth = await event.locals.pb
            .collection('users')
            .authRefresh<{ id: string; email: string }>();
        event.locals.id = auth.record.id;
        event.locals.email = auth.record.email;
    } catch (_) {
        event.locals.pb.authStore.clear();
    }

    // Resolve the event and get the response
    const originalResponse = await resolve(event);

    // Clone the response to make it mutable
    const response = new Response(originalResponse.body, {
        status: originalResponse.status,
        statusText: originalResponse.statusText,
        headers: new Headers(originalResponse.headers),
    });

    // Export the auth cookie and append it to the response headers
    const cookie = event.locals.pb.authStore.exportToCookie({ sameSite: 'lax' });
    response.headers.append('set-cookie', cookie);

    return response;
};
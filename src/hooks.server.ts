import { redirect, type Handle } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { building } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
    event.locals.id = '';
    event.locals.pb = new PocketBase('https://pb.injoon5.com');

    const isAuth: boolean = event.url.pathname === '/auth';
    if (isAuth || building) {
        event.cookies.set('pb_auth', '', { path: '/' });  // Specify the path here
        return await resolve(event);
    }

    const pb_auth = event.request.headers.get('cookie') ?? '';
    event.locals.pb.authStore.loadFromCookie(pb_auth);

    try {
        const auth = await event.locals.pb
            .collection('users')
            .authRefresh<{ id: string }>();
        event.locals.id = auth.record.id;
    } catch (_) {}


    const response = await resolve(event);
    const cookie = event.locals.pb.authStore.exportToCookie({ sameSite: 'lax', path: '/' });  // Specify the path here
    response.headers.append('set-cookie', cookie);
    return response;
};
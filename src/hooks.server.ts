import { redirect, type Handle } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { building } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
    // Initialize PocketBase and local variables
    event.locals.pb = new PocketBase('http://localhost:8080');
    event.locals.id = '';
    event.locals.email = '';

    // Load authentication state from cookies
    const pb_auth = event.request.headers.get('cookie') ?? '';
    event.locals.pb.authStore.loadFromCookie(pb_auth);

    // Determine if the current route requires authentication
    const authRequiredRoutes = ['/dashboard', '/profile']; // Add any routes that need authentication
    const isAuthRoute = authRequiredRoutes.some(route => event.url.pathname.startsWith(route));

    if (isAuthRoute && !building) {
        try {
            // Attempt to refresh the authentication token
            const auth = await event.locals.pb
                .collection('users')
                .authRefresh<{ id: string; email: string }>();

            // Set local variables
            event.locals.id = auth.record.id;
            event.locals.email = auth.record.email;
        } catch (_) {
            // Redirect to the login page if authentication fails
            throw redirect(303, '/auth');
        }

        if (!event.locals.id) {
            // Ensure the user is redirected to auth if ID is still not set
            throw redirect(303, '/auth');
        }
    }

    // Continue to resolve the request
    const response = await resolve(event);

    // Export the authentication state to cookies
    const cookie = event.locals.pb.authStore.exportToCookie({
        sameSite: 'lax',
        secure: !building, // Use secure cookies in production
    });

    // Append the set-cookie header to the response
    response.headers.append('set-cookie', cookie);

    return response;
};
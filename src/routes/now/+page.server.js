// Prerendered: the content comes from a client-side Convex subscription and the
// owner-only Edit affordance is gated client-side (GET /api/admin/whoami), so the
// page needs nothing from the server per request and is served straight off the CDN.
export const prerender = true;

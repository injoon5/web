import { id } from '@instantdb/admin';
import { db } from './db/index.ts';

const RATE_LIMITS = {
  comment: { limit: 3, windowMs: 10 * 60 * 1000 },
  vote: { limit: 30, windowMs: 60 * 1000 },
  like: { limit: 10, windowMs: 60 * 1000 },
  edit: { limit: 5, windowMs: 10 * 60 * 1000 },
};

/**
 * Check whether `ipHash` has exceeded the rate limit for `action`.
 * Returns { limited: true, retryAfter: seconds } or { limited: false }.
 */
export async function checkRateLimit(ipHash, action) {
  const config = RATE_LIMITS[action];
  if (!config) throw new Error(`Unknown rate-limit action: ${action}`);

  const since = new Date(Date.now() - config.windowMs).toISOString();

  const { rateLimits } = await db.query({
    rateLimits: {
      $: {
        where: {
          ipHash,
          action,
          createdAt: { $gt: since },
        },
      },
    },
  });

  if (rateLimits.length >= config.limit) {
    // Find the oldest entry in the window to calculate when the window expires
    const oldest = rateLimits.reduce((a, b) =>
      new Date(a.createdAt) < new Date(b.createdAt) ? a : b
    );
    const retryAfter = Math.max(
      1,
      Math.ceil((new Date(oldest.createdAt).getTime() + config.windowMs - Date.now()) / 1000)
    );
    return { limited: true, retryAfter };
  }

  return { limited: false };
}

/**
 * Record a rate-limit event for `ipHash` + `action`.
 * Call this after a successful (non-limited) request.
 */
export async function logRateLimit(ipHash, action) {
  await db.transact(
    db.tx.rateLimits[id()].update({
      ipHash,
      action,
      createdAt: new Date().toISOString(),
    })
  );
}

/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as backfill from "../backfill.js";
import type * as bans from "../bans.js";
import type * as commentActions from "../commentActions.js";
import type * as comments from "../comments.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_bans from "../lib/bans.js";
import type * as lib_commentsScan from "../lib/commentsScan.js";
import type * as lib_migration from "../lib/migration.js";
import type * as lib_secrets from "../lib/secrets.js";
import type * as lib_serialize from "../lib/serialize.js";
import type * as lib_urlCounts from "../lib/urlCounts.js";
import type * as lib_votes from "../lib/votes.js";
import type * as likes from "../likes.js";
import type * as now from "../now.js";
import type * as rateLimits from "../rateLimits.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  backfill: typeof backfill;
  bans: typeof bans;
  commentActions: typeof commentActions;
  comments: typeof comments;
  "lib/auth": typeof lib_auth;
  "lib/bans": typeof lib_bans;
  "lib/commentsScan": typeof lib_commentsScan;
  "lib/migration": typeof lib_migration;
  "lib/secrets": typeof lib_secrets;
  "lib/serialize": typeof lib_serialize;
  "lib/urlCounts": typeof lib_urlCounts;
  "lib/votes": typeof lib_votes;
  likes: typeof likes;
  now: typeof now;
  rateLimits: typeof rateLimits;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};

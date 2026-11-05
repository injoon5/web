/** Content file paths: `/src/content/blog/ko/us-camp.md` → `us-camp`. */

/** @param {string} path */
export const slugFromPath = (path) => path.split('/').at(-1)?.replace('.md', '') ?? '';

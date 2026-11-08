/**
 * What a comment may be: shared by the Convex mutations, the Zod schemas in
 * `src/lib/server/validation.js` and the comment forms, so the three cannot
 * disagree about a limit.
 */

export const MAX_DEPTH = 2;
export const MAX_TEXT_LENGTH = 200;
export const MAX_USERNAME_LENGTH = 32;
export const MIN_PASSWORD_LENGTH = 4;
export const MAX_REPLY_LENGTH = 1000;
export const ANONYMOUS = 'Anonymous';

/**
 * A soft-deleted comment keeps its row, so the replies under it keep their
 * place in the thread, and has its text and username replaced by this marker.
 *
 * The marker is the state: there is no separate flag. So no live comment may
 * carry it as its text (or it renders as deleted), and a soft-deleted comment
 * may not be edited (or its owner brings it back under the name `[deleted]`).
 */
export const DELETED_TEXT = '[deleted]';

/** @param {{ text: string }} doc */
export function isSoftDeleted(doc) {
	return doc.text === DELETED_TEXT;
}

/**
 * Why `text` (already trimmed) cannot be a comment, or null if it can.
 * @param {string} text
 */
export function commentTextError(text) {
	if (text.length === 0) return 'Comment cannot be empty';
	if (text.length > MAX_TEXT_LENGTH) {
		return `Comment must be ${MAX_TEXT_LENGTH} characters or less`;
	}
	if (text === DELETED_TEXT) return `A comment cannot say only ${DELETED_TEXT}`;
	return null;
}

/**
 * Why `username` (already trimmed) cannot be one, or null if it can.
 * @param {string} username
 */
export function usernameError(username) {
	return username.length > MAX_USERNAME_LENGTH
		? `Username must be ${MAX_USERNAME_LENGTH} characters or less`
		: null;
}

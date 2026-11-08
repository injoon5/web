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

/** @param {string} text */
export function isReservedText(text) {
	return text.trim() === DELETED_TEXT;
}

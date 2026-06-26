/**
 * Select up to maxComments by score, always including ancestors of any selected reply.
 */
export function selectTopWithAncestors(active, maxComments, commentScore) {
	const byScore = (a, b) => {
		const scoreDiff = commentScore(b) - commentScore(a);
		if (scoreDiff !== 0) return scoreDiff;
		return b._creationTime - a._creationTime;
	};

	const sorted = [...active].sort(byScore);
	const byId = new Map(sorted.map((d) => [d._id, d]));
	const selected = new Map();

	const selectWithAncestors = (doc) => {
		let cur = doc;
		while (cur && !selected.has(cur._id)) {
			selected.set(cur._id, cur);
			cur = cur.parentId ? byId.get(cur.parentId) : null;
		}
	};

	for (const doc of sorted) {
		if (selected.size >= maxComments) break;
		selectWithAncestors(doc);
	}

	return [...selected.values()].sort(byScore);
}

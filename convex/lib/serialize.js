export function publicComment(doc, { upvotes, downvotes, myVote }) {
	return {
		id: doc._id,
		url: doc.url,
		username: doc.username,
		text: doc.text,
		reply: doc.reply,
		parentId: doc.parentId,
		depth: doc.depth,
		createdAt: doc._creationTime,
		updatedAt: doc.updatedAt,
		upvotes,
		downvotes,
		score: upvotes - downvotes,
		myVote
	};
}

export function adminComment(doc, { upvotes, downvotes }) {
	return {
		id: doc._id,
		url: doc.url,
		username: doc.username,
		text: doc.text,
		ipHash: doc.ipHash,
		parentId: doc.parentId,
		depth: doc.depth,
		reply: doc.reply,
		createdAt: doc._creationTime,
		updatedAt: doc.updatedAt,
		upvotes,
		downvotes
	};
}

export function publicBan(doc) {
	return {
		id: doc._id,
		ipHash: doc.ipHash,
		reason: doc.reason,
		createdAt: doc._creationTime
	};
}

export function buildTree(flat) {
	const map = new Map();
	for (const c of flat) map.set(c.id, { ...c, children: [] });

	const roots = [];
	for (const node of map.values()) {
		if (node.parentId && map.has(node.parentId)) {
			map.get(node.parentId).children.push(node);
		} else if (!node.parentId) {
			roots.push(node);
		} else {
			roots.push({ ...node, stray: true });
		}
	}

	for (const node of map.values()) {
		node.children.sort((a, b) => a.createdAt - b.createdAt);
	}

	return roots;
}

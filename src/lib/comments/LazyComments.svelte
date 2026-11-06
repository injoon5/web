<script>
	/**
	 * Defers the comment thread until it nears the viewport.
	 *
	 * `CommentsSection` is a ~1.5K-line, Convex-subscribed, form-heavy subtree that
	 * always sits at the very foot of an article — never part of the first screen.
	 * Mounting it only as the reader approaches keeps it, and everything it pulls
	 * in (the comment tree, the reply forms, the vote counter), out of the
	 * article's initial JS. The 400px rootMargin starts the fetch before the
	 * sentinel is actually on screen, so in practice the section is already there
	 * by the time the reader arrives.
	 *
	 * The wrapper keeps `id="comments"` so a deep link to the anchor still resolves
	 * on load: the browser scrolls to this element, which brings it into view and
	 * trips the observer, loading the thread it was pointing at.
	 *
	 * The first Tab on the page loads it too. Focus does not scroll the page until
	 * it lands, so a keyboard reader would otherwise tab straight from the
	 * article's last link to the footer, past a section that was not there yet.
	 */
	let Comments = $state(null);

	/** @param {HTMLElement} node */
	function whenNear(node) {
		const load = () => {
			io.disconnect();
			removeEventListener('keydown', onKey);
			import('#lib/comments/CommentsSection.svelte').then((m) => (Comments = m.default));
		};
		/** @param {KeyboardEvent} e */
		const onKey = (e) => {
			if (e.key === 'Tab') load();
		};
		const io = new IntersectionObserver(([entry]) => entry.isIntersecting && load(), {
			rootMargin: '400px'
		});
		io.observe(node);
		addEventListener('keydown', onKey);
		return {
			destroy() {
				io.disconnect();
				removeEventListener('keydown', onKey);
			}
		};
	}
</script>

<div id="comments" use:whenNear>
	{#if Comments}
		<Comments />
	{/if}
</div>

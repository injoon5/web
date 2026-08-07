// True while the home hero name is on screen; the navbar name fades in once it
// scrolls out of view. Defaults to true so the home page's first paint keeps the
// navbar name hidden without a flash. Non-home pages ignore it.
let visible = $state(true);

export const heroName = {
	get visible() {
		return visible;
	},
	set visible(next) {
		visible = next;
	}
};

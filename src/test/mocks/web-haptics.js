// Test stand-in for `web-haptics/svelte` (no real haptics in jsdom).
export function createWebHaptics() {
	return { trigger: () => {}, destroy: () => {} };
}

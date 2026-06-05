// Reactive stand-in for convex-svelte's `useQuery` result: a $state-backed
// object whose getters are tracked by the component's $derived/$effect, plus a
// `set()` to simulate realtime pushes from the server.
export function createReactiveQuery(initial = {}) {
	const s = $state({
		data: undefined,
		isLoading: false,
		isStale: false,
		error: null,
		...initial
	});
	return {
		get data() {
			return s.data;
		},
		get isLoading() {
			return s.isLoading;
		},
		get isStale() {
			return s.isStale;
		},
		get error() {
			return s.error;
		},
		set(next) {
			Object.assign(s, next);
		}
	};
}

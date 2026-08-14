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

// Reactive stand-in for convex-svelte's `usePaginatedQuery` result. Same idea
// as above, plus the pagination surface. Tests simulate navigation by updating
// with the previous page's results retained (same array) and `isLoading: true`,
// exactly like `keepPreviousData` behaves on an args change.
export function createReactivePaginatedQuery(initial = {}) {
	const { loadMore, ...rest } = initial;
	const s = $state({
		results: [],
		status: 'LoadingFirstPage',
		isLoading: true,
		error: null,
		...rest
	});
	return {
		get results() {
			return s.results;
		},
		get status() {
			return s.status;
		},
		get isLoading() {
			return s.isLoading;
		},
		get error() {
			return s.error;
		},
		loadMore: loadMore ?? (() => false),
		set(next) {
			Object.assign(s, next);
		}
	};
}

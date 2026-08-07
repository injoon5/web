declare global {
	/**
	 * Baked in by `vite.config.ts`: true on preview deployments and `vite dev`,
	 * false in production. A literal rather than an env read, so the /health
	 * tuning panel is dead code Rollup can drop rather than a chunk production
	 * downloads and never opens.
	 */
	const __DIALS__: boolean;

	namespace App {
		// interface Error {}
		interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}
}

export {};

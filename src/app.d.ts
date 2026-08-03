import '@fontsource/newsreader/200-italic.css';
import '@fontsource/newsreader/300-italic.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/newsreader/500-italic.css';
import '@fontsource/newsreader/600-italic.css';
import '@fontsource/newsreader/700-italic.css';
import '@fontsource/newsreader/800-italic.css';
import '@fontsource/newsreader/200.css';
import '@fontsource/newsreader/300.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/600.css';
import '@fontsource/newsreader/700.css';
import '@fontsource/newsreader/800.css';
import '@fontsource/inter';

declare global {
	/**
	 * Baked in by `vite.config.ts`: true on preview deployments and `vite dev`,
	 * false in production. A literal rather than an env read, so the /health
	 * tuning panel is dead code Rollup can drop rather than a chunk production
	 * downloads and never opens.
	 */
	const __HEALTH_DIALS__: boolean;

	namespace App {
		// interface Error {}
		interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}
}

export {};

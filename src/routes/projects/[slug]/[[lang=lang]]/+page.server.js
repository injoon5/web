// Only `entries`, deliberately: a server *load* here would put a function round
// trip in front of every client-side navigation to a project.
import { articleEntries } from '#lib/server/article-index.js';

export const entries = () => articleEntries('projects');

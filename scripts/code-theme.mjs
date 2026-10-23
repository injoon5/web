// Write the code-block palette out of @pierre/highlights. Run after bumping the
// package; src/lib/markdown/code-theme.test.js fails until you do.
import { writeFile } from 'node:fs/promises';
import { codeThemeCss } from '../src/lib/markdown/code-theme.js';

const out = new URL('../src/lib/markdown/code-theme.css', import.meta.url);
await writeFile(out, codeThemeCss());
console.log(`wrote ${out.pathname}`);

import { writable } from 'svelte/store';

// True while the home hero name is on screen. The navbar name fades in once it
// scrolls out of view. Defaults to true so the home page's first paint (at the
// top, hero in view) keeps the navbar name hidden without a flash. Non-home
// pages ignore this and always show the name.
export const heroNameVisible = writable(true);

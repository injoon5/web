import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const stored = browser ? localStorage.getItem('lang') : null;
export const lang = writable(stored ?? 'en');

if (browser) {
	lang.subscribe((v) => localStorage.setItem('lang', v));
}

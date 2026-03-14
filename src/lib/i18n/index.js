import { derived } from 'svelte/store';
import { lang } from '$lib/stores/lang.js';
import en from './en.js';
import ko from './ko.js';

const translations = { en, ko };

export const t = derived(lang, ($lang) => translations[$lang] ?? translations.en);

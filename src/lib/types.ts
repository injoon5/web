export type TagsList = 'sveltekit' | 'svelte';
export type Types = 'blog' | 'book' | 'note';
export type Languages = 'python' | 'JavaScript' | 'Swift' | 'C (C++)';

export type Post = {
	type: Types[];
	title: string;
	slug: string;
	description: string;
	date: string;
	coverimage: string;
	tags: TagsList[];
	published: boolean;
	hasEn?: boolean;
};

export type Project = {
	title: string;
	slug: string;
	description: string;
	year: string;
	tags: TagsList[];
	coverimage: string;
	published: boolean;
	hasEn?: boolean;
};

export type Book = {
	title: string;
	slug: string;
	author: string;
	description: string;
	/** When the book was finished (or started, for one still being read). */
	date: string;
	/** 0–5, half steps allowed. */
	rating?: number;
	/** Cloth name from `CLOTHS` in `$lib/books/bookStyle.js`, or a raw hex. */
	color?: string;
	/** Page count — drives how thick the spine is on the shelf. */
	pages?: number;
	/** Front cover artwork; falls back to a stamped cloth cover when absent. */
	cover?: string;
	/** Spine artwork; falls back to stamped cloth + foil type when absent. */
	spine?: string;
	reading?: boolean;
	published: boolean;
	hasEn?: boolean;
};

export type Tags = {
	name: string;
	slug: string;
	description: string;
};

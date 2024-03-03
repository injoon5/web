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
};

export type Project = {
	title: string;
	slug: string;
	description: string;
	year: string;
	tags: TagsList[];
	coverimage: string;
	published: boolean;
};

export type Tags = {
	name: string;
	slug: string;
	description: string;
};

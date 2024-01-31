export type Categories = 'sveltekit' | 'svelte';
export type Languages = 'Python' | 'JavaScript' | 'Swift' | 'C (C++)';

export type Post = {
	title: string;
	slug: string;
	description: string;
	date: string;
	categories: Categories[];
	published: boolean;
};

export type Project = {
	title: string;
	slug: string;
	description: string;
	year: string;
	language: Languages[];
	published: boolean;
};

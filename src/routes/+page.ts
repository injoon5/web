import type { LoadEvent } from '@sveltejs/kit';

export const prerender = true;

export const load = async ({ fetch }: LoadEvent) => {
	const [postResponse, projectsResponse] = await Promise.all([
		fetch(`/api/posts`),
		fetch(`/api/projects`)
	]);
	const [posts, projects] = await Promise.all([postResponse.json(), projectsResponse.json()]);

	const techstack = [
		{
			name: 'Web Development',
			technologies: [
				{
					name: 'SvelteKit',
					description:
						"I really like SvelteKit because it's a fast framework that's easy to learn and use. This very website is built with SvelteKit too. ",
					link: 'https://svelte.dev'
				},
				{
					name: 'Next.js',
					description:
						'Next.js is a powerful framework for building web applications. I know how to use it.. but not really. Honestly too much for me. ',
					link: 'https://nextjs.org'
				},
				{
					name: 'Tailwind CSS',
					description:
						'I really should learn REAL CSS one day... but for now, Tailwind is saving me from being frustrated with CSS. ',
					link: 'https://tailwindcss.com'
				}
			]
		},
		{
			name: 'App Development',
			technologies: [
				{
					name: 'Swift',
					description:
						"Swift is a cool language developed by Apple. It's cool that its fast and has a nice syntax at the same time. (Except that string manipulation is a real pain to use)",
					link: 'https://developer.apple.com/swift/'
				},
				{
					name: 'SwiftUI',
					description:
						"This is by far one of my favorite UI frameworks. The joy of using all the cool components made by Apple is uncomparable. The limited platforms it can run on is a bit of a downside, but ironically that's why it's so intuitive to use.",
					link: 'https://developer.apple.com/xcode/swiftui/'
				}
			]
		},
		{
			name: 'Other Languages',
			technologies: [
				{
					name: 'Python',
					description:
						"One of my first text-based programming languages I learned. It's a great language for rapidly building things. I know performance isn't the best, but I haven't faced this as a problem yet.",
					link: 'https://www.python.org'
				},
				{
					name: 'C',
					description:
						"I've learned the basics of C a few years ago. While it helped me get familiar to the low-level concepts of programming, I don't really use the language much since it isn't object-oriented.",
					link: 'https://en.wikipedia.org/wiki/C_(programming_language)'
				},
				{
					name: 'C++',
					description:
						"After learning C, I learned C++. It's a great low level language for building things. I use it for some of my projects, but it's not my go-to language for most things.",
					link: 'https://en.wikipedia.org/wiki/C%2B%2B'
				},
				{
					name: 'JavaScript',
					description:
						"I've been using JavaScript for a while now. It has some weird quirks that always confuses me, but it's a great language for building web applications. I'm pretty comfortable with using now.",
					link: 'https://en.wikipedia.org/wiki/JavaScript'
				}
			]
		},
		{
			name: 'Infrastructure & Tools',
			technologies: [
				{
					name: 'Vercel',
					description:
						"It's a great platform to deploy stuff and I love what they're providing. They also care a lot about design engineering, so the dashboard is a really great reference to look at.",
					link: 'https://vercel.com'
				},
				{
					name: 'Convex',
					description:
						"The ultimate database for building real-time applications. I'm enjoying the amazing DX of it and love the realtime sync, cron jobs and CRDT that comes by default. ",
					link: 'https://convex.dev'
				},
				{
					name: 'Raspberry Pi',
					description:
						"A nice single board computer. I have a Raspberry Pi 5 and a Pi 4B running some services at home. I know it could be used for hardware projects too, but for now it's just sitting there on my desk. Check out DietPi too. ",
					link: 'https://raspberrypi.com'
				},
				{
					name: 'Git',
					description:
						"I'm that guy who just adds, commits and pushes. Would love to learn more about Git someday. ",
					link: 'https://git-scm.com'
				},
				{
					name: 'Figma',
					description:
						"I design almost everything in Figma. It's a great tool for designing and prototyping. I'm really impressed with the WASM too. ",
					link: 'https://figma.com'
				},
				{
					name: 'Obsidian',
					description:
						"I've finally settled down with Obsidian. It's a great note-taking app that's really fast and easy to use. I like everything about it. So everything I've written is stored in my vault.",
					link: 'https://obsidian.md'
				},
				{
					name: 'MacBook Pro',
					description:
						"I'm currently using a MacBook Pro with an M2 Pro chip. It's easily the best notebook I've ever had. Never worried about performance on this beast.",
					link: 'https://apple.com/mac/macbook-pro'
				}
			]
		}
	];

	return {
		posts,
		projects,
		techstack
	};
};

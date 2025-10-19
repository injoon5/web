// export const prerender = true;

import type { LoadEvent } from "@sveltejs/kit";

export const load = async ({ fetch }: LoadEvent) => {
	const postResponse = await fetch(`/api/posts`);
	if (!postResponse.ok) {
		const text = await postResponse.text();
		console.error('Fetch failed:', postResponse.status, text);
	}

	const projectsResponse = await fetch(`/api/projects`);
	if (!projectsResponse.ok) {
		const text = await projectsResponse.text();
		console.error('Fetch failed:', projectsResponse.status, text);
	}
	const projects = await projectsResponse.json();

	const nowlisteningResponse = await fetch(
		`https://raw.githubusercontent.com/injoon5/data/main/now-playing.json`,
		{ cache: "no-store" },
	);
	const nowlistening = await nowlisteningResponse.json();

	const photosResponse = await fetch(
		`https://raw.githubusercontent.com/injoon5/data/main/photos.json`,
		{ cache: "no-store" },
	);
	const photos = await photosResponse.json();

	// Load tech stack descriptions
	const techstackDescriptions = {
		Svelte:
			"A modern web framework that compiles your components to vanilla JavaScript at build time, resulting in smaller bundles and better performance.",
		"Next.js":
			"A React framework for production with features like server-side rendering, static site generation, and API routes built-in.",
		"Tailwind CSS":
			"A utility-first CSS framework that allows you to build custom designs without leaving your HTML.",
		SWR: "A data fetching library for React that provides caching, revalidation, and error handling out of the box.",
		"shadcn/ui":
			"A collection of reusable components built using Radix UI and Tailwind CSS, designed to be copy-pasted into your project.",
		Zod: "A TypeScript-first schema validation library that helps you validate data at runtime and provides type safety.",
		Swift:
			"Apple's programming language for iOS, macOS, watchOS, and tvOS development, known for its safety and performance.",
		SwiftUI:
			"Apple's declarative UI framework for building user interfaces across all Apple platforms using Swift.",
		"Core Data":
			"Apple's object graph and persistence framework for managing model layer objects in your application.",
		Alamofire:
			"An HTTP networking library for iOS and macOS that provides an elegant interface for making network requests.",
		Pow: "A Swift library that provides a clean API for making HTTP requests with built-in support for authentication and error handling.",
		Python:
			"A high-level programming language known for its simplicity and readability, widely used in data science, web development, and automation.",
		PyGame:
			"A cross-platform set of Python modules designed for writing video games, providing functionality for graphics, sound, and input handling.",
		PyQt: "A set of Python bindings for the Qt application framework, used for creating desktop applications with native look and feel.",
		Pandas:
			"A powerful data manipulation and analysis library for Python, providing data structures and functions for working with structured data.",
		NumPy:
			"A fundamental package for scientific computing in Python, providing support for large, multi-dimensional arrays and matrices.",
		Matplotlib:
			"A plotting library for Python that provides an object-oriented API for embedding plots into applications.",
		YOLOv8:
			"The latest version of the YOLO (You Only Look Once) object detection algorithm, known for its speed and accuracy.",
		TensorFlow:
			"An open-source machine learning platform developed by Google, used for building and deploying ML models.",
		C: "A general-purpose programming language that provides low-level access to memory and is widely used in system programming.",
		"C++":
			"An extension of C with object-oriented programming features, commonly used in game development and system programming.",
		JavaScript:
			"A high-level programming language that is one of the core technologies of the World Wide Web, alongside HTML and CSS.",
		Vercel:
			"A cloud platform for static sites and serverless functions, optimized for frontend frameworks like Next.js.",
		"Raspberry Pi":
			"A series of small single-board computers that can be used for various projects, from home automation to robotics.",
		Docker:
			"A containerization platform that allows you to package applications and their dependencies into lightweight, portable containers.",
		PocketBase:
			"A lightweight backend-as-a-service that provides a real-time database, authentication, and file storage.",
		Supabase:
			"An open-source Firebase alternative that provides a PostgreSQL database, authentication, and real-time subscriptions.",
		Git: "A distributed version control system designed to handle everything from small to very large projects with speed and efficiency.",
		GitHub:
			"A web-based platform for version control and collaboration using Git, hosting millions of open-source projects.",
		Figma:
			"A collaborative interface design tool that runs in the browser, allowing teams to design, prototype, and iterate together.",
		Cursor:
			"An AI-powered code editor built on VS Code that helps developers write code faster and more efficiently.",
		Obsidian:
			"A powerful knowledge management tool that uses markdown files and creates a graph of connections between your notes.",
		"MacBook Pro":
			"Apple's professional laptop series, known for its performance, build quality, and integration with the Apple ecosystem.",
	};

	const techstack = [
		{
			name: "Web Development",
			technologies: [
				{
					name: "SvelteKit",
					description:
						"I really like SvelteKit because it's a fast framework that's easy to learn and use. It's perfect for my small side projects because it makes development faster with its concise syntax and common features like store built-in. This very website is built with SvelteKit too. ",
					link: "https://svelte.dev",
				},
				{
					name: "Next.js",
					description:
						"Next.js is a powerful framework for building web applications. I know some bits of it from trying it in some of my projects, but it has some parts optimised for enterprise stuff which makes things harder for me. ",
					link: "https://nextjs.org",
				},
				{
					name: "Tailwind CSS",
					description:
						"I really should learn REAL CSS one day... but for now, Tailwind is saving me from being frustrated with CSS. ",
					link: "https://tailwindcss.com",
				},
			],
		},
		{
			name: "App Development",
			technologies: [
				{
					name: "Swift",
					description:
						"Swift is a cool language developed by Apple for their platforms. I've been using it for a while now and it's a great language for building apps. (Except that string manipulation is a real pain to use)",
					link: "https://developer.apple.com/swift/",
				},
				{
					name: "SwiftUI",
					description:
						"This is by far one of my favorite UI frameworks. The joy of using all the cool components in a simple way is amazing. The limited platforms it can run on is a bit of a downside, but ironically that's why it's so intuitive to use.",
					link: "https://developer.apple.com/xcode/swiftui/",
				},
			],
		},
		{
			name: "Other Languages",
			technologies: [
				{
					name: "Python",
					description:
						"One of my first text-based programming languages I learned. It's a great language for rapidly building things. I'm a big fan of it's simple syntax. I know performance isn't the best, but I haven't faced this as a problem yet.",
					link: "https://www.python.org",
				},
				{
					name: "C",
					description:
						"I've learned the basics of C a few years ago. While it helped me get familiar to the low-level concepts of programming, I don't really use the language much since it isn't object-oriented.",
					link: "https://en.wikipedia.org/wiki/C_(programming_language)",
				},
				{
					name: "C++",
					description:
						"After learning C, I learned C++. It's a great low level language for building things. I use it for some of my projects, but it's not my go-to language for most things.",
					link: "https://en.wikipedia.org/wiki/C%2B%2B",
				},
				{
					name: "JavaScript",
					description:
						"I've been using JavaScript for a while now. It has some weird quirks that always confuses me, but it's a great language for building web applications. I'm pretty comfortable with using now.",
					link: "https://en.wikipedia.org/wiki/JavaScript",
				},
			],
		},
		{
			name: "Infrastructure & Tools",
			technologies: [
				{
					name: "Vercel",
					description:
						"It's a great platform to deploy stuff and I love what they're providing. They also care a lot about design engineering, so the dashboard is a really great reference to look at.",
					link: "https://vercel.com",
				},
				{
					name: "Convex",
					description:
						"The ultimate database for building real-time applications. I'm enjoying the amazing DX of it and love the realtime sync, cron jobs and CRDT that comes by default. ",
					link: "https://convex.dev",
				},
				{
					name: "Raspberry Pi",
					description:
						"A nice single board computer. I have a Raspberry Pi 5 and a Pi 4B running some services at home. I know it could be used for hardware projects too, but for now it's just sitting there on my desk. Check out DietPi too. ",
					link: "https://raspberrypi.com",
				},
				{
					name: "Git",
					description:
						"I'm that guy who just adds, commits and pushes. Would love to learn more about Git someday. ",
					link: "https://git-scm.com",
				},
				{
					name: "Figma",
					description:
						"I design almost everything in Figma. It's a great tool for designing and prototyping. I'm really impressed with the WASM too. ",
					link: "https://figma.com",
				},
				{
					name: "Obsidian",
					description:
						"I've finally settled down with Obsidian. It's a great note-taking app that's really fast and easy to use. I like everything about it; the design, the developer, the features... Everything I've written is stored in my vault.",
					link: "https://obsidian.md",
				},
				{
					name: "MacBook Pro",
					description:
						"I'm currently using a MacBook Pro with an M2 Pro chip. It's easily the best notebook I've ever had. Never worried about performance on this beast.",
					link: "https://apple.com/mac/macbook-pro",
				},
			],
		},
	];

	return {
		posts,
		projects,
		nowlistening,
		photos,
		techstack,
		techstackDescriptions,
	};
};

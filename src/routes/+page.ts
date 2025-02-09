export const prerender = true;

import type { LoadEvent } from '@sveltejs/kit';

export const load = async ({ fetch }: LoadEvent) => {
	const postResponse = await fetch(`/api/posts`);
	const posts = await postResponse.json();

	const projectsResponse = await fetch(`/api/projects`);
	const projects = await projectsResponse.json();

	const nowlisteningResponse = await fetch(
		`https://raw.githubusercontent.com/injoon5/data/main/now-playing.json`
	);
	const nowlistening = await nowlisteningResponse.json();

	const photosResponse = await fetch(
		`https://raw.githubusercontent.com/injoon5/data/main/photos.json`
	);
	const photos = await photosResponse.json();

	const techstack = [
		{
			name: "Web Development",
			technologies: [
				{
					name: "Svelte",
					link: "https://svelte.dev"
				},
				{
					name: "Next.js", 
					link: "https://nextjs.org"
				},
				{
					name: "Tailwind CSS",
					link: "https://tailwindcss.com"
				},
				{
					name: "SWR",
					link: "https://swr.vercel.app/"
				}, 
				{
					name: "shadcn/ui",
					link: "https://ui.shadcn.com"
				},
				{
					name: "Zod",
					link: "https://zod.dev"
				}
			]
		},
		{
			name: "App Development",
			technologies: [
				{
					name: "Swift",
					link: "https://developer.apple.com/swift/"
				},
				{
					name: "SwiftUI",
					link: "https://developer.apple.com/xcode/swiftui/"
				},
				{
					name: "Core Data",
					link: "https://developer.apple.com/xcode/swiftui/"
				},
				{
					name: "Alamofire",
					link: "https://github.com/Alamofire/Alamofire"
				},
				{
					name: "Pow",
					link: "https://movingparts.io/pow"
				}
			]
		},
		{
			name: "Other Languages",
			technologies: [
				{
					name: "Python",
					link: "https://www.python.org"
				}, 
				{
					name: "PyGame",
					link: "https://www.pygame.org"
				},
				{
					name: "PyQt",
					link: "https://www.riverbankcomputing.com/software/pyqt/"
				}, 
				{
					name: "Pandas",
					link: "https://pandas.pydata.org"
				},
				{
					name: "NumPy",
					link: "https://numpy.org"
				}, 
				{
					name: "Matplotlib",
					link: "https://matplotlib.org"
				},
				{
					name: "YOLOv8",
					link: "https://github.com/ultralytics/ultralytics"
				},
				{
					name: "TensorFlow",
					link: "https://www.tensorflow.org"
				}, 
				{
					name: "C",
					link: "https://en.wikipedia.org/wiki/C_(programming_language)"
				},
				{
					name: "C++",
					link: "https://en.wikipedia.org/wiki/C%2B%2B"
				},
				{
					name: "JavaScript",
					link: "https://en.wikipedia.org/wiki/JavaScript"
				}
			]
		},
		{
			name: "Infrastructure & Tools",
			technologies: [
				{
					name: "Vercel",
					link: "https://vercel.com"
				},
				{
					name: "Raspberry Pi",
					link: "https://raspberrypi.com"
				},
				{
					name: "Docker",
					link: "https://docker.com"
				}, 
				{
					name: "PocketBase",
					link: "https://pocketbase.io"
				},
				{
					name: "Supabase",
					link: "https://supabase.com"
				},
				{
					name: "Git",
					link: "https://git-scm.com"
				}, 
				{
					name: "GitHub",
					link: "https://github.com"
				},
				{
					name: "Figma", 
					link: "https://figma.com"
				}, 
				{
					name: "Cursor",
					link: "https://cursor.sh"
				},
				{
					name: "Obsidian",
					link: "https://obsidian.md"
				},
				{
					name: "MacBook Pro",
					link: "https://apple.com/mac/macbook-pro"
				}
			]
		}
	];
	
	return {
		posts,
		projects,
		nowlistening,
		photos, 
		techstack
	};
};

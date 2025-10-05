<script lang="ts">

	import { formatDate, sliceText } from '$lib/utils';

	export let data;
	console.log(data.posts);

	// Tech stack state management
	let selectedTech = '';
	let selectedDescription = '';
	
	function handleTechClick(techName: string) {
		console.log(techName);
		if (selectedTech === techName) {
			// If clicking the same tech, hide description
			selectedTech = '';
			selectedDescription = '';
		} else {
			// Show new description
			selectedTech = techName;
			selectedDescription = (data.techstackDescriptions as Record<string, string>)[techName] || 'No description available.';
		}
	}
</script>

<svelte:head>
	<title>Injoon Oh</title>
	<meta charset="UTF-8" />
	<meta property="og:title" content="Injoon Oh" />
	<meta name="description" content="A student who is interested in math, science, and computers." />
	<meta
		property="og:image"
		content="https://og.ij5.dev/api/og/?title=injoon5.com&subheading=injoon5%27s+website"
	/>

	<meta property="og:url" content="https://www.injoon5.com/" />
</svelte:head>

<div
	id="introduction"
	class=" mb-12 mt-10 font-medium tracking-tight text-lg sm:text-xl grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 lg:grid-cols-12"
>
	<div class=" col-span-3 md:col-span-10 lg:col-span-2 flex flex-col justify-start">
		<div class="sticky md:top-28" style="height: max-content;">
			<h1 class="italic text-xl font-medium tracking-tight text-black dark:text-white">
				Hello! -
			</h1>
		</div>
	</div>
	<div class="col-span-5 justify-center md:mr-2 mt-4 lg:mt-0">
		<p class="mb-4 text-black dark:text-white">
			I am a student who is interested in math, science, and computers.
		</p>
		<p class=" text-black dark:text-white">
			I love exploring new concepts and getting to know cool new things. Whether it’s tackling complex
			equations, researching about scientific stuff, or trying the latest tech, I’m always eager to
			learn.
		</p>
	</div>
	<div class="col-span-5 justify-center md:ml-2 mt-4 lg:mt-0">
		<p class="mb-2 text-black dark:text-white">
			Although I haven't decided the specific domain due to the industry evolving so rapidly, I want
			to be a computer programmer when I grow up. <s class="text-neutral-500"
				>(Nowadays I'm thinking about AI, but who knows?)</s></p>
	</div>
</div>
<div
	id="blog"
	class="mb-12 mt-20 tracking-tight text-lg sm:text-xl grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 lg:grid-cols-12"
>
	<div class="col-span-3 md:col-span-10 lg:col-span-2 flex flex-col justify-start">
		<div class="sticky top-20 md:top-24" style="height: max-content;">
			<a href="/blog" class="group">
				<h2 class="text-xl font-medium tracking-tight text-black dark:text-white mb-4  group-hover:text-neutral-600 dark:group-hover:text-neutral-400">
					Blog
				</h2>
			</a>
		</div>
	</div>
	<div class="col-span-10 justify-center lg:mt-0">
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			{#each data.posts.slice(0, 5) as post}
				<a
					class="flex flex-col gap-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-900  text-black  dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 group"
					href="/blog/{post.slug}"
				>
					<h2 class="line-clamp-1 text-base font-semibold group-hover:underline font-neutral-900 dark:font-neutral-100">{post.title}</h2>
					<p class="min-h-[2lh] max-h-[2lh] text-pretty break-keep line-clamp-2 text-neutral-600 dark:text-neutral-400 text-base font-semibold mb-1">{post.description || "Some amazing post that I forgot or failed to write a description for. "}</p>
					<div class="whitespace-nowrap text-sm font-semibold text-neutral-500 dark:text-neutral-500">{post.date || post.year}</div>
				</a>
			{/each}
		</div>
		<div class="flex justify-end mt-2 mb-4">
			<a
				class="group relative inline-flex items-center -tracking-normal text-neutral-600 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors duration-100 font-medium text-base"
				href="/blog"
			>
				<span class="transition-transform duration-200 group-hover:-translate-x-5"
					>Read all Posts</span
				>
				<span
					class="mr-1 absolute right-0 translate-x-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
					>→</span
				>
			</a>
		</div>
	</div>
</div>


<div
	id="projects"
	class="mb-12 mt-20 tracking-tight text-lg sm:text-xl grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 lg:grid-cols-12"
>
	<div class="col-span-3 md:col-span-10 lg:col-span-2 flex flex-col justify-start">
		<div class="sticky top-20 md:top-24" style="height: max-content;">
			<a href="/blog" class="group">
				<h2 class="text-xl font-medium tracking-tight text-black dark:text-white mb-4  group-hover:text-neutral-600 dark:group-hover:text-neutral-400">
					Projects
				</h2>
			</a>
		</div>
	</div>
	<div class="col-span-10 justify-center lg:mt-0">
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			{#each data.projects.slice(0, 5) as post}
				<a
					class="flex flex-col gap-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-900 transition-colors duration-200 text-black  dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 group"
					href="/projects/{post.slug}"
				>
					<h2 class="line-clamp-1 text-base font-semibold group-hover:underline ">{post.title}</h2>
					<p class="min-h-[2lh] max-h-[2lh] text-pretty break-keep line-clamp-2 text-neutral-600 dark:text-neutral-400 text-base font-semibold mb-1">{post.description || "Some amazing project that I forgot or failed to write a description for. "}</p>
					<div class="whitespace-nowrap text-sm font-semibold text-neutral-500 dark:text-neutral-500">{post.date || post.year}</div>
				</a>
			{/each}
		</div>
		<div class="flex justify-end mt-2 mb-4">
			<a
				class="group relative inline-flex items-center -tracking-normal text-neutral-600 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors duration-100 font-medium text-base"
				href="/projects"
			>
				<span class="transition-transform duration-200 group-hover:-translate-x-5"
					>View all Projects</span
				>
				<span
					class="mr-1 absolute right-0 translate-x-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
					>→</span
				>
			</a>
		</div>
	</div>
</div>



<div
	id="tech-stack"
	class="mb-12 mt-20 font-medium tracking-tight text-lg sm:text-xl grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 lg:grid-cols-12"
>
	<div class="col-span-3 md:col-span-10 lg:col-span-2 flex flex-col justify-start">
		<div class="sticky md:top-24" style="height: max-content;">
			<h1 class="text-xl font-medium tracking-tight text-black dark:text-white">
				Tech Stack
			</h1>
		</div>
	</div>
	<div class="col-span-10 justify-center mt-4 lg:mt-0">
		<div class="justify-center md:mr-2 mt-4 lg:mt-0">
			<div class="space-y-10">
				{#each data.techstack as stacks}
				<div>
					<h3 class="tracking-tight text-lg font-semibold text-black dark:text-white  bg-white dark:bg-black">{stacks.name}</h3>
					<div class="grid grid-cols-4 mt-4 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-12 gap-4">
						{#each stacks.technologies as technology}
						<div 
							on:click={() => handleTechClick(technology.name)}
							class="mt-2 col-span-4"
						>
							<p class="text-base font-semibold text-neutral-900 dark:text-neutral-200">{technology.name}</p>
							<p class="text-base font-semibold tracking-tigh text-neutral-600 dark:text-neutral-400 leading-normal">{technology.description}</p>
						</div>
						{/each}
					</div>
				</div>
				{/each}
			</div>
		</div>
	</div>
	
	
</div>



<!-- <div id="tech-stack" class="mb-12">
	<h2 class="flex justify-between text-xl font-medium tracking-tight text-black dark:text-white">
		Tech Stack
	</h2>
	<div class="mt-4">
		<div class="flex flex-wrap gap-2">
			{#each data.techstack as stack}
				<div class="text-black dark:text-neutral-400 flex items-center justify-center">
					<p class="font-light text-lg">{stack.name}</p>
				</div>
				{#each stack.technologies as technology}
					<a href={technology.link} target="_blank" rel="noopener noreferrer" class="rounded-xl bg-neutral-50 px-3 py-2 dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors duration-200">
						<p class="text-sm">{technology.name}</p>
					</a>
				{/each}
			{/each}
		</div>
	</div>
</div> -->

<div
	id="now-listening"
	class=" mb-12 mt-20 font-medium tracking-tight text-lg sm:text-xl grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 lg:grid-cols-12"
>
	<div class=" col-span-3 md:col-span-10 lg:col-span-2 flex flex-col justify-start">
		<div class="sticky md:top-24" style="height: max-content;">
			<h1 class="text-xl font-medium tracking-tight text-black dark:text-white">
				Now Listening
			</h1>
		</div>
	</div>
	

	<div class="col-span-10 justify-center mt-4 lg:-mt-1 lg:-mb-1.5">
		<div class="grid grid-cols-1 divide-y divide-neutral-200 dark:divide-neutral-700">
			{#each data.nowlistening.recenttracks.track.slice(0, 4) as nowlistening}
				<a
					class="flex items-center gap-3 py-2 text-black hover:text-neutral-600 dark:text-white dark:hover:text-neutral-200 transition-colors group"
					href={nowlistening.url}
				>
					<div class="flex-shrink-0">
						<div class="relative w-14 h-14">
							<div class="absolute inset-0 bg-neutral-200 dark:bg-neutral-800"></div>
							<img
								loading="lazy"
								src={nowlistening.image[2]['#text']}
								alt={sliceText(nowlistening.name, 10)}
								class="absolute inset-0 h-full w-full object-cover"
							/>
						</div>
					</div>
					<div class="flex justify-between items-center w-full text-lg font-medium">
						<span class="line-clamp-1">{nowlistening.name}</span>
						<span class="line-clamp-1 text-neutral-600 dark:text-neutral-500 group-hover:text-neutral-500 group-hover:dark:text-neutral-400 transition-colors ml-2">{nowlistening.artist['#text'] === 'Lany' ? 'LANY' : nowlistening.artist['#text']}</span>
					</div>
				</a>
			{/each}
		</div>
	</div>
</div>

<div
	id="photos"
	class="mb-24 mt-20 font-medium tracking-tight text-lg sm:text-xl grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 lg:grid-cols-12"
>
	<div class="col-span-3 md:col-span-10 lg:col-span-2 flex flex-col justify-start">
		<div class="sticky md:top-24" style="height: max-content;">
			<h1 class="text-xl font-medium tracking-tight text-black dark:text-white">
				Photos
			</h1>
		</div>
	</div>
	<div class="col-span-10 justify-center mt-4 lg:mt-0">
		<div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-1">
			{#each data.photos.photos.slice(0, 6) as photo}
				<div class="relative aspect-square w-full overflow-hidden flex items-center justify-center group">
					<div class="absolute inset-0 bg-neutral-100 dark:bg-neutral-900 group-hover:bg-neutral-200 group-hover:dark:bg-neutral-800"></div>
					<a href={photo.url} class="photo-item relative flex items-center justify-center w-full h-full">
						<img
							loading="lazy"
							src={photo.src.medium.url}
							alt={photo.title || 'Photo'}
							class="max-w-[80%] max-h-[80%] shadow-lg object-contain z-10"
						/>
					</a>
				</div>
			{/each}
		</div>
		<div class="flex justify-end mt-2 mb-4">
			<a
				class="group relative inline-flex items-center -tracking-normal text-neutral-600 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors duration-100 font-medium text-base"
				href="https://photos.injoon5.com"
				target="_blank"
				rel="noopener noreferrer"
			>
				<span class="transition-transform duration-200 group-hover:-translate-x-5"
					>View all Photos</span
				>
				<span
					class="mr-1 absolute right-0 translate-x-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
					>→</span
				>
			</a>
		</div>
	</div>
</div>


<style>

</style>

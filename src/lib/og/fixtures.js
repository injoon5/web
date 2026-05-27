/**
 * Dummy OG card data for /api/og/test and ?fixture=… previews.
 */

/** @type {Record<string, { template: string, title?: string, description?: string, date?: string, year?: string, tags?: string[] }>} */
export const OG_FIXTURES = {
	'lg-ai-blog': {
		template: 'blog-post',
		title:
			'대규모 언어 모델이 바꾸는 소프트웨어 개발: 에이전트, 컨텍스트 윈도우, 그리고 우리가 배워야 할 것들',
		description:
			'GPT-4o부터 Claude, Gemini까지—코딩 에이전트가 IDE에 들어오면서 "vibe coding"이 유행이다. 하지만 긴 컨텍스트, 환각, 그리고 eval 없는 배포는 여전히 함정이다. 이 글에서는 실제로 써 본 워크플로, 프롬프트 설계, 그리고 LLM을 도구로 쓸 때의 한계를 정리한다. When agents write the boilerplate, your job shifts to architecture, review, and knowing when to say no.',
		date: '2025-05-27'
	},
	'short-blog': {
		template: 'blog-post',
		title: '짧은 제목',
		description: '한 줄 설명.',
		date: '2024-01-15'
	},
	'long-title-blog': {
		template: 'blog-post',
		title:
			'An extremely long English-only blog post title that should trigger the smallest title tier in the OG layout system',
		description: 'Description for a post with a very long Latin headline.',
		date: '2025-03-01'
	},
	'lg-ai-project': {
		template: 'project',
		title: 'Convex Comment System with Realtime Votes',
		description:
			'SvelteKit personal site backend: comments, likes, IP bans, rate limits—all on Convex with bcrypt passwords and admin dashboard.',
		year: '2025',
		tags: ['SvelteKit', 'Convex', 'TypeScript', 'AI-assisted']
	},
	home: { template: 'home' },
	blog: { template: 'blog' },
	projects: { template: 'projects' },
	now: { template: 'now' }
};

export const OG_FIXTURE_IDS = Object.keys(OG_FIXTURES);

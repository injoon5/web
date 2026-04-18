import { type Handle } from '@sveltejs/kit';
import TurndownService from 'turndown';

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

export const handle: Handle = async ({ event, resolve }) => {
	const accept = event.request.headers.get('accept') ?? '';
	const wantsMarkdown = accept.split(',').some((part) => part.trim().split(';')[0].trim() === 'text/markdown');

	const response = await resolve(event);

	if (wantsMarkdown && response.headers.get('content-type')?.startsWith('text/html')) {
		const html = await response.text();
		const markdown = td.turndown(html);
		const tokens = Math.ceil(markdown.length / 4);
		return new Response(markdown, {
			status: response.status,
			headers: {
				'content-type': 'text/markdown; charset=utf-8',
				'x-markdown-tokens': String(tokens)
			}
		});
	}

	return response;
};

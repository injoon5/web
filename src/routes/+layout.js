import posthog from 'posthog-js';
import { browser } from '$app/environment';

export const load = async () => {
	if (browser) {
		posthog.init('phc_bGPHXwctnUvocW2PwQ7bbfWUKDGwmuA2KbhlqGTsh9G', {
			api_host: '/relay-oij225/',
			ui_host: 'https://us.posthog.com',
			defaults: '2025-05-24',
			person_profiles: 'always' // or 'always' to create profiles for anonymous users as well
		});
	}

	return;
};

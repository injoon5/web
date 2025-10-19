export const prerender = true;

import { json } from '@sveltejs/kit';

async function getDeployementInfo() {
	const deploymentId = 'dpl_8ZQNkgXXt9V4vNf8kQTSLQhDdAr6'; // replace with your own
	// https://vercel.com/support/articles/how-do-i-use-a-vercel-api-access-token
	const accessToken = process.env.VERCEL_ACCESS_TOKEN;
	const result = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	});

	// ms since epoch for when the deployment finished
	const { ready } = await result.json(); // 1650903484801
	console.log(result);
	// convert to human-readable date
	return new Date(ready).toLocaleString(); // 4/25/2022, 9:18:04 AM
}

export async function GET() {
	const deploymentInfo = await getDeployementInfo();
	return json(deploymentInfo);
}

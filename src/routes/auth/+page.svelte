<script lang="ts">
	import PocketBase from 'pocketbase';
	import KakaoButton from '$lib/auth/KakaoButton.svelte';
	import GithubButton from '$lib/auth/GithubButton.svelte';
	import LogoutButton from '$lib/auth/LogoutButton.svelte';

	const pb = new PocketBase('https://pb.injoon5.com');

	async function login(form: HTMLFormElement) {
		try {
			await pb.collection('users').authWithOAuth2({ provider: 'kakao' });

			// Set the token in the form and submit
			form.token.value = pb.authStore.token;
			form.submit();
		} catch (err) {
			console.error(err);
		}
	}
</script>

{#if !pb.authStore.isValid}
	<h2 class="mt-20 text-xl font-semibold">Log in to interact.</h2>
	<form method="post" on:submit|preventDefault={(e) => login(e.currentTarget)}>
		<input name="token" type="hidden" />
		<div class="mt-5 grid grid-rows-1 gap-1 px-24 md:px-32">
			<KakaoButton />
		</div>
	</form>
{:else}
	<h2 class="mt-20 text-xl font-semibold">Your Account</h2>
	<p class="text-lg font-medium">{pb.authStore.model?.username || 'Unknown User'}</p>
	<div class="px-18 mt-10 grid grid-rows-1 gap-1 md:px-32">
		<LogoutButton />
	</div>
{/if}

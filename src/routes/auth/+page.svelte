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

<div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
	<div class="col-span-1 justify-center pt-10 lg:col-span-8 lg:col-start-3">
		{#if !pb.authStore.isValid}
			<h1
				class="mt-20 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl dark:text-neutral-100"
			>
				Log in to interact.
			</h1>
			<form method="post" on:submit|preventDefault={(e) => login(e.currentTarget)}>
				<input name="token" type="hidden" />
				<div class="mt-5 grid grid-rows-1 gap-1 px-6 sm:px-32">
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
	</div>
</div>

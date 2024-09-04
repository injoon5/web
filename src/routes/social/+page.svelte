<script>
	const social_accounts = [
		{
			name: 'GitHub',
			url: 'https://github.com/injoon5'
		},
		{
			name: 'Reddit',
			url: 'https://reddit.com/u/injoon5'
		}
	];
</script>

<h1 class="mt-20 text-2xl font-normal text-black dark:text-white">Find me on...</h1>
<h2 class="text-md font-normal text-black dark:text-white">
	OFFICIAL INJOON5 ACCOUNTS. BEWARE OF IMPOSTERS.
</h2>

<ul class="my-6">
	{#each social_accounts as account}
		<li>
			<a
				href={account.url}
				target="_blank"
				rel="noopener noreferrer"
				class="p-0 text-lg font-medium text-black hover:underline md:p-1 dark:text-white"
				>{account.name}: {account.url.split('/').slice(-1)}</a
			>
		</li>
	{/each}
</ul>

<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import PocketBase from 'pocketbase';

    const pb = new PocketBase('https://pb.injoon5.com');

    let username = '';
    let comment = '';
    let comments = [];
    let currentPath = '';

    onMount(async () => {
        currentPath = $page.url.pathname;
        await loadComments();
    });

    // Watch for route changes
    $: if ($page.url.pathname !== currentPath) {
        currentPath = $page.url.pathname;
        username = '';
        comment = '';
        loadComments();
    }

    async function loadComments() {
        try {
            const records = await pb.collection('comments').getList(1, 50, {
                sort: '-created',
                expand: 'author',
                filter: `url = "${$page.url.pathname}"`
            });
            comments = records.items;
        } catch (error) {
            console.error('Error loading comments:', error);
        }
    }

    async function submitComment() {
        if (!pb.authStore.isValid) {
            alert('Please log in to submit a comment.');
            return;
        }

        if (!username.trim() || !comment.trim()) {
            alert('Please fill in both username and comment fields.');
            return;
        }

        try {
            console.log('Submitting comment with data:', {
                slug: $page.url.pathname,
                text: comment,
                username: username,
                authorId: pb.authStore.model?.id
            });
            await pb.collection('comments').create({
                url: $page.url.pathname,
                author: pb.authStore.model.id,
                text: comment,
                username: username
            });
            username = '';
            comment = '';
            await loadComments();
        } catch (error) {
            console.error('Error submitting comment:', error, pb.authStore.model.id);
            alert('Failed to submit comment. Please try again.');
        }
    }

</script>

<div>
    <h3 class="text-2xl font-bold" id="comments">Comments</h3>
    {#if pb.authStore.isValid}
    <div class="mt-2">
        <input
            type="text"
            placeholder="Username"
            bind:value={username}
            class="w-1/2 dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:dark:ring-neutral-800 border bg-neutral-100 dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 w-full p-2 rounded-lg text-black mb-2"
        />
        <textarea
            placeholder="Show me what you got.."
            bind:value={comment}
            class="dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:dark:ring-neutral-800 resize-none border bg-neutral-100 dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 w-full h-32 p-2 rounded-lg text-black"
        />
        <button
            on:click={submitComment}
            class="font-medium px-4 bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-900 dark:hover:bg-neutral-100 rounded-lg p-2 mt-2"
        >
            Submit
        </button>
    </div>
    {:else}
        <p class="mt-2">Please login to leave a comment.</p>
        <a href="/auth?goto={$page.url.pathname}">Log in</a>
    {/if}
</div>

<div class="mt-8">
    <h4 class="text-xl font-semibold mb-4">Recent Comments</h4>
    {#if comments.length > 0}
        {#each comments as comment}
            <div class="bg-neutral-100 dark:bg-neutral-900 p-4 rounded-lg mb-4">
                <div class="flex flex-row">
                    <p class="font-bold">{comment.username}</p>
                    {#if comment.author == "214phugj014d7zb"}
                        <p class="ml-2 text-sm text-neutral-500">Blog Owner</p>
                    {/if}
                </div>
                <p class="mt-2">{comment.text}</p>
                <p class="text-sm text-neutral-500 mt-2">{new Date(comment.created).toLocaleString()}</p>
            </div>
        {/each}
    {:else}
        <p>No comments yet. Be the first to comment!</p>
    {/if}
</div>
<script>
    import { page } from '$app/stores';  

    import PocketBase from 'pocketbase';

    const pb = new PocketBase('https://pb.injoon5.com');
</script>

<div>
    <h3 class="text-2xl font-bold" id="comments">Comments</h3>
    {#if pb.authStore.isValid}
        <div class="mt-2">
            <textarea placeholder="Show me what you got.." class="dark:text-white focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:dark:ring-neutral-800 resize-none border bg-neutral-100 dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 w-full h-32 p-2 rounded-lg text-black"></textarea>
            <button class=" font-medium px-4 bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-900 dark:hover:bg-neutral-100 rounded-lg p-2">Submit</button>
        </div>
    {:else}
        <p class="mt-2">Please login to leave a comment.</p>
        <a href="/auth?goto={$page.url.pathname}#comments">Log in</a>
    {/if}

</div>

<div>
    
</div>
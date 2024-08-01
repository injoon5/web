<script>
      import PocketBase from 'pocketbase';
      const pb = new PocketBase('https://pb.injoon5.com');
      function logout() {
        pb.authStore.clear();  // Clear authentication token 
        window.location.href = '/';
    }
</script>

<button class="bg-black dark:bg-white text-white dark:text-black/80 px-20 py-3 rounded-md font-medium flex justify-center" on:click={logout}>
      <p class="">Log Out</p>
</button>
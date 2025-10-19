<script>
import PocketBase from "pocketbase";
const pb = new PocketBase("https://pb.injoon5.com");
function logout() {
	pb.authStore.clear(); // Clear authentication token
	window.location.href = "/";
}
</script>

<button
	class="flex justify-center rounded-md bg-black px-20 py-3 font-medium text-white dark:bg-white dark:text-black/80"
	on:click={logout}
>
	<p class="">Log Out</p>
</button>

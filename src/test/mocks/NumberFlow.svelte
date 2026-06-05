<!-- Test stand-in for @number-flow/svelte: renders the value as plain text so
     tests can assert on it without the Web Animations API (absent in jsdom). -->
<script>
	let { value } = $props();
</script>

{value}

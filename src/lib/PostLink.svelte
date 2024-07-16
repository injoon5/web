<script>
    import { formatDate } from "./utils";
    export let data, slug;
</script>

<a class="hover:text-gray-600 dark:hover:text-gray-200 text-black dark:text-white flex items-center gap-1 pt-4 underline" href="/{slug}/{data.slug}">
    <h2 class="line-clamp-1">{data.title}</h2>
    <div class="bg-gray-200 dark:bg-gray-700 line-clamp-1 h-px w-full flex-1"></div>
    <div>{data.date || data.year}</div>
</a>
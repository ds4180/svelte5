<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/v1/admin/board', { replaceState: true });
	});
</script>

<div class="p-8 text-center text-sm font-bold text-slate-500">
	<a href="/v1/admin/board" class="text-blue-600 underline">/v1/admin/board</a> 로 이동합니다...
</div>

<script>
	/**
	 * @file v1/pages/files/+page.svelte
	 * @description [v3.2] 독립형 개인 파일 커맨드 센터
	 */
	import { auth } from '$lib/runes/auth.svelte.js';
	import Icon from '@iconify/svelte';
	import FileManager from '$lib/components/FileManager.svelte';
</script>

<div class="animate-fade-in space-y-8 font-['Outfit'] text-black pb-40">
	<!-- 📄 Header: Files Identity -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-black pb-8 md:flex-row md:items-end">
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase">
				Command Center / Storage
			</span>
			<h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-6xl">
				MY FILES <span class="NOT-ITALIC text-blue-600">Vault</span>
			</h1>
		</div>
		<div class="text-right flex flex-col items-end gap-1">
			<div class="flex items-center gap-2 border-2 border-black bg-emerald-400 px-3 py-1 shadow-[4px_4px_0_0_#000]">
				<Icon icon="ph:shield-check-fill" class="h-4 w-4" />
				<span class="text-[10px] font-black uppercase">Secure Storage</span>
			</div>
			<p class="text-[9px] font-bold opacity-30 uppercase tracking-widest italic">User Isolation Active</p>
		</div>
	</header>

	<!-- 🔄 Main Workspace -->
	<main class="min-h-[600px]">
		{#if auth.user}
			<FileManager 
				app_id="personal_vault" 
				access_level="PRIVATE" 
				sub_path="USERS/{auth.user.id}" 
			/>
		{:else}
			<div class="flex h-96 flex-col items-center justify-center border-4 border-dashed border-slate-200">
				<Icon icon="ph:lock-keyhole-bold" class="h-16 w-16 opacity-10 mb-4" />
				<p class="text-xs font-black uppercase tracking-widest opacity-30">Authentication Required</p>
			</div>
		{/if}
	</main>
</div>

<style>
	.animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>

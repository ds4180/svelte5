<script>
	/**
	 * @file login/+page.svelte (Error 컴포넌트 적용 버전)
	 */
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import Error from '$lib/components/Error.svelte'; // ✅ Error 컴포넌트 추가

	let { form } = $props();
	let loading = $state(false);

	function handleSubmit() {
		loading = true;
		return async ({ result, update }) => {
			await update();
			loading = false;
		};
	}
</script>

<svelte:head>
	<title>AUTH | JEJU.LIVE ACCESS</title>
</svelte:head>

<div
	class="animate-fade-in flex min-h-screen flex-col items-center justify-center bg-white p-6 font-['Outfit'] text-black"
>
	<div class="relative w-full max-w-[420px] border border-black bg-white p-10 md:p-14">
		{#if loading}
			<div class="absolute top-0 left-0 h-[3px] w-full animate-pulse bg-black"></div>
		{/if}

		<div class="mb-14 space-y-2 text-center">
			<span class="block text-[9px] font-black tracking-[0.4em] uppercase opacity-30"
				>Terminal Authentication</span
			>
			<h1 class="text-4xl leading-none font-black tracking-tighter uppercase italic">Jeju.Live</h1>
			<p class="mt-2 text-[10px] font-bold tracking-widest opacity-30">
				SYSTEM CLOUD INFRASTRUCTURE v5.0
			</p>
		</div>

		<form method="post" use:enhance={handleSubmit} class="space-y-10">
			<div class="space-y-3">
				<label for="username" class="text-[10px] font-black tracking-widest uppercase opacity-40"
					>Operator ID / ID</label
				>
				<input
					type="text"
					id="username"
					name="username"
					class="h-14 w-full border border-black p-2 px-5 font-bold transition-all placeholder:italic placeholder:opacity-10 focus:bg-slate-50 focus:outline-none"
					placeholder="Enter Username"
					required
				/>
			</div>

			<div class="space-y-3">
				<label for="password" class="text-[10px] font-black tracking-widest uppercase opacity-40"
					>Encryption Key / PW</label
				>
				<input
					type="password"
					id="password"
					name="password"
					class="h-14 w-full border border-black p-2 px-5 font-bold transition-all placeholder:italic placeholder:opacity-10 focus:bg-slate-50 focus:outline-none"
					placeholder="••••••••"
					required
				/>
			</div>

			<!-- ✅ Error 전용 컴포넌트 배치 -->
			{#if form?.error}
				<Error error={form.error} />
			{/if}

			<button
				type="submit"
				class="btn-black btn h-16 w-full rounded-none border border-black text-lg font-black tracking-widest uppercase transition-all hover:border-black hover:bg-white hover:text-black"
				disabled={loading}
			>
				{loading ? 'Authenticating...' : 'Sign In Now'}
			</button>
		</form>

		<div class="mt-16 flex flex-col items-center gap-2">
			<a
				href="/"
				class="border-b border-black text-[9px] font-black tracking-widest uppercase opacity-20 transition-opacity hover:opacity-100"
				>Return to Public Portal</a
			>
		</div>
	</div>

	<div
		class="mt-12 flex items-center gap-3 text-[9px] font-black tracking-widest uppercase opacity-10 grayscale select-none"
	>
		<div class="h-2 w-2 animate-pulse rounded-full bg-black"></div>
		<div>SSL ENCRYPTED SECURE CHANNEL</div>
	</div>
</div>

<style>
	.animate-fade-in {
		animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	:global(.btn-black) {
		background-color: #000;
		color: #fff;
	}
</style>

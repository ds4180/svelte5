<script>
	/**
	 * @file login/+page.svelte (고시인성 에러 표시 & 비밀번호 자동 초기화 적용 버전)
	 */
	import { enhance } from '$app/forms';
	import { onMount, tick } from 'svelte';
	import Error from '$lib/components/Error.svelte';

	let { form } = $props();
	let loading = $state(false);
	let password = $state('');
	/** @type {HTMLInputElement | null} */
	let usernameInput = $state(null);
	/** @type {HTMLInputElement | null} */
	let passwordInput = $state(null);
	// 연속 실패 시에도 에러 박스 흔들림(Shake) 애니메이션이 매번 재실행되도록 카운터 키 관리
	let errorKey = $state(0);
	let hasPasswordError = $state(false);

	onMount(() => {
		// 🎯 로그인 페이지 진입 즉시 아이디(ID) 입력창에 자동 포커스
		usernameInput?.focus();
	});

	function handleSubmit() {
		loading = true;
		// 🔔 로그인 버튼 클릭(사용자 제스처)과 동시에 아직 푸시 권한이 'default'라면 즉시 허용 창 호출
		if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
			Notification.requestPermission().catch(() => {});
		}
		return async ({ result, update }) => {
			await update({ reset: false });
			loading = false;

			// 🛡️ 로그인 실패 시: 입력했던 틀린 비밀번호를 즉시 초기화하고 비밀번호 입력창으로 포커스 이동
			if (result.type === 'failure') {
				password = '';
				if (passwordInput) {
					passwordInput.value = '';
				}
				errorKey += 1;
				hasPasswordError = true;
				await tick();
				passwordInput?.focus();
			}
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
					bind:this={usernameInput}
					autofocus
					autocomplete="username"
					class="h-14 w-full border border-black p-2 px-5 font-bold transition-all placeholder:italic placeholder:opacity-10 focus:bg-slate-50 focus:outline-none"
					placeholder="Enter Username"
					required
				/>
			</div>

			<div class="space-y-3">
				<label
					for="password"
					class="text-[10px] font-black tracking-widest uppercase {hasPasswordError
						? 'text-rose-600 opacity-100'
						: 'opacity-40'}"
				>
					Encryption Key / PW
				</label>
				<input
					type="password"
					id="password"
					name="password"
					bind:this={passwordInput}
					bind:value={password}
					oninput={() => {
						if (hasPasswordError) hasPasswordError = false;
					}}
					class="h-14 w-full border-2 p-2 px-5 font-bold transition-all placeholder:italic placeholder:opacity-20 focus:outline-none {hasPasswordError
						? 'border-rose-600 bg-rose-50/40 text-rose-900 focus:bg-white'
						: 'border-black focus:bg-slate-50'}"
					placeholder={hasPasswordError ? '비밀번호를 다시 입력해주세요' : '••••••••'}
					required
				/>
			</div>

			<!-- ✅ 고시인성 Error 전용 컴포넌트 배치 (연속 실패 시에도 애니메이션 재트리거) -->
			{#if form?.error}
				{#key errorKey}
					<Error error={form.error} />
				{/key}
			{/if}

			<button
				type="submit"
				class="btn-black btn h-16 w-full rounded-none border border-black text-lg font-black tracking-widest uppercase transition-all hover:border-black hover:bg-white hover:text-black"
				disabled={loading}
			>
				{loading ? 'Authenticating...' : 'Sign In Now'}
			</button>
		</form>

		<div class="mt-12 flex flex-col items-center gap-3 border-t border-black/10 pt-6">
			<a
				href="/register"
				class="text-[10px] font-black tracking-widest uppercase opacity-40 transition-opacity hover:opacity-100"
			>
				Create Account / 사원 계정 발급 안내
			</a>
			<a
				href="/"
				class="border-b border-black text-[9px] font-black tracking-widest uppercase opacity-20 transition-opacity hover:opacity-100"
			>
				Return to Public Portal
			</a>
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

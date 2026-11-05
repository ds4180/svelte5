<script>
	/**
	 * @file (auth)/register/+page.svelte
	 * @description 중소기업 오피스 인트라넷 전용 계정 등록 / 가입 신청 관문
	 *              - ADMIN_ONLY 모드: 외부 가입 차단 및 인사담당자 발급 안내
	 *              - APPROVAL 모드: 가입 신청 후 관리자 승인 대기(Lv.0) 안내
	 *              - OPEN 모드: 자유 가입 후 즉시 로그인 안내
	 */
	import { enhance } from '$app/forms';
	import Error from '$lib/components/Error.svelte';
	import Icon from '@iconify/svelte';

	let { data, form } = $props();
	let loading = $state(false);

	function handleSubmit() {
		loading = true;
		return async ({ update }) => {
			await update();
			loading = false;
		};
	}
</script>

<svelte:head>
	<title>REGISTER | JEJU.LIVE ENTERPRISE</title>
</svelte:head>

<div
	class="animate-fade-in flex min-h-screen flex-col items-center justify-center bg-white p-6 font-['Outfit'] text-black"
>
	<div class="relative w-full max-w-[460px] border border-black bg-white p-10 md:p-14">
		{#if loading}
			<div class="absolute top-0 left-0 h-[3px] w-full animate-pulse bg-black"></div>
		{/if}

		<div class="mb-10 space-y-2 text-center">
			<span class="block text-[9px] font-black tracking-[0.4em] uppercase opacity-30"
				>Employee Registration</span
			>
			<h1 class="text-4xl leading-none font-black tracking-tighter uppercase italic">Jeju.Live</h1>
			<p class="mt-2 text-[10px] font-bold tracking-widest opacity-30">
				ENTERPRISE OFFICE INTRANET v5.0
			</p>
		</div>

		<!-- 1️⃣ [ADMIN_ONLY 모드]: 관리자 직접 등록만 허용된 폐쇄형 오피스 -->
		{#if data.registerMode === 'ADMIN_ONLY'}
			<div class="space-y-6 text-center">
				<div class="mx-auto flex h-14 w-14 items-center justify-center border border-black bg-slate-50">
					<Icon icon="mdi:shield-lock-outline" class="text-3xl text-black" />
				</div>
				<div class="space-y-2">
					<h3 class="text-base font-black tracking-tight uppercase">사내 폐쇄형 인트라넷</h3>
					<p class="text-xs font-medium leading-relaxed text-slate-600">
						본 시스템은 보안 오피스 인트라넷으로, <br />
						<strong class="font-black text-black">관리자가 직접 사원 계정을 발급</strong>합니다.
					</p>
					<div class="rounded-none border border-black/10 bg-slate-50 p-4 text-left text-[11px] leading-relaxed text-slate-500">
						• 신규 입사자 계정 발급은 <strong class="text-black">인사/전산 담당자</strong>에게 요청하십시오.<br />
						• 발급받은 사원 아이디와 초기 비밀번호로 로그인하실 수 있습니다.
					</div>
				</div>

				<a
					href="/login"
					class="btn-black btn h-14 w-full rounded-none border border-black text-sm font-black tracking-widest uppercase transition-all hover:border-black hover:bg-white hover:text-black flex items-center justify-center gap-2"
				>
					<Icon icon="mdi:arrow-left" /> 로그인 화면으로 이동
				</a>
			</div>

		<!-- 2️⃣ [가입 성공 화면] -->
		{:else if form?.success}
			<div class="space-y-6 text-center">
				<div class="mx-auto flex h-14 w-14 items-center justify-center border border-black bg-emerald-50">
					<Icon icon="mdi:check-circle-outline" class="text-3xl text-emerald-600" />
				</div>
				<div class="space-y-2">
					<h3 class="text-base font-black tracking-tight uppercase">가입 신청 접수 완료</h3>
					<p class="text-xs font-medium leading-relaxed text-slate-600">
						사원 <strong class="font-black text-black">@{form.username}</strong>님의 계정이 생성되었습니다.
					</p>
					{#if form.rank_level === 0}
						<div class="rounded-none border border-amber-300 bg-amber-50 p-4 text-left text-[11px] leading-relaxed text-amber-900">
							⚠️ <strong>관리자 승인 대기 중 (Lv.0)</strong><br />
							사내 보안 정책에 따라 인사 관리자의 승인 완료 후 정식 사원 권한으로 사내 시스템을 이용하실 수 있습니다.
						</div>
					{:else}
						<div class="rounded-none border border-emerald-300 bg-emerald-50 p-4 text-left text-[11px] leading-relaxed text-emerald-900">
							정회원 계정으로 즉시 활성화되었습니다. 로그인 후 시스템을 이용해 주십시오.
						</div>
					{/if}
				</div>

				<a
					href="/login"
					class="btn-black btn h-14 w-full rounded-none border border-black text-sm font-black tracking-widest uppercase transition-all hover:border-black hover:bg-white hover:text-black flex items-center justify-center gap-2"
				>
					로그인 화면으로 이동
				</a>
			</div>

		<!-- 3️⃣ [APPROVAL / OPEN 모드]: 가입 신청 폼 -->
		{:else}
			<form method="post" use:enhance={handleSubmit} class="space-y-6">
				<div class="space-y-2">
					<label for="username" class="text-[10px] font-black tracking-widest uppercase opacity-40">
						Desired ID / 사원 아이디
					</label>
					<input
						type="text"
						id="username"
						name="username"
						class="h-12 w-full border border-black p-2 px-4 font-bold transition-all placeholder:italic placeholder:opacity-10 focus:bg-slate-50 focus:outline-none text-sm"
						placeholder="아이디 (영문/숫자)"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="email" class="text-[10px] font-black tracking-widest uppercase opacity-40">
						Company Email / 회사 이메일
					</label>
					<input
						type="email"
						id="email"
						name="email"
						class="h-12 w-full border border-black p-2 px-4 font-bold transition-all placeholder:italic placeholder:opacity-10 focus:bg-slate-50 focus:outline-none text-sm"
						placeholder="user@company.com"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="password1" class="text-[10px] font-black tracking-widest uppercase opacity-40">
						Password / 비밀번호
					</label>
					<input
						type="password"
						id="password1"
						name="password1"
						class="h-12 w-full border border-black p-2 px-4 font-bold transition-all placeholder:italic placeholder:opacity-10 focus:bg-slate-50 focus:outline-none text-sm"
						placeholder="••••••••"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="password2" class="text-[10px] font-black tracking-widest uppercase opacity-40">
						Confirm Password / 비밀번호 확인
					</label>
					<input
						type="password"
						id="password2"
						name="password2"
						class="h-12 w-full border border-black p-2 px-4 font-bold transition-all placeholder:italic placeholder:opacity-10 focus:bg-slate-50 focus:outline-none text-sm"
						placeholder="••••••••"
						required
					/>
				</div>

				{#if form?.error}
					<Error error={form.error} />
				{/if}

				<button
					type="submit"
					class="btn-black btn h-14 w-full rounded-none border border-black text-sm font-black tracking-widest uppercase transition-all hover:border-black hover:bg-white hover:text-black mt-4"
					disabled={loading}
				>
					{loading ? 'Submitting Application...' : 'Submit Registration'}
				</button>
			</form>

			<div class="mt-8 flex flex-col items-center gap-2 border-t border-black/10 pt-6">
				<a
					href="/login"
					class="text-[10px] font-black tracking-widest uppercase opacity-40 transition-opacity hover:opacity-100"
				>
					Already have an account? Sign In
				</a>
			</div>
		{/if}
	</div>

	<div
		class="mt-12 flex items-center gap-3 text-[9px] font-black tracking-widest uppercase opacity-10 grayscale select-none"
	>
		<div class="h-2 w-2 animate-pulse rounded-full bg-black"></div>
		<div>ENTERPRISE IDENTITY ACCESS MANAGEMENT</div>
	</div>
</div>

<style>
	.animate-fade-in {
		animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(15px);
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

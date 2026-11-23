<script lang="ts">
	/**
	 * @file v1/pages/profile/biometric/+page.svelte
	 * @description 지문 인식(Passkey) 등록 · 이름 변경 · 삭제 전용 페이지
	 */
	import Icon from '@iconify/svelte';
	import { getSiteTitle } from '$lib/config/site';
	import BiometricPasskeyPanel from '$lib/components/biometric/BiometricPasskeyPanel.svelte';
</script>

<svelte:head>
	<title>{getSiteTitle('지문 등록 · 삭제')}</title>
</svelte:head>

<div
	class="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-28 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 md:pb-12 lg:px-8"
>
	<header
		class="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:border-b-4 md:pb-8"
	>
		<div>
			<div class="flex flex-wrap items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-wider text-emerald-400"
				>
					<Icon icon="ph:fingerprint-bold" class="h-3.5 w-3.5" />
					내 보안 설정 · 지문 등록/삭제
				</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
				지문 인식 <span class="text-blue-600">등록 · 삭제</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				내 계정에 연결된 스마트폰·PC의 지문/생체인증(Passkey)을 등록하고 관리하거나 해지합니다.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<a
				href="/v1/pages/profile?tab=SECURITY&sub=BIOMETRIC"
				class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-xs transition hover:bg-slate-50"
			>
				<Icon icon="ph:arrow-left-bold" class="h-4 w-4" />
				<span>프로필 보안설정으로 돌아가기</span>
			</a>
		</div>
	</header>

	<BiometricPasskeyPanel showStandaloneLink={false} />
</div>

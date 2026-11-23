<script lang="ts">
	/**
	 * ============================================================================
	 * [공용 서비스앱 권한 잠금 안내 컴포넌트 (src/lib/components/ServiceLockNotice.svelte)]
	 * ============================================================================
	 * 💡 역할:
	 * - 권한이 부족해 서비스앱 쓰기/실행을 사용할 수 없을 때,
	 *   로딩 직후 일관된 잠금 안내와 로그인 이동 버튼을 표시합니다.
	 */
	import Icon from '@iconify/svelte';
	import { resolve } from '$app/paths';
	import type { ServicePermission } from '$lib/utils/servicePermission';

	let {
		permission,
		serviceLabel = '서비스',
		compact = false
	}: {
		permission: ServicePermission;
		serviceLabel?: string;
		compact?: boolean;
	} = $props();

	const isLoginRequired = $derived(permission?.reason === 'LOGIN_REQUIRED');
	const displayMessage = $derived(
		permission?.message ||
			(isLoginRequired
				? `로그인 후 ${serviceLabel}을(를) 이용할 수 있습니다.`
				: `${serviceLabel} 사용 권한이 없습니다.`)
	);
</script>

{#if compact}
	<div
		class="inline-flex flex-wrap items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold {isLoginRequired
			? 'border-blue-200 bg-blue-50/70 text-blue-700'
			: 'border-slate-200 bg-slate-100 text-slate-600'}"
		role="status"
	>
		<Icon
			icon={isLoginRequired ? 'ph:sign-in-bold' : 'ph:lock-simple-bold'}
			class="h-3.5 w-3.5 shrink-0"
		/>
		<span>{displayMessage}</span>
		{#if isLoginRequired}
			<a
				href={resolve('/login')}
				class="rounded-lg bg-blue-600 px-2 py-0.5 text-[11px] font-black text-white transition hover:bg-blue-700"
			>
				로그인
			</a>
		{/if}
	</div>
{:else}
	<div
		class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-xs font-bold {isLoginRequired
			? 'border-blue-200 bg-blue-50/60 text-blue-800'
			: 'border-slate-200 bg-slate-50 text-slate-600'}"
		role="status"
	>
		<div class="flex items-center gap-2.5">
			<div
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl {isLoginRequired
					? 'bg-blue-100 text-blue-600'
					: 'bg-slate-200 text-slate-500'}"
			>
				<Icon icon={isLoginRequired ? 'ph:sign-in-bold' : 'ph:lock-simple-bold'} class="h-4 w-4" />
			</div>
			<div>
				<p class="font-black">{displayMessage}</p>
				<p class="mt-0.5 text-[11px] font-medium opacity-75">
					{isLoginRequired
						? `${serviceLabel} 작성 및 참여는 로그인 후 이용 가능합니다.`
						: `현재 계정 등급에서는 ${serviceLabel} 작성/참여가 제한되어 있습니다.`}
				</p>
			</div>
		</div>
		{#if isLoginRequired}
			<a
				href={resolve('/login')}
				class="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-black text-white shadow-xs transition hover:bg-blue-700"
			>
				<Icon icon="ph:sign-in-bold" class="h-3.5 w-3.5" />
				<span>로그인하기</span>
			</a>
		{/if}
	</div>
{/if}

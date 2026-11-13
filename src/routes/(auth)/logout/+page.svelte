<script>
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { createLogoutSubmitHandler } from '$lib/utils/logout';
	import { enhance } from '$app/forms';
	import Icon from '@iconify/svelte';

	let { data } = $props();
	const auth = getAuthContext();
	let submitting = $state(false);
	const handleLogoutSubmit = createLogoutSubmitHandler({
		auth,
		onSubmittingChange: (v) => {
			submitting = v;
		}
	});
</script>

<div class="flex min-h-[70vh] items-center justify-center px-4">
	<div class="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg">
		<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
			<Icon icon="ph:sign-out-bold" class="text-3xl" />
		</div>
		<h1 class="text-xl font-black text-slate-900">로그아웃 하시겠습니까?</h1>
		<p class="mt-2 text-sm text-slate-600">
			{#if data?.username}
				현재 계정(<span class="font-bold text-slate-800">{data.username}</span>)의 세션을 안전하게 종료합니다.
			{:else}
				현재 기기의 세션을 안전하게 종료합니다.
			{/if}
		</p>

		<div class="mt-6 flex items-center justify-center gap-3">
			<a
				href="/"
				class="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 transition"
			>
				취소
			</a>
			<form
				method="POST"
				action="/logout"
				class="flex-1"
				use:enhance={handleLogoutSubmit}
			>
				<input type="hidden" name="action" value="logout" />
				<button
					type="submit"
					disabled={submitting}
					class="w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-rose-700 disabled:opacity-60 transition cursor-pointer"
				>
					{submitting ? '로그아웃 중...' : '로그아웃'}
				</button>
			</form>
		</div>
	</div>
</div>

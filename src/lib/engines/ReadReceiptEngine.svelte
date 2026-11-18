<script>
	/**
	 * @file ReadReceiptEngine.svelte
	 * @description 게시글 열람 확인(읽음/안읽음) 서비스 엔진
	 * @prop {{ id: number }} post
	 * @prop {{ auto_mark?: boolean, show_unread?: boolean }} [config]
	 */
	import { untrack } from 'svelte';
	import * as readApi from '$lib/api/readReceipt';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatDateTime } from '$lib/utils';
	import { formatApiError } from '$lib/utils/error';
	import Icon from '@iconify/svelte';

	const auth = getAuthContext();

	let { post, config = {} } = $props();

	let summary = $state(/** @type {readApi.ReadReceiptSummary} */ ({
		post_id: 0,
		read_count: 0,
		unread_count: 0,
		readers: [],
		unread_users: [],
		my_read: null
	}));
	let loading = $state(true);
	let marking = $state(false);
	let activeTab = $state(/** @type {'readers' | 'unread'} */ ('readers'));
	let lastMarkedPostId = $state(/** @type {number | null} */ (null));

	async function loadReceipts() {
		if (!post?.id) return;
		loading = true;
		try {
			if (auth.user && config?.auto_mark !== false && lastMarkedPostId !== post.id) {
				lastMarkedPostId = post.id;
				summary = await readApi.markPostRead(post.id);
			} else {
				summary = await readApi.getReadReceipts(post.id);
			}
		} catch (e) {
			console.error('[ReadReceiptEngine] 열람 정보 조회 실패:', e);
		} finally {
			loading = false;
		}
	}

	async function handleManualMark() {
		if (!auth.user) {
			toast.warning('로그인 후 이용할 수 있습니다.');
			return;
		}
		if (!post?.id || marking) return;
		marking = true;
		try {
			summary = await readApi.markPostRead(post.id);
			toast.success('읽음 확인이 기록되었습니다.');
		} catch (e) {
			toast.error('읽음 확인 실패: ' + formatApiError(e, '오류'));
		} finally {
			marking = false;
		}
	}

	$effect(() => {
		const pid = post?.id;
		if (pid) {
			untrack(() => {
				loadReceipts();
			});
		}
	});
</script>

<div class="read-receipt-engine space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-2">
			<Icon icon="ph:eye-bold" class="h-5 w-5 text-emerald-600" />
			<span class="text-sm font-black text-slate-800">열람 확인 (읽음 / 안읽음)</span>
			<span class="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-black text-emerald-700">
				읽음 {summary.read_count}명
			</span>
			{#if config?.show_unread !== false}
				<span class="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-black text-slate-600">
					미열람 {summary.unread_count}명
				</span>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			{#if summary.my_read}
				<span class="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
					<Icon icon="ph:check-circle-fill" class="h-4 w-4" />
					확인 완료 ({formatDateTime(summary.my_read.first_read_at)})
				</span>
			{:else if auth.user}
				<button
					type="button"
					disabled={marking}
					onclick={handleManualMark}
					class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-black text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
				>
					<Icon icon="ph:check-bold" class="h-3.5 w-3.5" />
					{marking ? '처리 중...' : '읽음 확인'}
				</button>
			{/if}
		</div>
	</div>

	{#if config?.show_unread !== false}
		<div class="flex gap-2 border-b border-slate-200">
			<button
				type="button"
				onclick={() => (activeTab = 'readers')}
				class="px-3 py-2 text-xs font-black transition {activeTab === 'readers'
					? 'border-b-2 border-emerald-600 text-emerald-700'
					: 'text-slate-400 hover:text-slate-700'}"
			>
				읽은 사람 ({summary.read_count})
			</button>
			<button
				type="button"
				onclick={() => (activeTab = 'unread')}
				class="px-3 py-2 text-xs font-black transition {activeTab === 'unread'
					? 'border-b-2 border-slate-700 text-slate-900'
					: 'text-slate-400 hover:text-slate-700'}"
			>
				안 읽은 사람 ({summary.unread_count})
			</button>
		</div>
	{/if}

	{#if loading}
		<div class="py-4 text-center text-xs font-bold text-slate-400">열람 이력을 불러오는 중...</div>
	{:else if activeTab === 'readers' || config?.show_unread === false}
		{#if summary.readers.length === 0}
			<p class="py-3 text-xs font-medium text-slate-400">아직 열람한 사용자가 없습니다.</p>
		{:else}
			<div class="flex flex-wrap gap-2">
				{#each summary.readers as r (r.user_id)}
					<div class="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-1.5 text-xs">
						<span class="font-black text-slate-800">{r.display_name}</span>
						<span class="text-[11px] text-slate-500">{formatDateTime(r.first_read_at)}</span>
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		{#if summary.unread_users.length === 0}
			<p class="py-3 text-xs font-bold text-emerald-600">모든 활성 사용자가 열람했습니다.</p>
		{:else}
			<div class="flex flex-wrap gap-2">
				{#each summary.unread_users as u (u.user_id)}
					<span class="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
						{u.display_name}
					</span>
				{/each}
			</div>
		{/if}
	{/if}
</div>

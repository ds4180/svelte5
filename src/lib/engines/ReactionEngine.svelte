<script>
	/**
	 * @file ReactionEngine.svelte
	 * @description 게시글 반응(좋아요/싫어요) 서비스 엔진
	 * @prop {{ id: number }} post
	 * @prop {{ show_dislike?: boolean }} [config]
	 */
	import * as reactionApi from '$lib/api/reaction';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatApiError } from '$lib/utils/error';
	import ServiceLockNotice from '$lib/components/ServiceLockNotice.svelte';
	import { resolveServicePermission } from '$lib/utils/servicePermission';
	import Icon from '@iconify/svelte';

	const auth = getAuthContext();

	let { post, config = {}, permissions = null } = $props();
	const perm = $derived(resolveServicePermission(permissions, auth.user));

	let summary = $state(
		/** @type {reactionApi.ReactionSummary} */ ({
			post_id: 0,
			counts: {},
			my_reaction: null,
			total: 0
		})
	);
	let loading = $state(true);
	let submitting = $state(false);

	async function loadReactions() {
		if (!post?.id) return;
		loading = true;
		try {
			summary = await reactionApi.getReactions(post.id);
		} catch (e) {
			console.error('[ReactionEngine] 반응 조회 실패:', e);
		} finally {
			loading = false;
		}
	}

	/** @param {'like' | 'dislike'} type */
	async function handleToggle(type) {
		if (!perm.can_write) {
			toast.warning(perm.message || '사용 권한이 없습니다.');
			return;
		}
		if (!post?.id || submitting) return;
		submitting = true;
		try {
			summary = await reactionApi.toggleReaction(post.id, type);
		} catch (e) {
			toast.error('반응 처리 실패: ' + formatApiError(e, '오류'));
		} finally {
			submitting = false;
		}
	}

	$effect(() => {
		if (post?.id) {
			loadReactions();
		}
	});
</script>

<div class="reaction-engine flex flex-wrap items-center justify-between gap-3">
	<div class="flex items-center gap-2">
		<Icon icon="ph:heart-bold" class="h-5 w-5 text-rose-500" />
		<span class="text-sm font-black text-slate-800">게시글 반응</span>
		<span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
			총 {summary.total}
		</span>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		{#if !perm.can_write}
			<ServiceLockNotice permission={perm} serviceLabel="게시글 반응" compact={true} />
		{/if}
		<button
			type="button"
			disabled={loading || submitting || !perm.can_write}
			onclick={() => handleToggle('like')}
			class="inline-flex items-center gap-2 rounded-2xl border-2 px-4 py-2 text-xs font-black transition-all active:scale-95 disabled:opacity-50 {summary.my_reaction ===
			'like'
				? 'border-blue-600 bg-blue-600 text-white shadow-sm'
				: 'border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-600'}"
		>
			<Icon
				icon={summary.my_reaction === 'like' ? 'ph:thumbs-up-fill' : 'ph:thumbs-up-bold'}
				class="h-4 w-4"
			/>
			<span>좋아요</span>
			<span
				class="rounded-full px-1.5 py-0.5 text-[11px] {summary.my_reaction === 'like'
					? 'bg-white/20 text-white'
					: 'bg-slate-100 text-slate-600'}"
			>
				{summary.counts?.like || 0}
			</span>
		</button>

		{#if config?.show_dislike !== false}
			<button
				type="button"
				disabled={loading || submitting || !perm.can_write}
				onclick={() => handleToggle('dislike')}
				class="inline-flex items-center gap-2 rounded-2xl border-2 px-4 py-2 text-xs font-black transition-all active:scale-95 disabled:opacity-50 {summary.my_reaction ===
				'dislike'
					? 'border-rose-600 bg-rose-600 text-white shadow-sm'
					: 'border-slate-200 bg-white text-slate-700 hover:border-rose-400 hover:text-rose-600'}"
			>
				<Icon
					icon={summary.my_reaction === 'dislike' ? 'ph:thumbs-down-fill' : 'ph:thumbs-down-bold'}
					class="h-4 w-4"
				/>
				<span>싫어요</span>
				<span
					class="rounded-full px-1.5 py-0.5 text-[11px] {summary.my_reaction === 'dislike'
						? 'bg-white/20 text-white'
						: 'bg-slate-100 text-slate-600'}"
				>
					{summary.counts?.dislike || 0}
				</span>
			</button>
		{/if}
	</div>
</div>

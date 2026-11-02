<script>
	/**
	 * ============================================================================
	 * [통합 미니앱 허브 대시보드 (v1/pages/miniapps/+page.svelte)]
	 * ============================================================================
	 * 
	 * 💡 이 페이지의 역할:
	 * 단 하나의 DB 테이블(miniapp_items)에서 메모, 알람, 지시사항, 메시지, 전사공지를
	 * 통합 조회하고 조작하는 마이크로 텍스트 액션 피드 대시보드입니다.
	 * 
	 * ✨ 제공 기능:
	 * 1. 여러 줄 텍스트를 자유롭게 적을 수 있는 Textarea 기반 메모 에디터 (저장/취소)
	 * 2. 4대 미니앱 카테고리별 실시간 뱃지 통계 카드
	 * 3. 지시사항 업무 완료 처리(PENDING ➔ ONGOING ➔ COMPLETED) 및 알림 확인(READ)
	 * 4. 카테고리별 필터 및 딥링크 앵커링 스크롤
	 */

	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Icon from '@iconify/svelte';
	import FeedItem from '$lib/components/Miniapps/FeedItem.svelte';
	import { miniappStore } from '$lib/runes/miniapps.svelte.js';
	import { toast } from '$lib/runes/toast.svelte.js';

	// 📝 새 메모 작성 상태
	let memoTitle = $state('');
	let memoContent = $state('');
	let memoCategory = $state('MEMO'); // 'MEMO' | 'ALARM'
	let memoAlarmTime = $state('');
	let isSaving = $state(false);

	// 🔍 탭 필터: 'ALL' | 'NOTIFICATION' | 'INSTRUCTION' | 'MEMO' | 'MESSAGE'
	let activeTab = $state('ALL');

	onMount(() => {
		// 🛡️ [레이아웃 보호] 브라우저 스크롤 오프셋을 즉시 (0, 0) 원점으로 강제 고정
		if (typeof window !== 'undefined') {
			window.scrollTo(0, 0);
		}

		miniappStore.refresh();

		// 쿼리 파라미터(?tab=...) 또는 해시(#...) 기반 탭 전환 (화면 스크롤 없이 탭만 안전하게 전환)
		const targetTab = page.url.searchParams.get('tab') || window.location.hash.replace('#', '');
		if (targetTab) {
			/** @type {Record<string, string>} */
			const tabMap = {
				'notifications': 'NOTIFICATION',
				'notification': 'NOTIFICATION',
				'instructions': 'INSTRUCTION',
				'instruction': 'INSTRUCTION',
				'alarms': 'ALARM',
				'alarm': 'ALARM',
				'memo': 'MEMO',
				'messaging': 'MESSAGE',
				'message': 'MESSAGE'
			};
			if (tabMap[targetTab]) {
				activeTab = tabMap[targetTab];
			}
		}
	});

	/**
	 * 💾 새 메모/알람 저장 처리
	 */
	async function handleSaveMemo() {
		if (!memoContent.trim()) {
			alert('메모 내용을 입력해 주세요.');
			return;
		}

		isSaving = true;
		try {
			await miniappStore.addItem(memoCategory, memoContent.trim(), {
				title: memoTitle.trim() || null,
				target_time: memoAlarmTime ? new Date(memoAlarmTime).toISOString() : null
			});
			// 입력 폼 초기화
			handleCancelMemo();
			if (toast?.success) {
				toast.success('새 메모가 안전하게 저장되었습니다.');
			}
		} catch (/** @type {any} */ e) {
			alert('메모 저장에 실패했습니다: ' + e.message);
		} finally {
			isSaving = false;
		}
	}

	/**
	 * ✕ 메모 입력 취소 및 비우기
	 */
	function handleCancelMemo() {
		memoTitle = '';
		memoContent = '';
		memoCategory = 'MEMO';
		memoAlarmTime = '';
	}

	/**
	 * 🎯 아이템 액션 처리 (상태 변경, 완료 체크, 삭제 등)
	 * @param {any} id
	 * @param {any} action
	 * @param {any} value
	 */
	async function handleAction(id, action, value) {
		if (action === 'status') {
			await miniappStore.updateItem(id, { status: value });
		} else if (action === 'toggle_done') {
			await miniappStore.updateItem(id, { is_done: value });
		} else if (action === 'delete') {
			if (confirm('이 항목을 정말 삭제하시겠습니까?')) {
				await miniappStore.deleteItem(id);
			}
		} else if (action === 'reply') {
			const replyText = prompt('답장 메시지를 입력하세요:');
			if (replyText && replyText.trim()) {
				// 원본 아이템의 발신자에게 메시지 발송
				const targetItem = miniappStore.items.find((i) => i.id === id);
				if (targetItem && targetItem.sender_id) {
					await miniappStore.addItem('MESSAGE', replyText.trim(), {
						receiver_id: targetItem.sender_id,
						title: `Re: ${targetItem.title || '메시지 답장'}`
					});
					alert('답장이 전송되었습니다.');
				}
			}
		}
	}

	// 필터링된 피드 아이템 목록
	let filteredItems = $derived.by(() => {
		if (activeTab === 'ALL') return miniappStore.items;
		if (activeTab === 'NOTIFICATION') {
			return miniappStore.items.filter((i) => 
				i.category === 'NOTIFICATION' || 
				i.category === 'NOTICE' || 
				i.category === 'URGENT_NOTICE' || 
				i.type === 'NOTIFICATION' ||
				i.type === 'NOTICE' ||
				i.type === 'URGENT_NOTICE'
			);
		}
		return miniappStore.items.filter((i) => i.type === activeTab || i.category === activeTab);
	});
</script>

<svelte:head>
	<title>미니앱 통합 허브 | jeju.live</title>
</svelte:head>

<div class="mx-auto w-full max-w-5xl px-3 py-6 font-['Noto_Sans_KR','Outfit'] md:px-6 md:py-10 pb-36 min-w-0">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 실시간 동기화 상태 -->
	<!-- ===================================================================== -->
	<header class="mb-8 flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-emerald-400 uppercase">
					<span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
					Micro Text Engine
				</span>
				<span class="text-xs font-bold text-slate-400">v1/pages/miniapps</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-4xl">
				미니앱 <span class="not-italic text-blue-600">통합 피드 허브</span>
			</h1>
			<p class="mt-1 text-xs font-bold text-slate-500 md:text-sm">
				메모, 알람, 업무 지시, 메시지, 전사 공지를 단 하나의 화면에서 실시간 관리합니다.
			</p>
		</div>

		<button
			type="button"
			onclick={() => miniappStore.refresh()}
			class="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-blue-600 active:scale-95"
		>
			<Icon icon="solar:restart-bold" class="text-base {miniappStore.loading ? 'animate-spin' : ''}" />
			<span>새로고침</span>
		</button>
	</header>

	<!-- ===================================================================== -->
	<!-- 2. 상단 4대 뱃지 요약 카드 (클릭 시 즉시 필터 전환) -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 mb-8">
		<!-- 카드 1: 알림/공지 -->
		<button
			type="button"
			onclick={() => (activeTab = 'NOTIFICATION')}
			class="flex flex-col justify-between rounded-2xl border-2 p-4 text-left transition {activeTab === 'NOTIFICATION' ? 'border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/30' : 'border-slate-200 bg-white hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-black tracking-wider text-slate-400 uppercase">Notice / Alert</span>
				<Icon icon="ph:bell-ringing-fill" class="text-lg text-emerald-600" />
			</div>
			<div class="mt-3 flex items-baseline justify-between">
				<span class="text-2xl font-black text-slate-900">
					{miniappStore.counts.NOTIFICATION}
					<span class="text-xs font-normal text-slate-500">건</span>
				</span>
				<span class="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">공지·중요공지</span>
			</div>
		</button>

		<!-- 카드 2: 지시사항 -->
		<button
			type="button"
			onclick={() => (activeTab = 'INSTRUCTION')}
			class="flex flex-col justify-between rounded-2xl border-2 p-4 text-left transition {activeTab === 'INSTRUCTION' ? 'border-indigo-600 bg-indigo-50/70 shadow-md ring-2 ring-indigo-500/30' : 'border-slate-200 bg-white hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-black tracking-wider text-slate-400 uppercase">Instruction</span>
				<Icon icon="ph:info-fill" class="text-lg text-indigo-600" />
			</div>
			<div class="mt-3 flex items-baseline justify-between">
				<span class="text-2xl font-black text-slate-900">
					{miniappStore.counts.INSTRUCTION}
					<span class="text-xs font-normal text-slate-500">건</span>
				</span>
				<span class="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">업무지시</span>
			</div>
		</button>

		<!-- 카드 3: 메모 및 할 일 -->
		<button
			type="button"
			onclick={() => (activeTab = 'MEMO')}
			class="flex flex-col justify-between rounded-2xl border-2 p-4 text-left transition {activeTab === 'MEMO' ? 'border-amber-600 bg-amber-50/70 shadow-md ring-2 ring-amber-500/30' : 'border-slate-200 bg-white hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-black tracking-wider text-slate-400 uppercase">My Memo</span>
				<Icon icon="ph:notepad-fill" class="text-lg text-amber-500" />
			</div>
			<div class="mt-3 flex items-baseline justify-between">
				<span class="text-2xl font-black text-slate-900">
					{miniappStore.counts.MEMO}
					<span class="text-xs font-normal text-slate-500">건</span>
				</span>
				<span class="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">미완료</span>
			</div>
		</button>

		<!-- 카드 4: 메시지 -->
		<button
			type="button"
			onclick={() => (activeTab = 'MESSAGE')}
			class="flex flex-col justify-between rounded-2xl border-2 p-4 text-left transition {activeTab === 'MESSAGE' ? 'border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-500/30' : 'border-slate-200 bg-white hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-black tracking-wider text-slate-400 uppercase">Message</span>
				<Icon icon="ph:paper-plane-tilt-fill" class="text-lg text-blue-600" />
			</div>
			<div class="mt-3 flex items-baseline justify-between">
				<span class="text-2xl font-black text-slate-900">
					{miniappStore.counts.MESSAGE}
					<span class="text-xs font-normal text-slate-500">건</span>
				</span>
				<span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">쪽지/소통</span>
			</div>
		</button>
	</div>

	<!-- ===================================================================== -->
	<!-- 3. 메모 에디터 폼 (Textarea + 저장하기 + 취소 레이아웃) -->
	<!-- ===================================================================== -->
	<section class="mb-10 rounded-3xl border-2 border-slate-900 bg-slate-900 p-6 md:p-8 shadow-xl text-white">
		<div class="flex items-center justify-between mb-4">
			<div class="flex items-center gap-2.5">
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-slate-950 shadow-md">
					<Icon icon="ph:pencil-line-bold" class="text-xl" />
				</div>
				<div>
					<h3 class="text-base font-black uppercase tracking-tight italic">
						새로운 메모 & 개인 할 일 작성
					</h3>
					<p class="text-xs text-slate-400">
						기억해 둘 업무 지침, 차량 점검 메모, 당일 할 일을 여러 줄로 자유롭게 기록하세요.
					</p>
				</div>
			</div>

			<!-- 메모 / 알람 모드 토글 -->
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => (memoCategory = 'MEMO')}
					class="rounded-xl px-3 py-1.5 text-xs font-black transition {memoCategory === 'MEMO' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'}"
				>
					📝 일반 메모
				</button>
				<button
					type="button"
					onclick={() => (memoCategory = 'ALARM')}
					class="rounded-xl px-3 py-1.5 text-xs font-black transition {memoCategory === 'ALARM' ? 'bg-rose-500 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'}"
				>
					⏰ 알람 리마인더
				</button>
			</div>
		</div>

		<!-- 입력 폼 필드들 -->
		<div class="space-y-3">
			<!-- 제목 (선택) -->
			<input
				type="text"
				bind:value={memoTitle}
				placeholder="메모 제목 (선택 사항)"
				class="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-2.5 text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
			/>

			<!-- 본문 Textarea (멀티라인 쾌적 입력) -->
			<textarea
				bind:value={memoContent}
				rows="4"
				placeholder="기억해야 할 내용을 입력하세요... (여러 줄 입력 가능, Shift+Enter로 줄바꿈)"
				class="w-full rounded-2xl border border-slate-700 bg-slate-800/90 p-4 text-xs font-medium leading-relaxed text-white placeholder-slate-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition resize-y"
			></textarea>

			<!-- 알람 일시 선택 (알람 모드일 때만 노출) -->
			{#if memoCategory === 'ALARM'}
				<div class="flex items-center gap-3 rounded-xl border border-rose-900/60 bg-rose-950/40 p-3 text-xs">
					<Icon icon="ph:alarm-bold" class="text-rose-400 text-lg shrink-0" />
					<span class="font-bold text-rose-300 shrink-0">알람 울림 시각:</span>
					<input
						type="datetime-local"
						bind:value={memoAlarmTime}
						class="rounded-lg border border-rose-800 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-rose-400"
					/>
				</div>
			{/if}

			<!-- 하단 액션 버튼 바: [저장하기] & [취소] -->
			<div class="flex items-center justify-between pt-2">
				<span class="text-[11px] font-medium text-slate-400">
					💡 작성된 메모는 오직 본인에게만 보이며, 언제든 완료 체크 및 삭제가 가능합니다.
				</span>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={handleCancelMemo}
						disabled={isSaving || (!memoContent && !memoTitle)}
						class="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-40"
					>
						취소
					</button>

					<button
						type="button"
						onclick={handleSaveMemo}
						disabled={isSaving || !memoContent.trim()}
						class="flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2 text-xs font-black text-slate-950 shadow-md transition hover:bg-amber-400 active:scale-95 disabled:opacity-40"
					>
						{#if isSaving}
							<Icon icon="solar:restart-bold" class="text-sm animate-spin" />
							<span>저장 중...</span>
						{:else}
							<Icon icon="solar:disk-bold" class="text-sm" />
							<span>저장하기</span>
						{/if}
					</button>
				</div>
			</div>
		</div>
	</section>

	<!-- ===================================================================== -->
	<!-- 4. 액션 피드 탭 네비게이션 필터 -->
	<!-- ===================================================================== -->
	<div class="flex w-full min-w-0 items-center justify-between border-b-2 border-slate-200 pb-3 mb-6 gap-2">
		<div class="flex flex-1 min-w-0 items-center gap-1 overflow-x-auto scrollbar-none py-1">
			<button
				type="button"
				onclick={() => (activeTab = 'ALL')}
				class="rounded-xl px-4 py-2 text-xs font-black transition {activeTab === 'ALL' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}"
			>
				전체 피드 ({miniappStore.items.length})
			</button>
			<button
				type="button"
				onclick={() => (activeTab = 'NOTIFICATION')}
				class="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition {activeTab === 'NOTIFICATION' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}"
			>
				<span>공지/알림</span>
				{#if miniappStore.counts.NOTIFICATION > 0}
					<span class="rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[10px] font-black">
						{miniappStore.counts.NOTIFICATION}
					</span>
				{/if}
			</button>
			<button
				type="button"
				onclick={() => (activeTab = 'INSTRUCTION')}
				class="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition {activeTab === 'INSTRUCTION' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}"
			>
				<span>업무 지시</span>
				{#if miniappStore.counts.INSTRUCTION > 0}
					<span class="rounded-full bg-indigo-100 text-indigo-800 px-1.5 py-0.2 text-[10px] font-black">
						{miniappStore.counts.INSTRUCTION}
					</span>
				{/if}
			</button>
			<button
				type="button"
				onclick={() => (activeTab = 'MEMO')}
				class="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition {activeTab === 'MEMO' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}"
			>
				<span>개인 메모</span>
				{#if miniappStore.counts.MEMO > 0}
					<span class="rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.2 text-[10px] font-black">
						{miniappStore.counts.MEMO}
					</span>
				{/if}
			</button>
			<button
				type="button"
				onclick={() => (activeTab = 'MESSAGE')}
				class="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition {activeTab === 'MESSAGE' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}"
			>
				<span>메시지</span>
				{#if miniappStore.counts.MESSAGE > 0}
					<span class="rounded-full bg-blue-100 text-blue-800 px-1.5 py-0.2 text-[10px] font-black">
						{miniappStore.counts.MESSAGE}
					</span>
				{/if}
			</button>
		</div>

		<span class="text-xs font-bold text-slate-400 hidden sm:inline">
			총 <strong class="text-blue-600">{filteredItems.length}</strong>개 항목
		</span>
	</div>

	<!-- ===================================================================== -->
	<!-- 5. 액션 피드 카드 그리드 (Feed Grid) -->
	<!-- ===================================================================== -->
	{#if miniappStore.loading}
		<div class="flex flex-col items-center justify-center py-20 text-slate-400">
			<Icon icon="solar:restart-bold" class="h-10 w-10 animate-spin text-blue-600" />
			<span class="mt-3 text-xs font-bold">미니앱 피드를 불러오는 중입니다...</span>
		</div>
	{:else if filteredItems.length === 0}
		<!-- Empty State 디자인 -->
		<div class="rounded-3xl border-2 border-dashed border-slate-300 bg-white py-20 text-center text-slate-400">
			<Icon icon="solar:box-minimalistic-bold-duotone" class="mx-auto h-16 w-16 text-slate-300" />
			<h4 class="mt-3 text-base font-black text-slate-700">해당 조건의 미니앱 항목이 없습니다.</h4>
			<p class="mt-1 text-xs text-slate-400">
				상단의 메모 작성창을 통해 새로운 메모를 남기거나 업무 지시를 등록해 보세요.
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each filteredItems as item (item.id)}
				<FeedItem {item} onAction={(/** @type {any} */ act, /** @type {any} */ val) => handleAction(item.id, act, val)} />
			{/each}
		</div>
	{/if}
</div>

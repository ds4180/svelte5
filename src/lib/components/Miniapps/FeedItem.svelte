<script>
	/**
	 * ============================================================================
	 * [미니앱 통합 액션 아이템 컴포넌트 (FeedItem.svelte)]
	 * ============================================================================
	 */
	import Icon from '@iconify/svelte';
	import { fly, fade } from 'svelte/transition';

	let { 
		item = {
			id: null,
			type: 'MEMO',
			title: null,
			content: '',
			status: 'PENDING',
			sender: null,
			sender_name: null,
			created_at: new Date().toISOString(),
			target_time: null,
			link: null,
			is_done: false
		},
		onAction = () => {}
	} = $props();

	// 타입별 테마 설정
	/** @type {Record<string, any>} */
	const typeConfig = {
		MEMO: {
			icon: 'ph:notepad-fill',
			label: '메모',
			color: 'text-amber-600',
			bgColor: 'bg-amber-50/60',
			borderColor: 'border-amber-200',
			badgeClass: 'bg-amber-100 text-amber-800'
		},
		ALARM: {
			icon: 'ph:alarm-fill',
			label: '알람',
			color: 'text-rose-600',
			bgColor: 'bg-rose-50/60',
			borderColor: 'border-rose-200',
			badgeClass: 'bg-rose-100 text-rose-800'
		},
		INSTRUCTION: {
			icon: 'ph:info-fill',
			label: '지시사항',
			color: 'text-indigo-600',
			bgColor: 'bg-indigo-50/60',
			borderColor: 'border-indigo-200',
			badgeClass: 'bg-indigo-100 text-indigo-800'
		},
		MESSAGE: {
			icon: 'ph:paper-plane-tilt-fill',
			label: '메시지',
			color: 'text-blue-600',
			bgColor: 'bg-blue-50/60',
			borderColor: 'border-blue-200',
			badgeClass: 'bg-blue-100 text-blue-800'
		},
		NOTIFICATION: {
			icon: 'ph:bell-ringing-fill',
			label: '공지알림',
			color: 'text-emerald-600',
			bgColor: 'bg-emerald-50/60',
			borderColor: 'border-emerald-200',
			badgeClass: 'bg-emerald-100 text-emerald-800'
		}
	};

	const config = $derived(typeConfig[item.type] || typeConfig[item.category] || typeConfig.MEMO);

	function handleStatusToggle() {
		/** @type {Record<string, string>} */
		const nextStatus = {
			'PENDING': 'ONGOING',
			'ONGOING': 'COMPLETED',
			'COMPLETED': 'PENDING'
		};
		const key = String(item.status || 'PENDING');
		onAction('status', nextStatus[key] || 'COMPLETED');
	}

	/** @param {any} dtStr */
	function formatDateTime(dtStr) {
		if (!dtStr) return '';
		const d = new Date(dtStr);
		return d.toLocaleString('ko-KR', {
			month: 'numeric',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div 
	in:fly={{ y: 15, duration: 300 }}
	out:fade={{ duration: 150 }}
	class="group relative flex flex-col justify-between rounded-2xl border-2 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg {config.bgColor} {config.borderColor}"
>
	<!-- 카드 상단: 아이콘, 카테고리 뱃지, 상태 버튼 -->
	<div class="flex items-center justify-between mb-3">
		<div class="flex items-center gap-2">
			<div class="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100">
				<Icon icon={config.icon} class="h-4 w-4 {config.color}" />
			</div>
			<span class="rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider {config.badgeClass}">
				{config.label}
			</span>
			{#if item.sender_name || item.sender}
				<span class="text-[11px] font-bold text-slate-500">
					From: <strong class="text-slate-800">{item.sender_name || item.sender}</strong>
				</span>
			{/if}
		</div>

		<!-- 상태 뱃지 및 제어 -->
		{#if item.type === 'INSTRUCTION' || item.category === 'INSTRUCTION'}
			{#if item.status === 'CONFIRMED' || item.status === 'COMPLETED'}
				<span class="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-black text-white shadow-sm flex items-center gap-1">
					<Icon icon="mdi:check-circle" class="w-3.5 h-3.5" /> 확인 완료
				</span>
			{:else}
				<button 
					type="button"
					class="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-1 text-[11px] font-black text-white transition active:scale-95 shadow-sm flex items-center gap-1"
					onclick={() => onAction('status', 'CONFIRMED')}
					title="지시사항 인지 및 수신 확인"
				>
					<Icon icon="mdi:checkbox-marked-circle-outline" class="w-3.5 h-3.5" /> 지시 확인
				</button>
			{/if}
		{:else if item.type === 'NOTIFICATION' || item.category === 'NOTIFICATION'}
			{#if item.status === 'PENDING'}
				<button
					type="button"
					class="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
					onclick={() => onAction('status', 'READ')}
				>
					확인 완료 ✓
				</button>
			{:else}
				<span class="text-[10px] font-bold text-slate-400">확인됨</span>
			{/if}
		{/if}
	</div>

	<!-- 카드 본문: 제목 및 내용 -->
	<div class="flex-1 space-y-1.5 my-1">
		{#if item.title}
			<h4 class="text-sm font-black text-slate-900 leading-tight">
				{item.title}
			</h4>
		{/if}
		<p class="text-xs font-medium leading-relaxed text-slate-700 whitespace-pre-wrap break-words {item.is_done || item.status === 'COMPLETED' ? 'line-through opacity-50' : ''}">
			{item.content}
		</p>
		
		{#if item.link}
			<a
				href={item.link}
				class="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline mt-1"
			>
				<span>관련 업무 화면으로 이동</span>
				<Icon icon="ph:arrow-square-out-bold" class="text-xs" />
			</a>
		{/if}
	</div>

	<!-- 카드 하단: 시간 및 작업 버튼군 -->
	<div class="mt-4 flex items-center justify-between border-t border-slate-200/50 pt-3">
		<span class="text-[10px] font-medium text-slate-400">
			{formatDateTime(item.created_at)}
			{#if item.target_time}
				· <span class="font-bold text-rose-600">알람: {formatDateTime(item.target_time)}</span>
			{/if}
		</span>

		<div class="flex items-center gap-1">
			<!-- 메모 완료 체크 버튼 -->
			{#if item.type === 'MEMO'}
				<button 
					type="button"
					class="flex h-7 w-7 items-center justify-center rounded-lg transition {item.is_done || item.status === 'COMPLETED' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 hover:text-emerald-600 border border-slate-200'}"
					onclick={() => onAction('toggle_done', !(item.is_done || item.status === 'COMPLETED'))}
					title={item.is_done ? '완료 취소' : '할 일 완료 체크'}
				>
					<Icon icon="ph:check-bold" class="text-xs" />
				</button>
			{/if}

			<!-- 메시지 답장 버튼 -->
			{#if item.type === 'MESSAGE'}
				<button 
					type="button"
					class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-700 transition hover:bg-blue-600 hover:text-white"
					onclick={() => onAction('reply')}
				>
					답장
				</button>
			{/if}

			<!-- 삭제 버튼 -->
			<button 
				type="button"
				class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 opacity-60 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
				onclick={() => onAction('delete')}
				title="삭제"
			>
				<Icon icon="ph:trash-bold" class="text-xs" />
			</button>
		</div>
	</div>
</div>

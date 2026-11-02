<script>
	import Icon from '@iconify/svelte';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { formatDateTime } from '$lib/utils';

	let {
		alerts = [],
		loading = false,
		onToggle,
		onEdit,
		onDelete,
		onOpenAck
	} = $props();

	// 🔍 카테고리 필터: 'ALL' | 'NOTICE' | 'URGENT_NOTICE' | 'INSTRUCTION'
	let selectedCategory = $state('ALL');

	// 카테고리별 카운트 계산
	const countAll = $derived(alerts.length);
	const countNotice = $derived(alerts.filter(a => a.category === 'NOTICE' || a.category === 'NOTIFICATION').length);
	const countUrgent = $derived(alerts.filter(a => a.category === 'URGENT_NOTICE').length);
	const countInstruction = $derived(alerts.filter(a => a.category === 'INSTRUCTION').length);

	// 필터링된 알림 목록
	const filteredAlerts = $derived.by(() => {
		if (selectedCategory === 'ALL') return alerts;
		if (selectedCategory === 'NOTICE') {
			return alerts.filter(a => a.category === 'NOTICE' || a.category === 'NOTIFICATION');
		}
		return alerts.filter(a => a.category === selectedCategory);
	});
</script>

<!-- 🔍 카테고리별 독립 분리 관리 탭 필터 바 -->
<div class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
	<div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
		<button
			type="button"
			class="btn btn-xs rounded-xl font-black transition-all {selectedCategory === 'ALL' ? 'btn-neutral text-white shadow-sm' : 'btn-ghost text-slate-600 hover:bg-slate-100'}"
			onclick={() => (selectedCategory = 'ALL')}
		>
			전체보기 ({countAll})
		</button>
		<button
			type="button"
			class="btn btn-xs rounded-xl font-black transition-all {selectedCategory === 'NOTICE' ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700' : 'btn-ghost text-blue-700 hover:bg-blue-50'}"
			onclick={() => (selectedCategory = 'NOTICE')}
		>
			📢 공지 ({countNotice})
		</button>
		<button
			type="button"
			class="btn btn-xs rounded-xl font-black transition-all {selectedCategory === 'URGENT_NOTICE' ? 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 animate-pulse' : 'btn-ghost text-rose-600 hover:bg-rose-50'}"
			onclick={() => (selectedCategory = 'URGENT_NOTICE')}
		>
			🚨 중요 공지 ({countUrgent})
		</button>
		<button
			type="button"
			class="btn btn-xs rounded-xl font-black transition-all {selectedCategory === 'INSTRUCTION' ? 'bg-purple-600 text-white shadow-sm hover:bg-purple-700' : 'btn-ghost text-purple-700 hover:bg-purple-50'}"
			onclick={() => (selectedCategory = 'INSTRUCTION')}
		>
			📋 지시사항 ({countInstruction})
		</button>
	</div>
	<div class="text-[11px] font-bold text-slate-400 px-2">
		필터 결과: <span class="text-slate-900 font-black">{filteredAlerts.length}</span>건
	</div>
</div>

<!-- 📊 알림 목록 테이블 (Desktop/Tablet) -->
<div
	class="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-lg sm:block md:rounded-[2rem] md:shadow-2xl"
>
	<table class="table w-full">
		<thead
			class="border-b border-slate-100 bg-slate-50 text-[8px] font-bold tracking-widest text-slate-500 uppercase md:text-[10px]"
		>
			<tr>
				<th class="px-3 py-4 md:px-5 md:py-4 w-[50px]">ID</th>
				<th class="min-w-[140px] max-w-[300px]">메시지 내용</th>
				<th class="w-[120px]">분류 / 대상</th>
				<th class="w-[85px]">레벨 / 유형</th>
				<th class="w-[125px]">노출 기간</th>
				<th class="w-[110px]">생성 / 활성</th>
				<th class="px-3 text-right md:px-6 w-[135px]">작업 (메뉴)</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-50">
			{#if loading}
				<tr>
					<td colspan="7" class="py-16 text-center md:py-32">
						<span class="loading loading-lg loading-bars text-blue-600"></span>
					</td>
				</tr>
			{:else if filteredAlerts.length === 0}
				<tr>
					<td
						colspan="7"
						class="py-16 text-center text-xl font-bold text-slate-300 italic md:py-32"
					>
						해당 분류의 알림이 없습니다.
					</td>
				</tr>
			{:else}
				{#each filteredAlerts as alert (alert.id)}
					<tr class="group transition-colors hover:bg-slate-50/50">
						<td class="px-3 py-3 md:px-5 md:py-4">
							<span
								class="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-[8px] text-slate-400 transition-colors group-hover:bg-white md:rounded-md md:text-[10px]"
							>
								{alert.id}
							</span>
						</td>
						<!-- 💬 메시지: 2줄 이상 전체 내용 자연 줄바꿈 노출 (너비 140~300px) -->
						<td class="py-3 md:py-4 min-w-[140px] max-w-[300px] !whitespace-normal">
							<span 
								class="block text-xs md:text-sm font-bold text-slate-900 leading-relaxed whitespace-pre-wrap break-words"
								title={alert.message}
							>
								{alert.message}
							</span>
						</td>
						<!-- 🏷️ 1. 분류 & 수신대상 (2줄 묶음) -->
						<td class="w-[120px]">
							<div class="flex flex-col gap-1 items-start">
								{#if alert.category === 'URGENT_NOTICE'}
									<span class="inline-flex items-center gap-1 rounded-md bg-rose-600 px-1.5 py-0.5 text-[8px] font-black text-white shadow-xs animate-pulse md:text-[9px]">
										🚨 중요 공지
									</span>
								{:else if alert.category === 'INSTRUCTION'}
									<span class="inline-flex items-center gap-1 rounded-md bg-purple-100 border border-purple-200 px-1.5 py-0.5 text-[8px] font-black text-purple-700 md:text-[9px]">
										📋 지시사항
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 rounded-md bg-blue-100 border border-blue-200 px-1.5 py-0.5 text-[8px] font-black text-blue-700 md:text-[9px]">
										📢 공지
									</span>
								{/if}
								{#if alert.target_group}
									<span class="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[8px] font-bold text-blue-700 max-w-[110px] truncate" title={alert.target_group}>
										<Icon icon="mdi:target" class="text-blue-500 shrink-0" />
										{alert.target_group}
									</span>
								{:else if alert.target_users}
									<span class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold text-slate-600">
										사원 {alert.target_users.split(',').length}명
									</span>
								{:else}
									<span class="rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700">
										전사 전체
									</span>
								{/if}
							</div>
						</td>
						<!-- 🎛️ 2. 레벨 & 위치/유형 (2줄 묶음) -->
						<td class="w-[85px]">
							<div class="flex flex-col gap-1 items-start">
								<div class="flex items-center gap-1">
									<span
										class="rounded-md px-1.5 py-0.5 text-[8px] font-black tracking-tighter md:text-[9px] {alert.level === 5
											? 'bg-red-100 text-red-700'
											: alert.level === 4
												? 'bg-purple-100 text-purple-700'
												: alert.level === 3
													? 'bg-yellow-100 text-yellow-700'
													: alert.level === 2
														? 'bg-green-100 text-green-700'
														: 'bg-blue-100 text-blue-700'}"
									>
										L{alert.level}
									</span>
									<span class="rounded-md px-1 py-0.5 text-[8px] font-bold {alert.position === 'bottom' ? 'bg-amber-100 text-amber-800' : alert.level >= 3 ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'}">
										{alert.level >= 3 ? '중앙' : alert.position === 'bottom' ? '하단' : '상단'}
									</span>
								</div>
								<span
									class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-black tracking-tighter text-slate-600 capitalize md:text-[9px]"
								>
									{alert.style}
								</span>
							</div>
						</td>
						<!-- 📅 3. 노출 기간 (2줄) -->
						<td class="w-[125px] text-[8px] font-medium text-slate-500 md:text-[10px]">
							<div class="flex flex-col gap-0.5">
								<span>시작: {formatDateTime(alert.start_date)}</span>
								<span class="text-slate-400">종료: {formatDateTime(alert.end_date)}</span>
							</div>
						</td>
						<!-- ⏱️ 4. 생성일 & 활성 상태 (2줄 묶음) -->
						<td class="w-[110px]">
							<div class="flex flex-col gap-1 items-start">
								<span class="text-[8px] font-medium text-slate-400 md:text-[10px]">
									{formatDateTime(alert.create_date)}
								</span>
								<button
									class="btn btn-ghost btn-xs h-5 min-h-5 px-1.5 text-[9px] font-bold {alert.is_active ? 'text-green-600 bg-green-50/70' : 'text-red-500 bg-red-50/70'} rounded-md"
									onclick={() => onToggle?.(alert.id)}
								>
									<Icon
										icon="mdi:toggle-{alert.is_active ? 'switch' : 'switch-off'}"
										class="h-3.5 w-3.5"
									/>
									{alert.is_active ? '활성' : '비활성'}
								</button>
							</div>
						</td>
						<!-- 🛠️ 5. 메뉴: 2줄(2 rows) 컴팩트 레이아웃 -->
						<td class="px-3 text-right md:px-6 w-[135px]">
							<div class="flex flex-col gap-1 items-end">
								<!-- 1줄: 미리보기 & 수신현황 -->
								<div class="flex items-center gap-1 justify-end">
									<button
										class="btn rounded-md px-1.5 font-black text-slate-600 bg-slate-100 hover:bg-slate-200 btn-ghost btn-xs h-6 min-h-6 text-[9px]"
										onclick={() => alertState.send(alert.message, { level: alert.level, style: alert.style, position: alert.position || 'top', confirm_text: alert.confirm_text, redirect_url: alert.redirect_url })}
										title="미리보기"
									>
										<Icon icon="mdi:eye-outline" class="h-3 w-3" />
										미리보기
									</button>
									{#if alert.category === 'INSTRUCTION'}
										<button
											class="btn rounded-md px-1.5 font-black text-purple-600 bg-purple-50 hover:bg-purple-100 btn-ghost btn-xs h-6 min-h-6 text-[9px]"
											onclick={() => onOpenAck?.(alert)}
											title="기사님 수신 확인 현황"
										>
											<Icon icon="mdi:account-check-outline" class="h-3.5 w-3.5" />
											수신현황
										</button>
									{/if}
								</div>
								<!-- 2줄: 수정 & 삭제 -->
								<div class="flex items-center gap-1 justify-end">
									<button
										class="btn rounded-md px-1.5 font-black text-blue-600 bg-blue-50 hover:bg-blue-100 btn-ghost btn-xs h-6 min-h-6 text-[9px]"
										onclick={() => onEdit?.(alert)}
										title="알림 수정"
									>
										<Icon icon="mdi:pencil-outline" class="h-3 w-3" />
										수정
									</button>
									<button
										class="btn rounded-md px-1.5 font-black text-red-500 bg-red-50 hover:bg-red-100 btn-ghost btn-xs h-6 min-h-6 text-[9px]"
										onclick={() => onDelete?.(alert.id)}
										title="알림 삭제"
									>
										<Icon icon="mdi:delete-outline" class="h-3 w-3" />
										삭제
									</button>
								</div>
							</div>
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

<!-- 📈 알림 목록 카드 (Mobile) -->
<div class="space-y-4 sm:hidden">
	{#if loading}
		<div class="py-16 text-center">
			<span class="loading loading-lg loading-bars text-blue-600"></span>
		</div>
	{:else if filteredAlerts.length === 0}
		<div class="py-16 text-center text-xl font-bold text-slate-300 italic">
			해당 분류의 알림이 없습니다.
		</div>
	{:else}
		{#each filteredAlerts as alert (alert.id)}
			<div class="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
				<!-- 상단: ID, 레벨, 활성 토글 -->
				<div class="flex items-center justify-between border-b border-slate-100 pb-2">
					<div class="flex items-center gap-2">
						<span class="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">
							#{alert.id}
						</span>
						<span
							class="rounded-md px-2 py-0.5 text-[9px] font-black tracking-tighter {alert.level === 5
								? 'bg-red-100 text-red-700'
								: alert.level === 4
									? 'bg-purple-100 text-purple-700'
									: alert.level === 3
										? 'bg-yellow-100 text-yellow-700'
										: alert.level === 2
											? 'bg-green-100 text-green-700'
											: 'bg-blue-100 text-blue-700'}"
						>
							L{alert.level} ({alert.style})
						</span>
					</div>
					<button
						class="btn btn-ghost btn-xs {alert.is_active ? 'text-green-600' : 'text-red-500'}"
						onclick={() => onToggle?.(alert.id)}
					>
						<Icon
							icon="mdi:toggle-{alert.is_active ? 'switch' : 'switch-off'}"
							class="h-4 w-4"
						/>
						{alert.is_active ? '활성' : '비활성'}
					</button>
				</div>

				<!-- 💬 메시지: 2~3줄(line-clamp-2 sm:line-clamp-3) 멀티라인 노출 -->
				<div class="rounded-xl bg-slate-50 p-3 border border-slate-100">
					<span class="block text-xs font-black text-slate-900 leading-snug whitespace-normal break-words line-clamp-3">
						{alert.message}
					</span>
				</div>

				<!-- 분류 및 수신 대상 -->
				<div class="flex items-center justify-between text-xs">
					<div class="flex items-center gap-1.5 flex-wrap">
						{#if alert.category === 'URGENT_NOTICE'}
							<span class="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-[9px] font-black text-white shadow-xs animate-pulse">
								🚨 중요 공지
							</span>
						{:else if alert.category === 'INSTRUCTION'}
							<span class="inline-flex items-center gap-1 rounded-md bg-purple-100 border border-purple-200 px-2 py-0.5 text-[9px] font-black text-purple-700">
								📋 지시사항
							</span>
						{:else}
							<span class="inline-flex items-center gap-1 rounded-md bg-blue-100 border border-blue-200 px-2 py-0.5 text-[9px] font-black text-blue-700">
								📢 공지
							</span>
						{/if}
						{#if alert.target_group}
							<span class="rounded-md bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
								🎯 {alert.target_group}
							</span>
						{:else}
							<span class="rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
								전사 전체
							</span>
						{/if}
					</div>
					<span class="text-[10px] text-slate-400">
						생성: {formatDateTime(alert.create_date)}
					</span>
				</div>

				<!-- 🛠️ 모바일 작업 메뉴 (2줄 작성) -->
				<div class="space-y-1.5 pt-2 border-t border-slate-100">
					<!-- 1줄: 미리보기 & 수신현황 -->
					<div class="grid grid-cols-2 gap-1.5">
						<button
							class="btn rounded-xl font-black text-slate-700 bg-slate-100 hover:bg-slate-200 btn-xs flex items-center justify-center gap-1"
							onclick={() => alertState.send(alert.message, { level: alert.level, style: alert.style, position: alert.position || 'top', confirm_text: alert.confirm_text, redirect_url: alert.redirect_url })}
						>
							<Icon icon="mdi:eye-outline" class="h-3.5 w-3.5" />
							미리보기
						</button>
						{#if alert.category === 'INSTRUCTION'}
							<button
								class="btn rounded-xl font-black text-purple-700 bg-purple-50 hover:bg-purple-100 btn-xs flex items-center justify-center gap-1"
								onclick={() => onOpenAck?.(alert)}
							>
								<Icon icon="mdi:account-check-outline" class="h-3.5 w-3.5" />
								수신현황
							</button>
						{:else}
							<div class="text-[10px] text-slate-400 flex items-center justify-center italic">
								{formatDateTime(alert.start_date)}
							</div>
						{/if}
					</div>
					<!-- 2줄: 수정 & 삭제 -->
					<div class="grid grid-cols-2 gap-1.5">
						<button
							class="btn rounded-xl font-black text-blue-700 bg-blue-50 hover:bg-blue-100 btn-xs flex items-center justify-center gap-1"
							onclick={() => onEdit?.(alert)}
						>
							<Icon icon="mdi:pencil-outline" class="h-3.5 w-3.5" />
							수정
						</button>
						<button
							class="btn rounded-xl font-black text-red-600 bg-red-50 hover:bg-red-100 btn-xs flex items-center justify-center gap-1"
							onclick={() => onDelete?.(alert.id)}
						>
							<Icon icon="mdi:delete-outline" class="h-3.5 w-3.5" />
							삭제
						</button>
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>

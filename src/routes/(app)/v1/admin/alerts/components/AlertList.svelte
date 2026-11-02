<script>
	import Icon from '@iconify/svelte';
	import { alertState } from '$lib/runes/alert.svelte.js';

	let {
		alerts = [],
		loading = false,
		onToggle,
		onEdit,
		onDelete,
		onOpenAck
	} = $props();

	function formatDateTime(dateString) {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleString('ko-KR', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
	}
</script>

<!-- 📊 알림 목록 테이블 (Desktop/Tablet) -->
<div
	class="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:block md:rounded-[2rem] md:shadow-2xl"
>
	<table class="table w-full">
		<thead
			class="border-b border-slate-100 bg-slate-50 text-[8px] font-bold tracking-widest text-slate-500 uppercase md:text-[10px]"
		>
			<tr>
				<th class="px-4 py-4 md:px-8 md:py-6">ID</th>
				<th>메시지</th>
				<th>분류</th>
				<th>수신 대상</th>
				<th>레벨</th>
				<th>유형</th>
				<th>기간</th>
				<th>활성</th>
				<th>생성일</th>
				<th class="px-4 text-right md:px-8">작업</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-50">
			{#if loading}
				<tr>
					<td colspan="10" class="py-16 text-center md:py-32">
						<span class="loading loading-lg loading-bars text-blue-600"></span>
					</td>
				</tr>
			{:else if alerts.length === 0}
				<tr>
					<td
						colspan="10"
						class="py-16 text-center text-xl font-bold text-slate-300 italic md:py-32"
					>
						생성된 알림이 없습니다.
					</td>
				</tr>
			{:else}
				{#each alerts as alert (alert.id)}
					<tr class="group transition-colors hover:bg-slate-50/50">
						<td class="px-4 py-3 md:px-8 md:py-5">
							<span
								class="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-[8px] text-slate-400 transition-colors group-hover:bg-white md:rounded-md md:text-[10px]"
							>
								{alert.id}
							</span>
						</td>
						<td>
							<div class="flex items-center gap-2">
								<span class="max-w-[180px] truncate text-sm font-black text-slate-900 md:max-w-[320px] md:text-base">
									{alert.message}
								</span>
								<button
									class="btn btn-ghost btn-xs text-[9px] uppercase font-black"
									onclick={() => alertState.send(alert.message, { level: alert.level, style: alert.style, confirm_text: alert.confirm_text, redirect_url: alert.redirect_url })}
								>
									[미리보기]
								</button>
							</div>
						</td>
						<td>
							<span
								class="rounded-md px-2 py-0.5 text-[8px] font-black md:text-[10px] {alert.category === 'INSTRUCTION' ? 'bg-purple-100 text-purple-700' : alert.category === 'NOTICE' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}"
							>
								{alert.category === 'INSTRUCTION' ? '지시사항' : alert.category === 'NOTICE' ? '공지사항' : '알림'}
							</span>
						</td>
						<td>
							{#if alert.target_group}
								<span class="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[9px] font-bold text-blue-700">
									<Icon icon="mdi:target" class="text-blue-500" />
									{alert.target_group}
								</span>
							{:else if alert.target_users}
								<span class="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">
									사원 {alert.target_users.split(',').length}명
								</span>
							{:else}
								<span class="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
									전사 전체
								</span>
							{/if}
						</td>
						<td>
							<span
								class="rounded-md px-2 py-0.5 text-[8px] font-black tracking-tighter md:text-[10px] {alert.level === 5
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
						</td>
						<td>
							<span
								class="rounded-md bg-slate-100 px-2 py-0.5 text-[8px] font-black tracking-tighter text-slate-700 capitalize md:text-[10px]"
							>
								{alert.style}
							</span>
						</td>
						<td class="text-[8px] font-medium text-slate-500 md:text-xs">
							{formatDateTime(alert.start_date)}<br />
							{formatDateTime(alert.end_date)}
						</td>
						<td>
							<button
								class="btn btn-ghost btn-xs {alert.is_active ? 'text-green-500' : 'text-red-500'}"
								onclick={() => onToggle?.(alert.id)}
							>
								<Icon
									icon="mdi:toggle-{alert.is_active ? 'switch' : 'switch-off'}"
									class="h-4 w-4"
								/>
								{alert.is_active ? '활성' : '비활성'}
							</button>
						</td>
						<td class="text-[8px] font-medium text-slate-500 md:text-xs">
							{formatDateTime(alert.created_at)}
						</td>
						<td class="px-4 text-right md:px-8">
							<div class="flex justify-end gap-1 items-center">
								{#if alert.category === 'INSTRUCTION'}
									<button
										class="btn rounded-lg px-2 font-black text-purple-600 btn-ghost btn-xs hover:bg-purple-50 hover:text-purple-800"
										onclick={() => onOpenAck?.(alert)}
										title="기사님 수신 확인 현황"
									>
										<Icon icon="mdi:account-check-outline" class="h-3.5 w-3.5" />
										수신현황
									</button>
								{/if}
								<button
									class="btn rounded-lg px-2 font-black text-blue-500 btn-ghost btn-xs hover:bg-blue-50 hover:text-blue-700"
									onclick={() => onEdit?.(alert)}
								>
									<Icon icon="mdi:pencil-outline" class="h-3 w-3" />
									수정
								</button>
								<button
									class="btn rounded-lg px-2 font-black text-red-500 btn-ghost btn-xs hover:bg-red-50 hover:text-red-700"
									onclick={() => onDelete?.(alert.id)}
								>
									<Icon icon="mdi:delete-outline" class="h-3 w-3" />
									삭제
								</button>
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
	{:else if alerts.length === 0}
		<div class="py-16 text-center text-xl font-bold text-slate-300 italic">
			생성된 알림이 없습니다.
		</div>
	{:else}
		{#each alerts as alert (alert.id)}
			<div class="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
				<div class="flex items-center justify-between">
					<div class="flex flex-col">
						<span class="text-base font-black text-slate-900">ID: {alert.id}</span>
						<span class="text-[10px] text-slate-500">메시지: {alert.message}</span>
					</div>
					<span
						class="rounded-md px-2 py-0.5 text-[8px] font-black tracking-tighter {alert.level === 5
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
				</div>

				<div class="flex items-center justify-between text-xs">
					<div class="flex items-center gap-1.5">
						<span class="rounded-md px-1.5 py-0.5 text-[9px] font-black {alert.category === 'INSTRUCTION' ? 'bg-purple-100 text-purple-700' : alert.category === 'NOTICE' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}">
							{alert.category === 'INSTRUCTION' ? '지시사항' : alert.category === 'NOTICE' ? '공지사항' : '알림'}
						</span>
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
					<span>
						<span class="font-semibold text-slate-400">스타일:</span>
						<span class="capitalize text-slate-700 font-bold">{alert.style}</span>
					</span>
				</div>

				<div class="flex justify-between text-xs text-slate-500">
					<span>
						<span class="font-semibold">유형:</span>
						<span class="capitalize">{alert.style}</span>
						/ <span class="capitalize">{alert.position}</span>
					</span>
					<span>
						<span class="font-semibold">활성:</span>
						<button
							class="btn btn-ghost btn-xs {alert.is_active ? 'text-green-500' : 'text-red-500'}"
							onclick={() => onToggle?.(alert.id)}
						>
							<Icon
								icon="mdi:toggle-{alert.is_active ? 'switch' : 'switch-off'}"
								class="h-4 w-4"
							/>
							{alert.is_active ? '활성' : '비활성'}
						</button>
					</span>
				</div>
				<div class="text-xs text-slate-500">
					<span class="font-semibold">기간:</span>
					{formatDateTime(alert.start_date)} ~ {formatDateTime(alert.end_date)}
				</div>
				<div class="flex items-center justify-between text-xs text-slate-500">
					<span><span class="font-semibold">생성:</span> {formatDateTime(alert.created_at)}</span>
					<div class="flex gap-1 items-center">
						{#if alert.category === 'INSTRUCTION'}
							<button
								class="btn rounded-lg px-2 font-black text-purple-600 btn-ghost btn-xs hover:bg-purple-50 hover:text-purple-800"
								onclick={() => onOpenAck?.(alert)}
								title="기사님 수신 확인 현황"
							>
								<Icon icon="mdi:account-check-outline" class="h-3 w-3" />
								현황
							</button>
						{/if}
						<button
							class="btn rounded-lg px-2 font-black text-blue-500 btn-ghost btn-xs hover:bg-blue-50 hover:text-blue-700"
							onclick={() => onEdit?.(alert)}
						>
							<Icon icon="mdi:pencil-outline" class="h-3 w-3" />
							수정
						</button>
						<button
							class="btn rounded-lg px-2 font-black text-red-500 btn-ghost btn-xs hover:bg-red-50 hover:text-red-700"
							onclick={() => onDelete?.(alert.id)}
						>
							<Icon icon="mdi:delete-outline" class="h-3 w-3" />
							삭제
						</button>
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>

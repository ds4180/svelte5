<script lang="ts">
	/**
	 * ============================================================================
	 * [차량 배차 관리자 — 투입 대기 기사 등록 보드 (DispatchDriverBoard.svelte)]
	 * 4개 우선순위 그룹(휴무 예비 -> 휴무 고정 -> 결근계 -> 병가·징계) 및
	 * 공정배분(월 근무일/시간/야간 적은 순) 정렬을 적용합니다.
	 * ============================================================================
	 */
	import type { DispatchSettings, DriverResource, DriverWorkStat } from '$lib/api/dispatch';
	import {
		buildClassifiedDriverBoard,
		DEFAULT_DISPATCH_SETTINGS,
		type ClassifiedDriverItem
	} from '$lib/services/dispatchAdminService';
	import Icon from '@iconify/svelte';

	interface Props {
		availableDrivers: DriverResource[];
		driverStats?: Record<string, DriverWorkStat>;
		settings?: DispatchSettings;
		vehiclesByGroup?: Record<string, string[]>;
		selectedDriver: DriverResource | null;
		onSelectDriver: (driver: DriverResource) => void;
	}

	let {
		availableDrivers,
		driverStats = {},
		settings,
		vehiclesByGroup = {},
		selectedDriver,
		onSelectDriver
	}: Props = $props();

	const effectiveSettings = $derived(settings ?? DEFAULT_DISPATCH_SETTINGS);

	const classified = $derived(
		buildClassifiedDriverBoard({
			availableDrivers,
			driverStats,
			settings: effectiveSettings
		})
	);

	interface GroupMeta {
		key: 'reserve' | 'fixed' | 'dayoff' | 'sickDiscipline';
		title: string;
		headerClass: string;
		borderClass: string;
		items: ClassifiedDriverItem[];
		idleBtnClass: string;
		selectedBtnClass: string;
	}

	const groups = $derived<GroupMeta[]>([
		{
			key: 'reserve',
			title: '1. 휴무중인 예비기사',
			headerClass: 'text-sky-700',
			borderClass: 'border-sky-200',
			items: classified.reserve,
			idleBtnClass: 'border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-400 hover:bg-sky-100',
			selectedBtnClass: 'border-blue-600 bg-blue-600 text-white shadow-sm'
		},
		{
			key: 'fixed',
			title: '2. 휴무중인 고정기사',
			headerClass: 'text-slate-700',
			borderClass: 'border-slate-200',
			items: classified.fixed,
			idleBtnClass:
				'border-slate-200 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50',
			selectedBtnClass: 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
		},
		{
			key: 'dayoff',
			title: '3. 결근계 기사',
			headerClass: 'text-amber-700',
			borderClass: 'border-amber-200',
			items: classified.dayoff,
			idleBtnClass:
				'border-amber-300 bg-amber-50/80 text-amber-950 hover:border-amber-500 hover:bg-amber-100',
			selectedBtnClass: 'border-amber-600 bg-amber-600 text-white shadow-sm'
		},
		{
			key: 'sickDiscipline',
			title: '4. 병가 · 징계',
			headerClass: 'text-rose-700',
			borderClass: 'border-rose-200',
			items: classified.sickDiscipline,
			idleBtnClass:
				'border-rose-300 bg-rose-50/80 text-rose-950 hover:border-rose-500 hover:bg-rose-100',
			selectedBtnClass: 'border-rose-600 bg-rose-600 text-white shadow-sm'
		}
	]);

	function formatNightSummary(stat: DriverWorkStat): string {
		if (effectiveSettings.night_metric_mode === 'time_range') {
			return `${Math.round((stat.month_night_minutes / 60) * 10) / 10}h`;
		}
		return `${stat.month_night_count}회`;
	}

	function formatHours(minutes: number): string {
		return `${Math.round((minutes / 60) * 10) / 10}h`;
	}

	function getFixedGroupLabel(vehicleNo?: string): string {
		const vno = String(vehicleNo || '').trim();
		if (!vno) return '기타 차량';
		for (const [groupKey, list] of Object.entries(vehiclesByGroup || {})) {
			if (Array.isArray(list) && list.some((v) => String(v || '').trim() === vno)) {
				return groupKey;
			}
		}
		return '기타 차량';
	}

	const fixedSubgroups = $derived.by(() => {
		const buckets = new Map<string, ClassifiedDriverItem[]>();
		for (const key of Object.keys(vehiclesByGroup || {})) {
			buckets.set(key, []);
		}
		for (const item of classified.fixed) {
			const label = getFixedGroupLabel(item.driver.vehicle_no);
			const arr = buckets.get(label) || [];
			arr.push(item);
			buckets.set(label, arr);
		}
		return Array.from(buckets.entries())
			.filter(([, items]) => items.length > 0)
			.map(([label, items]) => ({ label, items }));
	});
</script>

{#snippet driverButton(item: ClassifiedDriverItem, group: GroupMeta)}
	{@const isSelected = selectedDriver?.name === item.driver.name}
	{@const isReserve = !String(item.driver.vehicle_no || '').trim()}
	{@const shouldBlink = item.hasPolicyWarning && effectiveSettings.enable_validation_blink}
	<button
		type="button"
		title={item.reasons.length > 0
			? item.reasons.join(' / ')
			: `월 ${item.stat.month_work_days}일 · ${formatHours(item.stat.month_work_minutes)} · 주 ${item.stat.week_work_days}일`}
		class="inline-flex flex-col items-start gap-0.5 rounded-xl border px-3 py-1.5 text-left shadow-xs transition-all
			{isSelected ? group.selectedBtnClass : group.idleBtnClass}
			{shouldBlink && !isSelected ? 'animate-pulse ring-2 ring-rose-400' : ''}"
		onclick={() => onSelectDriver(item.driver)}
	>
		<div class="flex items-center gap-1.5 text-[15px] leading-tight font-bold">
			<span class="font-black tracking-tight">{item.driver.name}</span>
			<span
				class="rounded px-1.5 py-0.5 text-[11px] font-black {isSelected
					? 'bg-white/20 text-white'
					: isReserve
						? 'bg-sky-600 text-white'
						: item.driver.role === 'MAIN'
							? 'bg-blue-100 text-blue-800'
							: 'bg-amber-100 text-amber-800'}"
			>
				{isReserve ? '예' : item.driver.vehicle_no}
			</span>
			{#if item.reasons.length > 0}
				<span
					class="rounded px-1 py-0.5 text-[10px] font-black {isSelected
						? 'bg-rose-900/40 text-white'
						: 'bg-rose-100 text-rose-700'}"
				>
					{item.reasons[0]}
				</span>
			{/if}
		</div>
		<div class="text-[10px] font-bold {isSelected ? 'text-white/85' : 'text-slate-500'}">
			월 {item.stat.month_work_days}일 · {formatHours(item.stat.month_work_minutes)} · 야 {formatNightSummary(
				item.stat
			)}
		</div>
	</button>
{/snippet}

<div class="w-full min-w-[min(100%,300px)] flex-1 lg:sticky lg:top-4">
	<div
		class="flex flex-col overflow-hidden rounded-2xl border-2 border-slate-900 bg-white shadow-[3px_3px_0_rgba(0,0,0,1)]"
	>
		<div
			class="flex items-center justify-between border-b-2 border-slate-900 bg-slate-100 px-4 py-3"
		>
			<h3
				class="flex items-center gap-2 text-xs font-black tracking-tight text-slate-800 uppercase"
			>
				<Icon icon="ph:users-four-fill" class="text-lg text-indigo-600" />
				투입 대기 기사 등록 보드
			</h3>
			<span
				class="badge rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-black tracking-tighter text-indigo-700 uppercase"
			>
				{availableDrivers.length}명 대기중
			</span>
		</div>

		<div class="bg-slate-50/50 p-3">
			{#if availableDrivers.length === 0}
				<div class="py-6 text-center text-xs font-bold text-slate-400">
					현재 투입 대기 중인 기사가 없습니다.
				</div>
			{:else}
				<div class="max-h-[75vh] min-h-[420px] space-y-3 overflow-x-hidden overflow-y-auto">
					{#each groups as group (group.key)}
						{#if group.items.length > 0}
							<div class="space-y-2 border-t border-slate-200 pt-2.5 first:border-t-0 first:pt-0">
								<div class="flex items-center justify-between border-b pb-1 {group.borderClass}">
									<span class="text-xs font-black {group.headerClass}">
										{group.title} ({group.items.length})
									</span>
									{#if group.key === 'reserve' || group.key === 'fixed'}
										<span class="text-[10px] font-bold text-slate-400">월 근무 적은 순</span>
									{/if}
								</div>
								{#if group.key === 'fixed' && fixedSubgroups.length > 0}
									<div class="space-y-2.5">
										{#each fixedSubgroups as sub (sub.label)}
											<div
												class="space-y-1.5 rounded-xl border border-slate-200/80 bg-white/70 p-2"
											>
												<div class="flex items-center justify-between">
													<span class="text-[11px] font-black text-indigo-700">
														{sub.label} ({sub.items.length})
													</span>
												</div>
												<div class="flex flex-wrap content-start items-start gap-2">
													{#each sub.items as item (item.driver.name)}
														{@render driverButton(item, group)}
													{/each}
												</div>
											</div>
										{/each}
									</div>
								{:else}
									<div class="flex flex-wrap content-start items-start gap-2">
										{#each group.items as item (item.driver.name)}
											{@render driverButton(item, group)}
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>

		<div class="border-t border-slate-200 bg-white px-4 py-2">
			<p class="text-[10px] leading-relaxed font-bold text-slate-500">
				{#if selectedDriver}
					<span class="animate-pulse font-black text-indigo-600">
						[{selectedDriver.name}] ({selectedDriver.vehicle_no || '전담 차량 없음'})
					</span>
					기사님이 선택되었습니다. 좌측 표의 <span class="font-black text-indigo-600">기사</span>
					또는 <span class="font-black text-indigo-600">내일기사</span> 칸을 클릭해 배정하세요.
				{:else}
					* 대기 기사 버튼을 클릭해 선택한 뒤, 좌측 표의 오늘/내일 기사 칸을 클릭하면 즉시
					배정됩니다.
				{/if}
			</p>
		</div>
	</div>
</div>

<script lang="ts">
	/**
	 * ============================================================================
	 * [차량 배차 관리자 — 투입 대기 기사 등록 보드 (DispatchDriverBoard.svelte)]
	 * 4개 우선순위 그룹(휴무 예비 -> 휴무 고정 -> 결근계 -> 병가·징계) 및
	 * 공정배분(월 근무일/시간/야간 적은 순) 정렬을 적용합니다.
	 * ============================================================================
	 */
	import * as dispatchApi from '$lib/api/dispatch';
	import type {
		DispatchSettings,
		DriverDispatchDetail,
		DriverResource,
		DriverWorkStat
	} from '$lib/api/dispatch';
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
		targetDate?: string;
		selectedDriver: DriverResource | null;
		onSelectDriver: (driver: DriverResource) => void;
	}

	let {
		availableDrivers,
		driverStats = {},
		settings,
		vehiclesByGroup = {},
		targetDate = '',
		selectedDriver,
		onSelectDriver
	}: Props = $props();

	let detailModal = $state<{ item: ClassifiedDriverItem; groupTitle: string } | null>(null);
	let detailData = $state<DriverDispatchDetail | null>(null);
	let detailLoading = $state(false);
	let detailError = $state('');
	let hoverPreview = $state<{
		item: ClassifiedDriverItem;
		groupTitle: string;
		x: number;
		y: number;
	} | null>(null);

	async function openDetailModal(item: ClassifiedDriverItem, groupTitle: string) {
		hoverPreview = null;
		detailModal = { item, groupTitle };
		detailData = null;
		detailError = '';
		const qDate = targetDate || new Date().toISOString().slice(0, 10);
		detailLoading = true;
		try {
			const res = await dispatchApi.adminGetDriverDispatchDetail(item.driver.name, qDate);
			if (detailModal?.item.driver.name === item.driver.name) {
				detailData = res;
			}
		} catch (e) {
			detailError = '상세 이력을 불러오지 못했습니다.';
		} finally {
			detailLoading = false;
		}
	}

	function openHoverPreview(
		e: MouseEvent & { currentTarget: HTMLElement },
		item: ClassifiedDriverItem,
		groupTitle: string
	) {
		if (detailModal) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const cardWidth = 320;
		const preferLeft = rect.left - cardWidth - 12;
		const x =
			preferLeft >= 12
				? preferLeft
				: Math.min(window.innerWidth - cardWidth - 12, Math.max(12, rect.left));
		const y = Math.min(window.innerHeight - 260, Math.max(12, rect.top));
		hoverPreview = { item, groupTitle, x, y };
	}

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

	function formatHoursMinutes(minutes: number): string {
		const mins = Math.max(0, Math.round(minutes || 0));
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
	}

	function formatOffDaysLabel(stat: DriverWorkStat): string {
		const off = stat.consecutive_off_days ?? 1;
		if (off >= 3) return '3일 이상 휴무';
		if (off === 2) return '2일 휴무';
		return '전일 휴무';
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

	let hiddenFixedRoutes = $state<Record<string, boolean>>({});

	function toggleFixedRoute(label: string) {
		hiddenFixedRoutes = {
			...hiddenFixedRoutes,
			[label]: !hiddenFixedRoutes[label]
		};
	}

	const allFixedHidden = $derived(
		fixedSubgroups.length > 0 && fixedSubgroups.every((sub) => Boolean(hiddenFixedRoutes[sub.label]))
	);

	function toggleAllFixedRoutes() {
		const nextHidden = !allFixedHidden;
		const next: Record<string, boolean> = {};
		for (const sub of fixedSubgroups) {
			next[sub.label] = nextHidden;
		}
		hiddenFixedRoutes = next;
	}

	const avgStats = $derived.by(() => {
		const list = availableDrivers.map((drv) => driverStats[drv.name]).filter(Boolean);
		if (list.length === 0) {
			return { avgDays: 0, avgHours: 0, avgNight: 0, count: 0 };
		}
		const sumDays = list.reduce((acc, s) => acc + (s.month_work_days || 0), 0);
		const sumMins = list.reduce((acc, s) => acc + (s.month_work_minutes || 0), 0);
		const sumNight = list.reduce(
			(acc, s) =>
				acc +
				(effectiveSettings.night_metric_mode === 'time_range'
					? s.month_night_minutes || 0
					: s.month_night_count || 0),
			0
		);
		return {
			avgDays: Math.round((sumDays / list.length) * 10) / 10,
			avgHours: Math.round((sumMins / list.length / 60) * 10) / 10,
			avgNight: Math.round((sumNight / list.length) * 10) / 10,
			count: list.length
		};
	});

	function getBoardRank(driverName: string): { rank: number; total: number } {
		const all = [
			...classified.reserve,
			...classified.fixed,
			...classified.dayoff,
			...classified.sickDiscipline
		];
		const idx = all.findIndex((x) => x.driver.name === driverName);
		return { rank: idx >= 0 ? idx + 1 : all.length, total: all.length };
	}
</script>

{#snippet driverButton(item: ClassifiedDriverItem, group: GroupMeta)}
	{@const isSelected = selectedDriver?.name === item.driver.name}
	{@const isReserve = !String(item.driver.vehicle_no || '').trim()}
	{@const shouldBlink = item.hasPolicyWarning && effectiveSettings.enable_validation_blink}
	<div
		role="button"
		tabindex="0"
		class="inline-flex cursor-pointer flex-col items-start gap-0.5 rounded-xl border px-3 py-1.5 text-left shadow-xs transition-all
			{isSelected ? group.selectedBtnClass : group.idleBtnClass}
			{shouldBlink && !isSelected ? 'animate-pulse ring-2 ring-rose-400' : ''}"
		onclick={() => {
			hoverPreview = null;
			onSelectDriver(item.driver);
		}}
		onmouseenter={(e) => openHoverPreview(e, item, group.title)}
		onmouseleave={() => {
			if (hoverPreview?.item.driver.name === item.driver.name) {
				hoverPreview = null;
			}
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				onSelectDriver(item.driver);
			}
		}}
		oncontextmenu={(e) => {
			e.preventDefault();
			openDetailModal(item, group.title);
		}}
	>
		<div class="flex w-full items-center gap-1.5 text-[15px] leading-tight font-bold">
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
			<button
				type="button"
				aria-label={`${item.driver.name} 상세 정보`}
				class="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full transition {isSelected
					? 'text-white/80 hover:bg-white/20 hover:text-white'
					: 'text-slate-400 hover:bg-slate-200/70 hover:text-slate-700'}"
				onclick={(e) => {
					e.stopPropagation();
					openDetailModal(item, group.title);
				}}
			>
				<Icon icon="ph:info-bold" class="text-xs" />
			</button>
		</div>
		<div class="text-[10px] font-bold {isSelected ? 'text-white/85' : 'text-slate-500'}">
			월 {item.stat.month_work_days}일 · {formatHours(item.stat.month_work_minutes)} · 야 {formatNightSummary(
				item.stat
			)}
		</div>
	</div>
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
									<div class="flex items-center gap-2">
										{#if group.key === 'fixed' && fixedSubgroups.length > 1}
											<button
												type="button"
												onclick={toggleAllFixedRoutes}
												class="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
											>
												{allFixedHidden ? '노선 모두 펼치기' : '노선 모두 숨김'}
											</button>
										{/if}
										{#if group.key === 'reserve' || group.key === 'fixed'}
											<span class="text-[10px] font-bold text-slate-400">월 근무 적은 순</span>
										{/if}
									</div>
								</div>
								{#if group.key === 'fixed' && fixedSubgroups.length > 0}
									<div class="space-y-2">
										{#each fixedSubgroups as sub (sub.label)}
											{@const isHidden = Boolean(hiddenFixedRoutes[sub.label])}
											<div
												class="rounded-xl border border-slate-200/80 bg-white/80 p-2 transition {isHidden ? 'bg-slate-50/80' : 'space-y-1.5'}"
											>
												<button
													type="button"
													onclick={() => toggleFixedRoute(sub.label)}
													class="flex w-full items-center justify-between gap-2 text-left"
													title={isHidden ? `${sub.label} 노선 기사 펼치기` : `${sub.label} 노선 기사 숨기기`}
												>
													<span class="flex items-center gap-1.5 text-[11px] font-black text-indigo-700">
														<Icon
															icon={isHidden ? 'lucide:chevron-right' : 'lucide:chevron-down'}
															class="text-xs text-slate-400"
														/>
														<span>{sub.label} ({sub.items.length}명)</span>
													</span>
													<span
														class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold transition {isHidden
															? 'border-indigo-200 bg-indigo-50 text-indigo-700'
															: 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-800'}"
													>
														<Icon
															icon={isHidden ? 'lucide:eye' : 'lucide:eye-off'}
															class="text-[11px]"
														/>
														<span>{isHidden ? '펼치기' : '숨김'}</span>
													</span>
												</button>
												{#if !isHidden}
													<div class="flex flex-wrap content-start items-start gap-2 pt-1">
														{#each sub.items as item (item.driver.name)}
															{@render driverButton(item, group)}
														{/each}
													</div>
												{/if}
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
					배정됩니다. (<Icon icon="ph:info-bold" class="inline text-xs" /> 또는 우클릭으로 상세 정보 확인)
				{/if}
			</p>
		</div>
	</div>
</div>

{#if hoverPreview && !detailModal}
	{@const hd = hoverPreview.item.driver}
	{@const hst = hoverPreview.item.stat}
	{@const hReasons = hoverPreview.item.reasons}
	{@const hIsReserve = !String(hd.vehicle_no || '').trim()}
	<div
		class="pointer-events-none fixed z-50 w-80 overflow-hidden rounded-2xl border-2 border-slate-900 bg-white shadow-2xl"
		style={`left: ${hoverPreview.x}px; top: ${hoverPreview.y}px;`}
	>
		<div
			class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5"
		>
			<div class="flex items-center gap-2">
				<span class="text-sm font-black text-slate-900">{hd.name}</span>
				<span
					class="rounded px-1.5 py-0.5 text-[10px] font-black {hIsReserve
						? 'bg-sky-600 text-white'
						: hd.role === 'MAIN'
							? 'bg-blue-100 text-blue-800'
							: 'bg-amber-100 text-amber-800'}"
				>
					{hIsReserve
						? '예비기사'
						: `${hd.vehicle_no} (${hd.role === 'MAIN' ? '주' : hd.role === 'SUB' ? '부' : hd.role})`}
				</span>
			</div>
			<span class="text-[10px] font-bold text-slate-400">{hoverPreview.groupTitle}</span>
		</div>
		<div class="space-y-2 p-3.5 text-[11px]">
			<div class="grid grid-cols-2 gap-2">
				<div class="rounded-xl bg-slate-50 px-2.5 py-1.5">
					<div class="text-[10px] font-bold text-slate-400">월 근무일 / 시간</div>
					<div class="font-black text-slate-900">
						{hst.month_work_days}일 · {formatHoursMinutes(hst.month_work_minutes)}
					</div>
				</div>
				<div class="rounded-xl bg-slate-50 px-2.5 py-1.5">
					<div class="text-[10px] font-bold text-slate-400">
						주간 (상한 {effectiveSettings.max_weekly_work_days ?? 4}일)
					</div>
					<div
						class="font-black {hst.week_work_days >= (effectiveSettings.max_weekly_work_days ?? 4)
							? 'text-rose-600'
							: 'text-slate-900'}"
					>
						{hst.week_work_days}일
					</div>
				</div>
				<div class="rounded-xl bg-slate-50 px-2.5 py-1.5">
					<div class="text-[10px] font-bold text-slate-400">월 야간 근무</div>
					<div class="font-black text-slate-900">
						{hst.month_night_count}회 ({formatHoursMinutes(hst.month_night_minutes)})
					</div>
				</div>
				<div class="rounded-xl bg-slate-50 px-2.5 py-1.5">
					<div class="text-[10px] font-bold text-slate-400">전일 종료 / 출근 가능</div>
					<div class="font-black text-slate-900">
						{#if hst.worked_yesterday || hst.prev_end_time}
							{hst.prev_end_time || '-'} → {hst.earliest_available_time || '00:00'}~
						{:else}
							{formatOffDaysLabel(hst)}
						{/if}
					</div>
				</div>
			</div>
			<div class="flex flex-wrap items-center gap-1 pt-0.5">
				{#if hReasons.length > 0}
					{#each hReasons as r (r)}
						<span class="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">
							⚠ {r}
						</span>
					{/each}
				{:else}
					<span class="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
						✓ 제한 없음 (투입 가능)
					</span>
				{/if}
				{#if hst.dayoff_type}
					<span class="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
						{hst.dayoff_type} ({hst.dayoff_status || 'PENDING'})
					</span>
				{/if}
			</div>
		</div>
	</div>
{/if}

{#if detailModal}
	{@const d = detailModal.item.driver}
	{@const st = detailModal.item.stat}
	{@const reasons = detailModal.item.reasons}
	{@const isReserve = !String(d.vehicle_no || '').trim()}
	{@const maxWeek = effectiveSettings.max_weekly_work_days ?? 4}
	{@const weekPct = Math.min(100, Math.round((st.week_work_days / Math.max(1, maxWeek)) * 100))}
	{@const myHours = Math.round((st.month_work_minutes / 60) * 10) / 10}
	{@const diffDays = Math.round((st.month_work_days - avgStats.avgDays) * 10) / 10}
	{@const diffHours = Math.round((myHours - avgStats.avgHours) * 10) / 10}
	{@const rankInfo = getBoardRank(d.name)}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={() => (detailModal = null)}
		onkeydown={(e) => {
			if (e.key === 'Escape') detailModal = null;
		}}
	>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border-2 border-slate-900 bg-white shadow-2xl"
			role="document"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div
				class="flex items-center justify-between border-b-2 border-slate-100 bg-slate-50 px-6 py-4"
			>
				<div class="flex flex-wrap items-center gap-2.5">
					<span class="text-xl font-black text-slate-900">{d.name}</span>
					<span
						class="rounded-lg px-2.5 py-1 text-xs font-black {isReserve
							? 'bg-sky-600 text-white'
							: d.role === 'MAIN'
								? 'bg-blue-100 text-blue-800'
								: 'bg-amber-100 text-amber-800'}"
					>
						{isReserve
							? '예비기사 (전담 차량 없음)'
							: `고정기사 · ${d.vehicle_no} (${d.role === 'MAIN' ? '주' : d.role === 'SUB' ? '부' : d.role})`}
					</span>
					<span class="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">
						투입 우선순위 {rankInfo.rank} / {rankInfo.total}위
					</span>
				</div>
				<button
					type="button"
					aria-label="닫기"
					class="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
					onclick={() => (detailModal = null)}
				>
					<Icon icon="ph:x-bold" class="text-lg" />
				</button>
			</div>

			<div class="space-y-5 overflow-y-auto p-6 text-xs">
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
						<div class="text-[11px] font-bold text-slate-400">
							월 근무일 (대기 평균 {avgStats.avgDays}일)
						</div>
						<div class="mt-1 flex items-baseline gap-2">
							<span class="text-lg font-black text-slate-900">{st.month_work_days}일</span>
							<span
								class="text-[11px] font-black {diffDays <= 0
									? 'text-emerald-600'
									: 'text-amber-600'}"
							>
								({diffDays > 0 ? `+${diffDays}` : diffDays}일)
							</span>
						</div>
					</div>
					<div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
						<div class="text-[11px] font-bold text-slate-400">
							월 근무시간 (평균 {avgStats.avgHours}h)
						</div>
						<div class="mt-1 flex items-baseline gap-2">
							<span class="text-lg font-black text-slate-900">
								{formatHoursMinutes(st.month_work_minutes)}
							</span>
							<span
								class="text-[11px] font-black {diffHours <= 0
									? 'text-emerald-600'
									: 'text-amber-600'}"
							>
								({diffHours > 0 ? `+${diffHours}` : diffHours}h)
							</span>
						</div>
					</div>
					<div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
						<div class="text-[11px] font-bold text-slate-400">월 야간 (첫·막차 / 심야)</div>
						<div class="mt-1 text-lg font-black text-slate-900">
							{st.month_night_count}회
							<span class="text-xs font-bold text-slate-500">
								({formatHoursMinutes(st.month_night_minutes)})
							</span>
						</div>
					</div>
				</div>

				<div class="space-y-2 rounded-2xl border border-slate-200 p-4">
					<div class="flex items-center justify-between">
						<span class="font-black text-slate-700">주간 근무 현황 (일~토 기준)</span>
						<span
							class="font-black {st.week_work_days >= maxWeek
								? 'text-rose-600'
								: 'text-indigo-700'}"
						>
							{st.week_work_days}일 / 주 상한 {maxWeek}일
						</span>
					</div>
					<div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
						<div
							class="h-full rounded-full transition-all {st.week_work_days >= maxWeek
								? 'bg-rose-500'
								: 'bg-indigo-500'}"
							style={`width: ${weekPct}%;`}
						></div>
					</div>
				</div>

				<div class="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
					<div class="text-xs font-black text-slate-800">정책 · 근태 정합성 상세 점검</div>
					<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
						<div
							class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
						>
							<span class="font-bold text-slate-600">주 최대 근무일 ({maxWeek}일)</span>
							{#if st.week_work_days >= maxWeek}
								<span class="rounded bg-rose-100 px-2 py-0.5 font-black text-rose-700">
									초과 ({st.week_work_days}일)
								</span>
							{:else}
								<span class="rounded bg-emerald-100 px-2 py-0.5 font-black text-emerald-700">
									적합
								</span>
							{/if}
						</div>
						<div
							class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
						>
							<span class="font-bold text-slate-600">
								전일 퇴근 · {effectiveSettings.min_rest_hours ?? 8}h 휴식
							</span>
							{#if st.worked_yesterday || st.prev_end_time}
								<span class="rounded bg-amber-100 px-2 py-0.5 font-black text-amber-800">
									{st.prev_end_time || '-'} 종료 ({st.earliest_available_time || '00:00'}~)
								</span>
							{:else}
								<span class="rounded bg-emerald-100 px-2 py-0.5 font-black text-emerald-700">
									{formatOffDaysLabel(st)}
								</span>
							{/if}
						</div>
						<div
							class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
						>
							<span class="font-bold text-slate-600">근태 (결근계 · 병가)</span>
							{#if st.dayoff_type}
								<span class="rounded bg-amber-100 px-2 py-0.5 font-black text-amber-800">
									{st.dayoff_type} ({st.dayoff_status || 'PENDING'})
								</span>
							{:else}
								<span class="rounded bg-emerald-100 px-2 py-0.5 font-black text-emerald-700">
									정상 출근 가능
								</span>
							{/if}
						</div>
						<div
							class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
						>
							<span class="font-bold text-slate-600">징계 지정 여부</span>
							{#if st.is_disciplined}
								<span class="rounded bg-rose-100 px-2 py-0.5 font-black text-rose-700">
									징계 대상
								</span>
							{:else}
								<span class="rounded bg-emerald-100 px-2 py-0.5 font-black text-emerald-700">
									해당 없음
								</span>
							{/if}
						</div>
					</div>
				</div>

				<div
					class="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-[11px] font-bold text-indigo-900"
				>
					<div>• 보드 분류: <span class="font-black">{detailModal.groupTitle}</span></div>
					{#if reasons.length > 0}
						<div class="mt-1 text-rose-700">
							• 주의: {reasons.join(', ')} 사유가 있으나 긴급 배차 시 투입 및 저장은 가능합니다 (캔버스에서
							블링크 경고 표시).
						</div>
					{:else if !isReserve}
						<div class="mt-1">
							• 안내: 전담 차량({d.vehicle_no}) 외 다른 차량에 투입 시 타차(갈색)로 표시됩니다.
						</div>
					{:else}
						<div class="mt-1">
							• 안내: 전담 차량이 없는 예비기사입니다. 투입 시 예비기사 색상으로 표시됩니다.
						</div>
					{/if}
				</div>

				<!-- DB 다중 테이블 조회 내역 (당일/명일 투입 · 최근 노선 · 결근계 이력) -->
				{#if detailLoading}
					<div
						class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center font-bold text-slate-500"
					>
						운행 이력 및 결근계 내역을 조회하는 중...
					</div>
				{:else if detailError}
					<div
						class="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-center font-bold text-rose-600"
					>
						{detailError}
					</div>
				{:else if detailData}
					<!-- 당일/명일 노선 투입 여부 & 이번 달 노선 분포 -->
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div class="space-y-1.5 rounded-2xl border border-slate-200 p-3.5">
							<div class="text-[11px] font-black text-slate-700">당일 · 명일 노선 투입 여부</div>
							<div class="space-y-1">
								<div class="flex items-center justify-between text-[11px]">
									<span class="font-bold text-slate-500">오늘 ({detailData.target_date})</span>
									{#if detailData.today_assignments.length > 0}
										<span class="font-black text-indigo-700">
											{detailData.today_assignments
												.map((a) => `${a.route_name} ${a.seq}로번 (${a.vehicle_no})`)
												.join(', ')}
										</span>
									{:else}
										<span class="font-bold text-slate-400">미투입 (대기)</span>
									{/if}
								</div>
								<div class="flex items-center justify-between text-[11px]">
									<span class="font-bold text-slate-500">내일 예정</span>
									{#if detailData.tomorrow_assignments.length > 0}
										<span class="font-black text-emerald-700">
											{detailData.tomorrow_assignments
												.map((a) => `${a.route_name} ${a.seq}로번 (${a.vehicle_no})`)
												.join(', ')}
										</span>
									{:else}
										<span class="font-bold text-slate-400">예정 없음</span>
									{/if}
								</div>
							</div>
						</div>

						<div class="space-y-1.5 rounded-2xl border border-slate-200 p-3.5">
							<div class="text-[11px] font-black text-slate-700">이번 달 노선별 운행 분포</div>
							{#if detailData.route_breakdown.length > 0}
								<div class="flex flex-wrap gap-1.5">
									{#each detailData.route_breakdown as rb (rb.route_name)}
										<span class="rounded-lg bg-slate-100 px-2 py-0.5 font-black text-slate-700">
											{rb.route_name}: {rb.count}회
										</span>
									{/each}
								</div>
							{:else}
								<div class="text-[11px] font-bold text-slate-400">이번 달 운행 기록 없음</div>
							{/if}
						</div>
					</div>

					<!-- 최근 노선 운행 내역 -->
					<div class="space-y-2 rounded-2xl border border-slate-200 p-3.5">
						<div class="flex items-center justify-between">
							<span class="text-[11px] font-black text-slate-700"
								>최근 노선 운행 내역 (최근 30일)</span
							>
							<span class="text-[10px] font-bold text-slate-400">
								{detailData.recent_dispatches.length}건
							</span>
						</div>
						{#if detailData.recent_dispatches.length > 0}
							<div class="max-h-36 overflow-y-auto rounded-xl border border-slate-100">
								<table class="w-full text-left text-[11px]">
									<thead class="sticky top-0 bg-slate-50 font-black text-slate-500">
										<tr>
											<th class="px-2.5 py-1.5">날짜</th>
											<th class="px-2.5 py-1.5">노선</th>
											<th class="px-2.5 py-1.5">로번</th>
											<th class="px-2.5 py-1.5">차량</th>
											<th class="px-2.5 py-1.5">운행시각</th>
											<th class="px-2.5 py-1.5">상태</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-slate-100 font-bold text-slate-700">
										{#each detailData.recent_dispatches as rdItem, idx (`${rdItem.target_date}-${rdItem.seq}-${idx}`)}
											<tr>
												<td class="px-2.5 py-1">{rdItem.target_date}</td>
												<td class="px-2.5 py-1 font-black text-indigo-700">{rdItem.route_name}</td>
												<td class="px-2.5 py-1">{rdItem.seq}로번</td>
												<td class="px-2.5 py-1">{rdItem.vehicle_no}</td>
												<td class="px-2.5 py-1">
													{rdItem.start_time || '-'} ~ {rdItem.end_time || '-'}
												</td>
												<td class="px-2.5 py-1">
													<span
														class="rounded px-1.5 py-0.5 text-[10px] font-black {rdItem.status ===
														'CONFIRMED'
															? 'bg-emerald-100 text-emerald-700'
															: 'bg-slate-100 text-slate-600'}"
													>
														{rdItem.status === 'CONFIRMED' ? '확정' : rdItem.status}
													</span>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{:else}
							<div class="text-[11px] font-bold text-slate-400">최근 운행 내역이 없습니다.</div>
						{/if}
					</div>

					<!-- 결근계 · 병가 작성 내역 -->
					<div class="space-y-2 rounded-2xl border border-slate-200 p-3.5">
						<div class="flex items-center justify-between">
							<span class="text-[11px] font-black text-slate-700">결근계 · 병가 작성 내역</span>
							<span class="text-[10px] font-bold text-slate-400">
								{detailData.dayoff_history.length}건
							</span>
						</div>
						{#if detailData.dayoff_history.length > 0}
							<div class="max-h-32 space-y-1.5 overflow-y-auto">
								{#each detailData.dayoff_history as doItem (doItem.id)}
									<div
										class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-1.5 text-[11px]"
									>
										<div class="flex items-center gap-2">
											<span class="font-black text-slate-800">{doItem.date}</span>
											<span
												class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800"
											>
												{doItem.type}
											</span>
											{#if doItem.memo}
												<span class="text-slate-500">"{doItem.memo}"</span>
											{/if}
										</div>
										<span
											class="rounded px-1.5 py-0.5 text-[10px] font-black {doItem.status ===
											'APPROVED'
												? 'bg-emerald-100 text-emerald-700'
												: doItem.status === 'REJECTED'
													? 'bg-rose-100 text-rose-700'
													: 'bg-slate-200 text-slate-700'}"
										>
											{doItem.status}
										</span>
									</div>
								{/each}
							</div>
						{:else}
							<div class="text-[11px] font-bold text-slate-400">
								최근 결근계/병가 작성 내역이 없습니다.
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div
				class="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4"
			>
				<button
					type="button"
					class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
					onclick={() => (detailModal = null)}
				>
					닫기
				</button>
				<button
					type="button"
					class="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-indigo-700"
					onclick={() => {
						onSelectDriver(d);
						detailModal = null;
					}}
				>
					이 기사 투입 선택
				</button>
			</div>
		</div>
	</div>
{/if}

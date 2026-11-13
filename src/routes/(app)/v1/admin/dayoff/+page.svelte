<script>
	/**
	 * @file +page.svelte (Admin Day-Off Management)
	 * @description [v2.0] 관리자 전용 결근계 관리 시스템. 리스트 뷰와 월간 타임라인(레코드) 뷰를 제공합니다.
	 * @standard Svelte 5 Runes ($state, $derived, $effect)
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin.js';
	import Icon from '@iconify/svelte';
	import { formatDateTime } from '$lib/utils.js';
	import { getSiteTitle } from '$lib/config/site';
	import { toast } from '$lib/runes/toast.svelte.ts';

	let {} = $props();

	/**
	 * @typedef {Object} DayoffEntry
	 * @property {number} id - 고유 ID
	 * @property {number} user_id - 사용자 ID
	 * @property {string} username - 사용자 계정명
	 * @property {string} real_name - 사용자 실명
	 * @property {string} date - 휴무 일자 (YYYY-MM-DD)
	 * @property {string} type - ANNUAL(연차), SICK(병가), SPECIAL(경조사), OFFICIAL(공가)
	 * @property {string} status - REQUESTED, APPROVED, REJECTED, CANCELLED
	 * @property {string} memo - 사유
	 * @property {string} group_id - 그룹 ID (연속된 날짜 신청용)
	 * @property {string} create_date - 등록 시각
	 */

	/** @type {DayoffEntry[]} 전체 데이터 저장용 상태 */
	let dayoffs = $state([]);

	/** @type {boolean} 로딩 상태 제어 */
	let loading = $state(true);

	/** @type {string} 현재 탭 보기 형식 ('list' 또는 'timeline') */
	let currentView = $state('list');

	/** @type {number} 월간 조회를 위한 년도 선택 */
	let selectedYear = $state(new Date().getFullYear());

	/** @type {number} 월간 조회를 위한 월 선택 (0-11) */
	let selectedMonth = $state(new Date().getMonth());

	/**
	 * @derived stats
	 * @description 실시간 데이터 기반 통계 지표 계산
	 */
	let stats = $derived.by(() => {
		const approved = dayoffs.filter((d) => d.status === 'APPROVED');
		const requested = dayoffs.filter((d) => d.status === 'REQUESTED');
		return {
			total: dayoffs.length,
			approvedCount: approved.length,
			requestedCount: requested.length,
			typeStats: {
				ANNUAL: approved.filter((d) => d.type === 'ANNUAL').length,
				SICK: approved.filter((d) => d.type === 'SICK').length,
				SPECIAL: approved.filter((d) => d.type === 'SPECIAL').length,
				OFFICIAL: approved.filter((d) => d.type === 'OFFICIAL').length
			}
		};
	});

	/**
	 * @derived timelineData
	 * @description [핵심] 선택된 월의 날짜별로 결근 내역을 '레코드 형식'으로 재배열
	 */
	let timelineData = $derived.by(() => {
		const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
		const days = [];
		for (let i = 1; i <= lastDay; i++) {
			const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
			const dateObj = new Date(selectedYear, selectedMonth, i);
			const dayOfWeek = dateObj.getDay();

			// 해당 날짜에 '승인'된 휴무 내역만 필터링
			const entries = dayoffs.filter((d) => d.date === dateStr && d.status === 'APPROVED');
			days.push({ date: dateStr, day: i, dayOfWeek, entries });
		}
		return days;
	});

	/**
	 * @function loadDayoffs
	 * @description 백엔드 API를 통해 전체 휴무 내역 로드
	 */
	async function loadDayoffs() {
		loading = true;
		try {
			const response = await api.adminGetAllDayoffs();
			dayoffs = Array.isArray(response) ? response : response.data || [];
		} catch (error) {
			const e = /** @type {Error} */ (error);
			toast.error(`데이터 로드 실패: ${e.message}`);
		} finally {
			loading = false;
		}
	}

	/**
	 * @param {number} id
	 * @param {string} status
	 */
	async function updateStatus(id, status) {
		try {
			await api.adminUpdateDayoffStatus(id, status);
			toast.success(`[${status}] 처리가 완료되었습니다.`);
			await loadDayoffs(); // 데이터 새로고침
		} catch (error) {
			const e = /** @type {Error} */ (error);
			toast.error(`상태 변경 실패: ${e.message}`);
		}
	}

	onMount(loadDayoffs);

	/** @param {number} dow */
	const getDayColor = (dow) =>
		dow === 0 ? 'text-rose-500' : dow === 6 ? 'text-blue-500' : 'text-slate-900';
	/** @param {number} dow */
	const getDayLabel = (dow) => ['일', '월', '화', '수', '목', '금', '토'][dow];
	/** @param {string} s */
	const getBadgeClass = (s) => {
		if (s === 'REQUESTED') return 'bg-amber-100 text-amber-700 border-amber-200';
		if (s === 'APPROVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
		if (s === 'REJECTED') return 'bg-rose-100 text-rose-700 border-rose-200';
		return 'bg-slate-100 text-slate-500 border-slate-200';
	};
</script>

<svelte:head>
	<title>{getSiteTitle('근태·휴무 관리')}</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 lg:px-8">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 액션 바 (기본값: 새로고침 + 관리자 홈) -->
	<!-- ===================================================================== -->
	<div class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4 md:pb-8">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-emerald-400 uppercase">
					<span class="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
					Governance HR-System
				</span>
				<span class="text-xs font-bold text-slate-400">v1/admin/dayoff</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-4xl">
				근태·휴무 <span class="not-italic text-blue-600">관리</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				전체 사원의 휴무(결근계) 신청 내역을 검토·승인하고 월간 타임라인 레코드로 현황을 파악합니다.
			</p>
		</div>

		<!-- 상단 버튼 그룹 (새로고침과 관리자 홈은 필수 기본값) -->
		<div class="flex flex-wrap items-center gap-3">
			<button
				onclick={loadDayoffs}
				disabled={loading}
				class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
			>
				<Icon icon="solar:restart-bold" class="text-base {loading ? 'animate-spin' : ''}" />
				<span>새로고침</span>
			</button>

			<a
				href="/v1/admin"
				class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
			>
				<Icon icon="solar:home-smile-angle-bold-duotone" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 2. 상단 4대 관제 지표 요약 카드 (Status Cards: 1~4개) -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Approval Pending</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
					<Icon icon="solar:clock-circle-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-amber-600">{stats.requestedCount} <span class="text-xs font-normal text-slate-500">건</span></div>
				<div class="mt-1 text-xs font-bold text-slate-400">검토 대기 중인 신청</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Approved This Month</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
					<Icon icon="solar:check-circle-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-emerald-600">{stats.approvedCount} <span class="text-xs font-normal text-slate-500">일</span></div>
				<div class="mt-1 text-xs font-bold text-slate-400">이번 달 총 승인 휴무</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Annual Leave</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
					<Icon icon="solar:calendar-date-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-blue-600">{stats.typeStats.ANNUAL} <span class="text-xs font-normal text-slate-500">일</span></div>
				<div class="mt-1 text-xs font-bold text-slate-400">정기 연차 사용일수</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Others (Sick/ETC)</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
					<Icon icon="solar:hospital-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-rose-600">{stats.typeStats.SICK + stats.typeStats.SPECIAL + stats.typeStats.OFFICIAL} <span class="text-xs font-normal text-slate-500">일</span></div>
				<div class="mt-1 text-xs font-bold text-slate-400">병가 및 경조사·공가</div>
			</div>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 3. 전사 공통 탭 바 (최소 1개 일관성 및 확장성) -->
	<!-- ===================================================================== -->
	<div class="flex items-center border-b-2 border-slate-200">
		<button
			type="button"
			onclick={() => (currentView = 'list')}
			class="flex items-center gap-2 border-b-4 px-6 py-3 text-xs font-black rounded-t-2xl transition {currentView === 'list' ? 'border-blue-600 bg-blue-50/50 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon="solar:list-check-bold-duotone" class="text-base" />
			<span>신청 승인 목록</span>
			{#if stats.requestedCount > 0}
				<span class="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">{stats.requestedCount}</span>
			{/if}
		</button>
		<button
			type="button"
			onclick={() => (currentView = 'timeline')}
			class="flex items-center gap-2 border-b-4 px-6 py-3 text-xs font-black rounded-t-2xl transition {currentView === 'timeline' ? 'border-blue-600 bg-blue-50/50 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon="solar:calendar-bold-duotone" class="text-base" />
			<span>월간 타임라인 현황</span>
		</button>
	</div>

	{#if currentView === 'list'}
		<!-- 📋 신청 내역 상세 리스트 -->
		<div
			class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg md:rounded-[2rem] md:shadow-2xl"
		>
			<div
				class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6 md:p-8"
			>
				<h3 class="text-lg font-black tracking-tighter text-slate-900 uppercase italic">
					Pending Applications <span class="NOT-ITALIC ml-2 text-sm font-bold text-blue-600"
						>검토 대기 중인 신청 건</span
					>
				</h3>
			</div>

			<div class="overflow-x-auto">
				<table class="table w-full">
					<thead
						class="border-b border-slate-100 bg-slate-50 text-[10px] font-bold tracking-widest text-slate-500 uppercase"
					>
						<tr>
							<th class="px-6 py-4">Name / ID</th>
							<th>Date / Range</th>
							<th>Category</th>
							<th>Status</th>
							<th>Reason (Memo)</th>
							<th class="px-6 text-right">Action Control</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-50">
						{#if loading}
							<tr
								><td colspan="6" class="py-20 text-center"
									><span class="loading loading-lg loading-bars text-blue-600"></span></td
								></tr
							>
						{:else if dayoffs.filter((d) => d.status === 'REQUESTED').length === 0}
							<tr
								><td
									colspan="6"
									class="py-20 text-center text-xl font-black tracking-widest text-slate-300 uppercase italic"
									>No pending queue</td
								></tr
							>
						{:else}
							{#each dayoffs.filter((d) => d.status === 'REQUESTED') as d (d.id)}
								<tr class="group transition-colors hover:bg-slate-50">
									<td class="px-6 py-4">
										<div class="flex items-center gap-3">
											<div
												class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 font-black text-slate-400 transition-colors group-hover:text-blue-600"
											>
												{d.real_name?.[0] || d.username[0]}
											</div>
											<div>
												<div class="font-black text-slate-900">{d.real_name || d.username}</div>
												<div
													class="font-mono text-[9px] tracking-tighter text-slate-400 uppercase italic"
												>
													User_ptr: {d.user_id}
												</div>
											</div>
										</div>
									</td>
									<td>
										<div class="font-bold text-slate-800">{d.date}</div>
										{#if d.group_id}
											<div class="text-[8px] font-black text-blue-500 uppercase italic opacity-60">
												GroupRef: {d.group_id}
											</div>
										{/if}
									</td>
									<td>
										<span
											class="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-tighter text-slate-700 uppercase"
										>
											{d.type}
										</span>
									</td>
									<td>
										<span
											class="rounded-md border px-2 py-0.5 text-[10px] font-black tracking-tighter {getBadgeClass(
												d.status
											)}"
										>
											{d.status}
										</span>
									</td>
									<td class="max-w-[200px] truncate text-xs text-slate-500 italic">
										{d.memo || '-'}
									</td>
									<td class="px-6 text-right">
										<div class="flex justify-end gap-2 px-1 py-1">
											<button
												class="btn rounded-lg border-none bg-emerald-600 font-black text-white transition-all btn-sm hover:bg-emerald-700"
												onclick={() => updateStatus(d.id, 'APPROVED')}>APPROVE</button
											>
											<button
												class="btn rounded-lg border-none bg-rose-500 font-black text-white transition-all btn-sm hover:bg-rose-600"
												onclick={() => updateStatus(d.id, 'REJECTED')}>REJECT</button
											>
										</div>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{:else}
		<!-- 📅 월간 현황 (Timeline / Monthly Staff Record) -->
		<div
			class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg md:rounded-[2rem] md:shadow-2xl"
		>
			<div
				class="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-6 md:flex-row md:p-8"
			>
				<div>
					<h3 class="text-lg font-black tracking-tighter text-slate-900 uppercase italic">
						Month Activity View <span class="NOT-ITALIC ml-2 text-sm font-bold text-blue-600"
							>월간 결근계 타임라인</span
						>
					</h3>
					<p class="mt-1 text-[10px] font-bold text-slate-400 uppercase">
						Daily records of approved absences
					</p>
				</div>

				<div class="flex items-center gap-2 rounded-2xl bg-slate-200 p-1.5">
					<select
						class="select rounded-xl border-none bg-transparent select-sm font-black text-slate-900 focus:outline-none"
						bind:value={selectedYear}
					>
						{#each [2024, 2025, 2026] as year (year)}
							<option value={year}>{year} YR</option>
						{/each}
					</select>
					<div class="h-6 w-px bg-slate-300"></div>
					<select
						class="select rounded-xl border-none bg-transparent select-sm font-black text-slate-900 focus:outline-none"
						bind:value={selectedMonth}
					>
						{#each Array.from({ length: 12 }, (_, i) => i) as month (month)}
							<option value={month}>{month + 1} MO</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- 📌 Timeline Table (Date Records) -->
			<div class="overflow-x-auto">
				<table class="table w-full">
					<thead
						class="border-b border-slate-100 bg-slate-50 text-[10px] font-bold tracking-widest text-slate-500 uppercase"
					>
						<tr>
							<th class="w-20 px-6 py-4 text-center">Day</th>
							<th class="w-20 text-center">Week</th>
							<th>Approved Records (Staff on Leave)</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-50">
						{#each timelineData as day (day.date)}
							<tr
								class="transition-colors hover:bg-slate-50/50 {day.dayOfWeek === 0
									? 'bg-rose-50/40'
									: day.dayOfWeek === 6
										? 'bg-blue-50/40'
										: ''}"
							>
								<td class="px-6 py-4 text-center text-2xl font-black {getDayColor(day.dayOfWeek)}"
									>{day.day}</td
								>
								<td class="text-center">
									<span class="text-xs font-black uppercase {getDayColor(day.dayOfWeek)}"
										>{getDayLabel(day.dayOfWeek)}</span
									>
								</td>
								<td class="py-2">
									<div class="flex flex-wrap gap-3">
										{#if day.entries.length === 0}
											<span
												class="ml-2 text-[10px] font-bold tracking-widest text-slate-200 uppercase italic"
												>Available</span
											>
										{:else}
											{#each day.entries as entry (entry.id)}
												<div
													class="group relative flex cursor-default items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pr-4 pl-1.5 shadow-sm transition-all hover:border-blue-500 hover:shadow-lg"
												>
													<div
														class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-[10px] font-black text-white uppercase"
													>
														{entry.real_name?.[0] || entry.username[0]}
													</div>
													<div class="flex flex-col leading-none">
														<span class="text-sm font-black text-slate-900"
															>{entry.real_name || entry.username}</span
														>
														<span
															class="mt-0.5 text-[9px] font-black text-blue-600 uppercase italic"
															>{entry.type}</span
														>
													</div>

													<!-- Detailed Tooltip -->
													<div
														class="animate-bounce-in absolute bottom-full left-1/2 z-[200] mb-3 hidden w-56 -translate-x-1/2 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.3)] group-hover:block"
													>
														<div
															class="mb-2 flex items-center justify-between border-b border-slate-700 pb-2"
														>
															<span
																class="text-[9px] font-black tracking-widest text-emerald-400 uppercase"
																>Detail Info</span
															>
															<span class="font-mono text-[8px] text-slate-500 italic"
																>#{entry.id}</span
															>
														</div>
														<p class="mb-3 text-xs leading-relaxed font-bold text-white italic">
															"{entry.memo || '명시된 사유 없음'}"
														</p>
														<div
															class="flex flex-col gap-1 text-[8px] font-black tracking-tight text-slate-400 uppercase"
														>
															<span>신청: {formatDateTime(entry.create_date)}</span>
															<span>코드: {entry.group_id || 'SINGLE_REQ'}</span>
														</div>
														<div
															class="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b border-slate-700 bg-slate-900"
														></div>
													</div>
												</div>
											{/each}
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- 📌 보조 섹션: 최근 처리 완료 내역 (History) -->
	{#if currentView === 'list'}
		<div class="mt-16 space-y-8 opacity-60 transition-opacity hover:opacity-100">
			<h3 class="text-2xl font-black tracking-tighter text-slate-400 uppercase italic">
				Audit Trail <span class="NOT-ITALIC ml-2 text-xs font-bold">근태 처리 이력</span>
			</h3>
			<div
				class="overflow-hidden rounded-xl border border-dashed border-slate-200 bg-white md:rounded-[2rem]"
			>
				<table class="table w-full">
					<thead
						class="border-b border-slate-100 bg-slate-50 text-[10px] font-bold tracking-widest text-slate-500 uppercase"
					>
						<tr>
							<th class="w-20 px-6 py-4">Control</th>
							<th>Staff Name</th>
							<th>Date Ref</th>
							<th>Type</th>
							<th>Final Status</th>
							<th class="px-6 text-right">Timestamp</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-50 font-['Outfit']">
						{#each dayoffs.filter((d) => d.status !== 'REQUESTED').slice(0, 30) as d (d.id)}
							<tr class="group transition-all hover:bg-slate-50">
								<td class="px-6 py-3">
									<button
										class="text-[9px] font-black text-slate-400 underline transition-colors hover:text-blue-600"
										onclick={() => updateStatus(d.id, 'REQUESTED')}>REVOKE</button
									>
								</td>
								<td><span class="font-bold text-slate-800">{d.real_name || d.username}</span></td>
								<td class="text-xs font-medium text-slate-500">{d.date}</td>
								<td
									><span class="rounded-lg bg-slate-100 px-2 py-1 text-[8px] font-black uppercase"
										>{d.type}</span
									></td
								>
								<td>
									<span
										class="rounded-md border px-2 py-0.5 text-[9px] font-black tracking-tighter {getBadgeClass(
											d.status
										)}"
									>
										{d.status}
									</span>
								</td>
								<td class="px-6 text-right font-mono text-[9px] text-slate-400 italic">
									{formatDateTime(d.create_date)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<style>
	.animate-fade-in {
		animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	.animate-bounce-in {
		animation: bounceIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes bounceIn {
		from {
			opacity: 0;
			transform: translate(-50%, 15px) scale(0.85);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0) scale(1);
		}
	}
</style>

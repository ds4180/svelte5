<script>
	/**
	 * @file (app)/v1/admin/route_master/+page.svelte
	 * @description 노선 마스터 관리 (서비스 앱형 3단계 구조)
	 *              1. 노선 정의 (Route Definition)
	 *              2. 로번 생성 (Append-Only 날짜별 과거/현재/미래 이력 관리)
	 *              3. 구간 시간 입력 (노선별 구간 및 소요 시간 관리)
	 */
	import { onMount } from 'svelte';
	import {
		adminGetRouteMasters,
		adminCreateRouteMaster,
		adminUpdateRouteMaster,
		adminDeleteRouteMaster,
		adminAppendRouteRoster,
		adminGetRouteSegments,
		adminSaveRouteSegments
	} from '$lib/api/admin';
	import { getSiteTitle } from '$lib/config/site';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatDate } from '$lib/utils';
	import { formatApiError } from '$lib/utils/error';
	import Icon from '@iconify/svelte';

	let routeMasters = $state(/** @type {any[]} */ ([]));
	let allSegments = $state(/** @type {any[]} */ ([]));
	let loading = $state(true);
	let activeTab = $state(/** @type {'routes' | 'rosters' | 'segments'} */ ('routes'));

	// 선택된 노선명 (탭 2, 탭 3 공통 기준)
	let selectedRouteName = $state('');

	// 탭 1: 노선 정의 검색/필터 및 모달
	let routeSearch = $state('');
	let filterType = $state('ALL'); // ALL | REGULAR | TEMPORARY
	let showRouteModal = $state(false);
	let editingRouteMasterId = $state(/** @type {number | null} */ (null));
	let routeForm = $state({
		route_name: '',
		route_type: 'REGULAR',
		start_date: new Date().toISOString().slice(0, 10),
		vehicle_count: 2,
		start_turn_seq: 1,
		is_regular_duty: false
	});

	// 탭 2: 로번 생성 (Append-Only) 상태
	let rosterDateFilter = $state(''); // 특정 날짜 기준 활성 로번 확인용
	let rosterScopeFilter = $state(/** @type {'ALL' | 'PAST' | 'ACTIVE' | 'FUTURE'} */ ('ALL'));
	let inspectingVersionId = $state(/** @type {number | null} */ (null));
	let showAppendForm = $state(false);
	let appendForm = $state({
		route_type: 'REGULAR',
		start_date: new Date().toISOString().slice(0, 10),
		end_date: '',
		vehicle_count: 2,
		start_turn_seq: 1,
		version: '',
		is_regular_duty: false
	});
	let appendTimetables = $state(/** @type {any[]} */ ([]));
	let appending = $state(false);

	// 탭 3: 구간 시간 입력 상태
	let segmentRows = $state(/** @type {any[]} */ ([]));
	let savingSegments = $state(false);

	// --- [파생 상태] ---
	const uniqueRoutes = $derived.by(() => {
		/** @type {Record<string, any[]>} */
		const grouped = {};
		for (const m of routeMasters) {
			if (!grouped[m.route_name]) grouped[m.route_name] = [];
			grouped[m.route_name].push(m);
		}
		const today = new Date().toISOString().slice(0, 10);
		return Object.entries(grouped)
			.map(([name, versions]) => {
				const sorted = [...versions].sort((a, b) =>
					(a.start_date || '').localeCompare(b.start_date || '')
				);
				const active =
					sorted.find((v) => v.start_date <= today && (!v.end_date || v.end_date >= today)) ||
					sorted[sorted.length - 1];
				const segCount = allSegments.filter((s) => s.route_name === name).length;
				return {
					route_name: name,
					route_type: active?.route_type || 'REGULAR',
					is_regular_duty: Boolean(active?.is_regular_duty),
					active_version: active,
					versions: sorted,
					version_count: sorted.length,
					segment_count: segCount
				};
			})
			.sort((a, b) => a.route_name.localeCompare(b.route_name, 'ko'));
	});

	const filteredRoutes = $derived(
		uniqueRoutes.filter((r) => {
			if (filterType !== 'ALL' && r.route_type !== filterType) return false;
			if (
				routeSearch.trim() &&
				!r.route_name.toLowerCase().includes(routeSearch.trim().toLowerCase())
			) {
				return false;
			}
			return true;
		})
	);

	const selectedRouteVersions = $derived.by(() => {
		const today = new Date().toISOString().slice(0, 10);
		const list = routeMasters
			.filter((m) => m.route_name === selectedRouteName)
			.sort((a, b) => (b.start_date || '').localeCompare(a.start_date || '') || b.id - a.id);

		return list.filter((v) => {
			if (rosterDateFilter) {
				const okStart = v.start_date <= rosterDateFilter;
				const okEnd = !v.end_date || v.end_date >= rosterDateFilter;
				if (!(okStart && okEnd)) return false;
			}
			if (rosterScopeFilter === 'PAST') return Boolean(v.end_date && v.end_date < today);
			if (rosterScopeFilter === 'FUTURE') return Boolean(v.start_date > today);
			if (rosterScopeFilter === 'ACTIVE')
				return v.start_date <= today && (!v.end_date || v.end_date >= today);
			return true;
		});
	});

	const totalSegmentMinutes = $derived(
		segmentRows.reduce((acc, s) => acc + Math.max(0, Number(s.duration_min) || 0), 0)
	);

	// --- [로번 행 수 동기화] ---
	$effect(() => {
		const count = Math.max(0, Number(appendForm.vehicle_count) || 0);
		if (appendTimetables.length < count) {
			const last = appendTimetables[appendTimetables.length - 1];
			while (appendTimetables.length < count) {
				appendTimetables.push({
					seq: appendTimetables.length + 1,
					start_time: last?.start_time || '06:00',
					end_time: last?.end_time || '22:00',
					start_location: last?.start_location || '제주터미널',
					end_location: last?.end_location || '서귀포터미널',
					start_garage: last?.start_garage || '',
					end_garage: last?.end_garage || '',
					is_regular_duty: last?.is_regular_duty ?? false
				});
			}
		} else if (appendTimetables.length > count) {
			appendTimetables.splice(count);
		}
	});

	// 선택 노선 변경 시 구간 시간 행 동기화
	$effect(() => {
		const rname = selectedRouteName;
		if (!rname) {
			segmentRows = [];
			return;
		}
		const found = allSegments
			.filter((s) => s.route_name === rname)
			.sort((a, b) => a.seq - b.seq)
			.map((s) => ({ ...s }));
		segmentRows = found;
	});

	async function loadAll() {
		loading = true;
		try {
			const [masters, segs] = await Promise.all([
				adminGetRouteMasters(),
				adminGetRouteSegments().catch(() => [])
			]);
			routeMasters = Array.isArray(masters) ? masters : [];
			allSegments = Array.isArray(segs) ? segs : [];
			if (
				routeMasters.length > 0 &&
				(!selectedRouteName || !routeMasters.some((m) => m.route_name === selectedRouteName))
			) {
				selectedRouteName = routeMasters[0].route_name;
			}
		} catch (e) {
			toast.error('노선 마스터 로드 실패: ' + formatApiError(e));
		} finally {
			loading = false;
		}
	}

	onMount(loadAll);

	/** @param {string} val */
	function format24hTime(val) {
		const digits = String(val || '')
			.replace(/\D/g, '')
			.slice(0, 4);
		if (digits.length <= 2) return digits;
		return `${digits.slice(0, 2)}:${digits.slice(2)}`;
	}

	// --- [탭 1: 노선 정의 CRUD] ---
	/** @param {any} routeObj */
	function openRouteModal(routeObj = null) {
		if (routeObj) {
			editingRouteMasterId = routeObj.active_version?.id || null;
			routeForm = {
				route_name: routeObj.route_name,
				route_type: routeObj.route_type || 'REGULAR',
				start_date: routeObj.active_version?.start_date || new Date().toISOString().slice(0, 10),
				vehicle_count: routeObj.active_version?.vehicle_count || 2,
				start_turn_seq: routeObj.active_version?.start_turn_seq || 1,
				is_regular_duty: Boolean(routeObj.is_regular_duty)
			};
		} else {
			editingRouteMasterId = null;
			routeForm = {
				route_name: '',
				route_type: 'REGULAR',
				start_date: new Date().toISOString().slice(0, 10),
				vehicle_count: 2,
				start_turn_seq: 1,
				is_regular_duty: false
			};
		}
		showRouteModal = true;
	}

	async function saveRouteDefinition() {
		if (!routeForm.route_name.trim()) {
			toast.warning('노선명을 입력하세요.');
			return;
		}
		const startTurnSeq = Math.max(1, Number(routeForm.start_turn_seq) || 1);
		try {
			if (editingRouteMasterId) {
				await adminUpdateRouteMaster(editingRouteMasterId, {
					route_name: routeForm.route_name.trim(),
					route_type: routeForm.route_type,
					start_turn_seq: startTurnSeq,
					is_regular_duty: routeForm.is_regular_duty
				});
				toast.success('노선 정의가 수정되었습니다.');
			} else {
				const count = Math.max(1, Number(routeForm.vehicle_count) || 1);
				const initialTimetables = Array.from({ length: count }, (_, idx) => ({
					seq: idx + 1,
					start_time: '06:00',
					end_time: '22:00',
					start_location: '기점',
					end_location: '종점',
					start_garage: '',
					end_garage: '',
					is_regular_duty: routeForm.is_regular_duty
				}));
				await adminCreateRouteMaster({
					route_name: routeForm.route_name.trim(),
					route_type: routeForm.route_type,
					start_date: routeForm.start_date,
					end_date: null,
					vehicle_count: count,
					start_turn_seq: startTurnSeq,
					version: 'v1',
					is_regular_duty: routeForm.is_regular_duty,
					timetables: initialTimetables
				});
				selectedRouteName = routeForm.route_name.trim();
				toast.success('새 노선이 정의되었습니다.');
			}
			showRouteModal = false;
			await loadAll();
		} catch (e) {
			toast.error('노선 저장 실패: ' + formatApiError(e));
		}
	}

	// --- [탭 2: Append-Only 로번 생성] ---
	/** @param {any} sourceVersion */
	function openAppendRoster(sourceVersion = null) {
		const base =
			sourceVersion ||
			uniqueRoutes.find((r) => r.route_name === selectedRouteName)?.active_version ||
			null;
		const count = base ? Number(base.vehicle_count || base.timetables?.length || 2) : 2;
		appendForm = {
			route_type: base?.route_type || 'REGULAR',
			start_date: new Date().toISOString().slice(0, 10),
			end_date: '',
			vehicle_count: count,
			start_turn_seq: base?.start_turn_seq || 1,
			version: '',
			is_regular_duty: Boolean(base?.is_regular_duty)
		};
		if (base?.timetables && base.timetables.length > 0) {
			appendTimetables = base.timetables.map((/** @type {any} */ t) => ({
				seq: t.seq,
				start_time: t.start_time || '06:00',
				end_time: t.end_time || '22:00',
				start_location: t.start_location || '기점',
				end_location: t.end_location || '종점',
				start_garage: t.start_garage || '',
				end_garage: t.end_garage || '',
				is_regular_duty: Boolean(t.is_regular_duty)
			}));
		} else {
			appendTimetables = [];
		}
		showAppendForm = true;
	}

	async function handleAppendRoster() {
		if (!selectedRouteName) {
			toast.warning('노선을 먼저 선택하세요.');
			return;
		}
		if (!appendForm.start_date) {
			toast.warning('적용 시작일을 입력하세요.');
			return;
		}
		appending = true;
		try {
			const res = await adminAppendRouteRoster({
				route_name: selectedRouteName,
				route_type: appendForm.route_type,
				start_date: appendForm.start_date,
				end_date: appendForm.end_date || null,
				vehicle_count: Number(appendForm.vehicle_count || appendTimetables.length),
				start_turn_seq: Math.max(1, Number(appendForm.start_turn_seq) || 1),
				version: appendForm.version.trim() || null,
				is_regular_duty: appendForm.is_regular_duty,
				timetables: appendTimetables.map((t, idx) => ({
					seq: idx + 1,
					start_time: t.start_time || '06:00',
					end_time: t.end_time || '22:00',
					start_location: t.start_location || '기점',
					end_location: t.end_location || '종점',
					start_garage: t.start_garage || null,
					end_garage: t.end_garage || null,
					is_regular_duty: Boolean(t.is_regular_duty)
				}))
			});
			toast.success(`로번 버전(${res.version})이 Append-Only로 추가되었습니다.`);
			showAppendForm = false;
			await loadAll();
		} catch (e) {
			toast.error('로번 추가 실패: ' + formatApiError(e));
		} finally {
			appending = false;
		}
	}

	/** @param {any} v */
	function isFutureVersion(v) {
		const today = formatDate(new Date());
		return Boolean(v?.start_date && String(v.start_date).slice(0, 10) > today);
	}

	/** @param {any} v */
	async function handleDeleteRosterVersion(v) {
		if (!isFutureVersion(v)) {
			toast.warning('이미 적용되었거나 지난 로번은 과거 배차 이력 보존을 위해 삭제할 수 없습니다.');
			return;
		}
		if (
			!confirm(
				'미래 적용 예정인 이 로번 버전을 삭제하시겠습니까?'
			)
		)
			return;
		try {
			await adminDeleteRouteMaster(v.id);
			toast.success('미래 적용 로번 버전이 삭제되었습니다.');
			await loadAll();
		} catch (e) {
			toast.error('삭제 실패: ' + formatApiError(e));
		}
	}

	// --- [탭 3: 구간 시간 관리] ---
	function addSegmentRow() {
		const nextSeq = segmentRows.length + 1;
		const prevEnd = segmentRows[segmentRows.length - 1]?.end_stop || '';
		segmentRows = [
			...segmentRows,
			{
				seq: nextSeq,
				segment_name: prevEnd ? `${prevEnd} → ` : `구간 ${nextSeq}`,
				start_stop: prevEnd,
				end_stop: '',
				duration_min: 10,
				distance_km: '',
				memo: ''
			}
		];
	}

	/**
	 * @param {number} idx
	 * @param {number} delta
	 */
	function moveSegmentRow(idx, delta) {
		const next = [...segmentRows];
		const target = idx + delta;
		if (target < 0 || target >= next.length) return;
		[next[idx], next[target]] = [next[target], next[idx]];
		segmentRows = next.map((s, i) => ({ ...s, seq: i + 1 }));
	}

	/** @param {number} idx */
	function removeSegmentRow(idx) {
		segmentRows = segmentRows.filter((_, i) => i !== idx).map((s, i) => ({ ...s, seq: i + 1 }));
	}

	async function handleSaveSegments() {
		if (!selectedRouteName) {
			toast.warning('노선을 선택하세요.');
			return;
		}
		savingSegments = true;
		try {
			const activeMasterId =
				uniqueRoutes.find((r) => r.route_name === selectedRouteName)?.active_version?.id || null;
			await adminSaveRouteSegments({
				route_name: selectedRouteName,
				route_master_id: activeMasterId,
				segments: segmentRows.map((s, i) => ({
					seq: i + 1,
					segment_name:
						(s.segment_name || '').trim() || `${s.start_stop || '출발'} → ${s.end_stop || '도착'}`,
					start_stop: s.start_stop || null,
					end_stop: s.end_stop || null,
					duration_min: Math.max(0, Number(s.duration_min) || 0),
					distance_km: s.distance_km || null,
					memo: s.memo || null
				}))
			});
			toast.success(`[${selectedRouteName}] 구간 시간이 저장되었습니다.`);
			await loadAll();
		} catch (e) {
			toast.error('구간 시간 저장 실패: ' + formatApiError(e));
		} finally {
			savingSegments = false;
		}
	}

	/** @param {any} v */
	function getVersionBadge(v) {
		const today = new Date().toISOString().slice(0, 10);
		if (v.end_date && v.end_date < today)
			return { label: '과거 이력', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
		if (v.start_date > today)
			return { label: '미래 예정', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
		return { label: '현재 적용중', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
	}
</script>

<svelte:head>
	<title>노선 마스터 관리 | {getSiteTitle()}</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
	<!-- 1. 헤더 -->
	<header
		class="flex flex-col gap-4 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="space-y-1">
			<div
				class="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black tracking-widest text-blue-700 uppercase"
			>
				<Icon icon="ph:bus-bold" class="text-sm" />
				<span>Route Master Architecture</span>
			</div>
			<h1 class="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
				노선 마스터 통합 관리
			</h1>
			<p class="text-xs font-medium text-slate-500">
				1단계 노선 정의 → 2단계 날짜별 로번(Append-Only 이력) → 3단계 구간 시간 입력 순서로
				관리합니다.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={loadAll}
				disabled={loading}
				class="flex items-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:border-slate-400 disabled:opacity-50"
			>
				<Icon icon="ph:arrows-clockwise-bold" class="text-base {loading ? 'animate-spin' : ''}" />
				<span>새로고침</span>
			</button>
			<a
				href="/v1/admin"
				class="flex items-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm transition hover:border-slate-400"
			>
				<Icon icon="ph:house-bold" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>
		</div>
	</header>

	<!-- 2. 3단계 요약 카드 -->
	<section class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<button
			type="button"
			onclick={() => (activeTab = 'routes')}
			class="group rounded-[1.75rem] border-2 bg-white p-5 text-left shadow-sm transition {activeTab ===
			'routes'
				? 'border-blue-500 bg-blue-50/20 ring-2 ring-blue-500/20'
				: 'border-slate-100 hover:border-blue-300'}"
		>
			<div class="mb-3 flex w-full items-center justify-between gap-2">
				<span
					class="min-w-0 truncate rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-700"
					>1단계 · 노선 정의</span
				>
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"
				>
					<Icon icon="ph:map-trifold-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900">
				{loading ? '...' : uniqueRoutes.length}
				<span class="ml-1 text-sm font-bold text-slate-400">개 노선</span>
			</div>
			<p class="mt-2 text-[11px] font-bold text-slate-500">정규/임시 노선 마스터 정의</p>
		</button>

		<button
			type="button"
			onclick={() => (activeTab = 'rosters')}
			class="group w-full rounded-[1.75rem] border-2 bg-white p-5 text-left shadow-sm transition {activeTab ===
			'rosters'
				? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20'
				: 'border-slate-100 hover:border-emerald-300'}"
		>
			<div class="mb-3 flex w-full items-center justify-between gap-2">
				<span
					class="min-w-0 truncate rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700"
					>2단계 · 로번 생성</span
				>
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"
				>
					<Icon icon="ph:calendar-check-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900">
				{loading ? '...' : routeMasters.length}
				<span class="ml-1 text-sm font-bold text-slate-400">개 이력 버전</span>
			</div>
			<p class="mt-2 text-[11px] font-bold text-slate-500">날짜별 과거·현재·미래 Append-Only</p>
		</button>

		<button
			type="button"
			onclick={() => (activeTab = 'segments')}
			class="group rounded-[1.75rem] border-2 bg-white p-5 text-left shadow-sm transition {activeTab ===
			'segments'
				? 'border-amber-500 bg-amber-50/20 ring-2 ring-amber-500/20'
				: 'border-slate-100 hover:border-amber-300'}"
		>
			<div class="mb-3 flex items-center justify-between">
				<span class="rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-700"
					>3단계 · 구간 시간</span
				>
				<div
					class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"
				>
					<Icon icon="ph:timer-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900">
				{loading ? '...' : allSegments.length}
				<span class="ml-1 text-sm font-bold text-slate-400">개 등록 구간</span>
			</div>
			<p class="mt-2 text-[11px] font-bold text-slate-500">노선별 정류장 구간 및 소요시간</p>
		</button>
	</section>

	<!-- 3. 3단계 탭 네비게이션 -->
	<nav class="no-scrollbar flex gap-2 overflow-x-auto border-b-2 border-slate-200">
		<button
			type="button"
			onclick={() => (activeTab = 'routes')}
			class="px-6 py-3.5 text-xs font-black tracking-wide whitespace-nowrap transition-all {activeTab ===
			'routes'
				? 'rounded-t-2xl border-b-4 border-blue-600 bg-blue-50/60 text-blue-700'
				: 'text-slate-400 hover:text-slate-700'}"
		>
			1. 노선 정의 ({uniqueRoutes.length})
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'rosters')}
			class="px-6 py-3.5 text-xs font-black tracking-wide whitespace-nowrap transition-all {activeTab ===
			'rosters'
				? 'rounded-t-2xl border-b-4 border-emerald-600 bg-emerald-50/60 text-emerald-700'
				: 'text-slate-400 hover:text-slate-700'}"
		>
			2. 로번 생성 · 날짜별 이력 ({routeMasters.length})
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'segments')}
			class="px-6 py-3.5 text-xs font-black tracking-wide whitespace-nowrap transition-all {activeTab ===
			'segments'
				? 'rounded-t-2xl border-b-4 border-amber-600 bg-amber-50/60 text-amber-800'
				: 'text-slate-400 hover:text-slate-700'}"
		>
			3. 구간 시간 입력 ({allSegments.length})
		</button>
	</nav>

	<!-- 4. 탭 본문 -->
	{#if loading}
		<div class="flex justify-center py-20">
			<div
				class="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
			></div>
		</div>
	{:else if activeTab === 'routes'}
		<!-- [탭 1] 노선 정의 -->
		<div class="space-y-4">
			<div
				class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
			>
				<div class="flex flex-wrap items-center gap-2">
					<input
						type="text"
						bind:value={routeSearch}
						placeholder="노선명 검색..."
						class="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold focus:border-blue-500 focus:bg-white focus:outline-none"
					/>
					<select
						bind:value={filterType}
						class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
					>
						<option value="ALL">전체 유형</option>
						<option value="REGULAR">정규 노선</option>
						<option value="TEMPORARY">임시 노선</option>
					</select>
				</div>
				<button
					type="button"
					onclick={() => openRouteModal()}
					class="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-blue-700"
				>
					<Icon icon="ph:plus-bold" />
					<span>새 노선 정의</span>
				</button>
			</div>

			<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredRoutes as r (r.route_name)}
					<div
						class="flex flex-col justify-between rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-400"
					>
						<div>
							<div class="mb-3 flex items-start justify-between">
								<span
									class="rounded-lg border px-2.5 py-0.5 text-[10px] font-black {r.route_type ===
									'REGULAR'
										? 'border-blue-200 bg-blue-50 text-blue-700'
										: 'border-amber-200 bg-amber-50 text-amber-700'}"
								>
									{r.route_type === 'REGULAR' ? '정규노선' : '임시노선'}
								</span>
								<button
									type="button"
									onclick={() => openRouteModal(r)}
									class="rounded-lg px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50"
								>
									수정
								</button>
							</div>
							<h3 class="text-2xl font-black tracking-tight text-slate-900">{r.route_name}</h3>
							<div class="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
								<span class="rounded-lg bg-slate-100 px-2.5 py-1"
									>현재 차량 {r.active_version?.vehicle_count || 0}대</span
								>
								<span class="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700"
									>로번 이력 {r.version_count}건</span
								>
								<span class="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-700"
									>구간 {r.segment_count}개</span
								>
							</div>
						</div>
						<div
							class="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-black"
						>
							<button
								type="button"
								onclick={() => {
									selectedRouteName = r.route_name;
									activeTab = 'rosters';
								}}
								class="text-emerald-600 hover:underline"
							>
								로번 이력 관리 →
							</button>
							<button
								type="button"
								onclick={() => {
									selectedRouteName = r.route_name;
									activeTab = 'segments';
								}}
								class="text-amber-600 hover:underline"
							>
								구간 시간 입력 →
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else if activeTab === 'rosters'}
		<!-- [탭 2] 로번 생성 (Append-Only 날짜별 과거·현재·미래 이력) -->
		<div class="space-y-5">
			<div
				class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
			>
				<div class="flex flex-wrap items-center gap-2.5">
					<label for="roster-route-select" class="text-xs font-black text-slate-700"
						>대상 노선:</label
					>
					<select
						id="roster-route-select"
						bind:value={selectedRouteName}
						class="rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-900"
					>
						{#each uniqueRoutes as r}
							<option value={r.route_name}>{r.route_name} ({r.version_count}개 버전)</option>
						{/each}
					</select>

					<div class="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
						{#each [['ALL', '전체'], ['PAST', '과거'], ['ACTIVE', '현재'], ['FUTURE', '미래']] as [val, label]}
							<button
								type="button"
								onclick={() => (rosterScopeFilter = /** @type {any} */ (val))}
								class="rounded-lg px-2.5 py-1 text-[11px] font-black transition {rosterScopeFilter ===
								val
									? 'bg-emerald-600 text-white'
									: 'text-slate-600 hover:bg-white'}"
							>
								{label}
							</button>
						{/each}
					</div>

					<input
						type="date"
						bind:value={rosterDateFilter}
						title="특정 날짜 기준 적용 로번 필터"
						class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700"
					/>
					{#if rosterDateFilter}
						<button
							type="button"
							onclick={() => (rosterDateFilter = '')}
							class="text-xs font-bold text-rose-500 hover:underline"
						>
							날짜 초기화
						</button>
					{/if}
				</div>

				<button
					type="button"
					onclick={() => openAppendRoster()}
					class="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700"
				>
					<Icon icon="ph:plus-bold" />
					<span>새 로번 버전 추가 (Append-Only)</span>
				</button>
			</div>

			{#if showAppendForm}
				<div class="space-y-4 rounded-3xl border-2 border-emerald-300 bg-white p-6 shadow-md">
					<div class="flex items-center justify-between border-b border-slate-100 pb-3">
						<div>
							<h3 class="text-base font-black text-slate-900">
								[{selectedRouteName}] 새 로번 버전 추가 (Append-Only)
							</h3>
							<p class="text-[11px] text-slate-500">
								기존 과거·미래 버전은 삭제되지 않으며, 겹치는 직전 버전의 종료일이 시작일 전날로
								자동 마감됩니다.
							</p>
						</div>
						<button
							type="button"
							onclick={() => (showAppendForm = false)}
							class="text-xs font-bold text-slate-400 hover:text-slate-700"
						>
							닫기
						</button>
					</div>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
						<div>
							<label for="app-start-date" class="mb-1 block text-[11px] font-black text-slate-700"
								>적용 시작일 *</label
							>
							<input
								id="app-start-date"
								type="date"
								bind:value={appendForm.start_date}
								class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold"
							/>
						</div>
						<div>
							<label for="app-end-date" class="mb-1 block text-[11px] font-black text-slate-700"
								>적용 종료일 (선택)</label
							>
							<input
								id="app-end-date"
								type="date"
								bind:value={appendForm.end_date}
								class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold"
							/>
						</div>
						<div>
							<label
								for="app-vehicle-count"
								class="mb-1 block text-[11px] font-black text-slate-700">배차 로번 수</label
							>
							<input
								id="app-vehicle-count"
								type="number"
								min="1"
								max="50"
								bind:value={appendForm.vehicle_count}
								class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold"
							/>
						</div>
						<div>
							<label for="app-start-turn" class="mb-1 block text-[11px] font-black text-slate-700"
								>시작 로번 (표 맨 위)</label
							>
							<input
								id="app-start-turn"
								type="number"
								min="1"
								max={Math.max(1, Number(appendForm.vehicle_count) || 50)}
								bind:value={appendForm.start_turn_seq}
								class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold"
							/>
						</div>
						<div>
							<label for="app-version" class="mb-1 block text-[11px] font-black text-slate-700"
								>버전명 (비우면 자동)</label
							>
							<input
								id="app-version"
								type="text"
								bind:value={appendForm.version}
								placeholder="예: v2, 2026-하계"
								class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold"
							/>
						</div>
						<div class="flex items-end pb-2">
							<label
								class="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700"
							>
								<input
									type="checkbox"
									bind:checked={appendForm.is_regular_duty}
									class="h-4 w-4 rounded border-slate-300 text-emerald-600"
								/>
								<span>당연 근무</span>
							</label>
						</div>
					</div>

					<div class="overflow-x-auto rounded-2xl border border-slate-200">
						<table class="w-full text-left text-xs">
							<thead
								class="border-b border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500"
							>
								<tr>
									<th class="px-3 py-2.5">로번</th>
									<th class="px-3 py-2.5">시작(24H)</th>
									<th class="px-3 py-2.5">종료(24H)</th>
									<th class="px-3 py-2.5">기점</th>
									<th class="px-3 py-2.5">종점</th>
									<th class="px-3 py-2.5">출고/입고 차고지</th>
									<th class="px-3 py-2.5 text-center">당연 근무</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100">
								{#each appendTimetables as row, idx}
									<tr>
										<td class="px-3 py-2 font-black text-slate-800">{idx + 1}로번</td>
										<td class="px-3 py-2">
											<input
												type="text"
												value={row.start_time}
												oninput={(e) => (row.start_time = format24hTime(e.currentTarget.value))}
												class="w-20 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs font-bold"
											/>
										</td>
										<td class="px-3 py-2">
											<input
												type="text"
												value={row.end_time}
												oninput={(e) => (row.end_time = format24hTime(e.currentTarget.value))}
												class="w-20 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs font-bold"
											/>
										</td>
										<td class="px-3 py-2">
											<input
												type="text"
												bind:value={row.start_location}
												class="w-28 rounded-lg border border-slate-200 px-2 py-1 text-xs"
											/>
										</td>
										<td class="px-3 py-2">
											<input
												type="text"
												bind:value={row.end_location}
												class="w-28 rounded-lg border border-slate-200 px-2 py-1 text-xs"
											/>
										</td>
										<td class="flex gap-1 px-3 py-2">
											<input
												type="text"
												bind:value={row.start_garage}
												placeholder="출고"
												class="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs"
											/>
											<input
												type="text"
												bind:value={row.end_garage}
												placeholder="입고"
												class="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs"
											/>
										</td>
										<td class="px-3 py-2 text-center">
											<input
												type="checkbox"
												bind:checked={row.is_regular_duty}
												class="h-4 w-4 rounded border-slate-300 text-emerald-600"
												aria-label={`${idx + 1}로번 당연 근무`}
											/>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<div class="flex justify-end gap-2">
						<button
							type="button"
							onclick={() => (showAppendForm = false)}
							class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
						>
							취소
						</button>
						<button
							type="button"
							disabled={appending}
							onclick={handleAppendRoster}
							class="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
						>
							{appending ? '저장 중...' : 'Append-Only 로번 등록'}
						</button>
					</div>
				</div>
			{/if}

			<!-- 날짜별 이력 타임라인 -->
			<div class="space-y-3">
				{#if selectedRouteVersions.length === 0}
					<div
						class="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-12 text-center text-xs font-bold text-slate-400"
					>
						조건에 해당하는 로번 이력이 없습니다.
					</div>
				{:else}
					{#each selectedRouteVersions as v (v.id)}
						{@const badge = getVersionBadge(v)}
						<div class="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-xs">
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div class="flex flex-wrap items-center gap-2.5">
									<span class="rounded-lg border px-2.5 py-0.5 text-[11px] font-black {badge.cls}"
										>{badge.label}</span
									>
									<span class="font-mono text-sm font-black text-slate-900">{v.version}</span>
									<span class="text-xs font-bold text-slate-600">
										{v.start_date} ~ {v.end_date || '진행중 (종료일 없음)'}
									</span>
									<span
										class="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600"
									>
										로번 {v.vehicle_count}대 ({v.timetables?.length || 0}행)
									</span>
								</div>
								<div class="flex items-center gap-2">
									<button
										type="button"
										onclick={() =>
											(inspectingVersionId = inspectingVersionId === v.id ? null : v.id)}
										class="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
									>
										{inspectingVersionId === v.id ? '시간표 접기' : '시간표 보기'}
									</button>
									<button
										type="button"
										onclick={() => openAppendRoster(v)}
										class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
									>
										이 버전 복사 → 새 버전
									</button>
									{#if isFutureVersion(v)}
										<button
											type="button"
											onclick={() => handleDeleteRosterVersion(v)}
											class="rounded-lg px-2.5 py-1 text-xs font-bold text-rose-500 hover:bg-rose-50"
										>
											삭제
										</button>
									{:else}
										<span
											title="적용일이 시작되었거나 지난 로번은 과거 배차 이력 참조를 위해 삭제할 수 없습니다"
											class="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-400"
										>
											이력 보관
										</span>
									{/if}
								</div>
							</div>

							{#if inspectingVersionId === v.id}
								<div class="mt-4 overflow-x-auto rounded-xl border border-slate-200">
									<table class="w-full text-left text-xs">
										<thead
											class="border-b border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500"
										>
											<tr>
												<th class="px-3 py-2">순번</th>
												<th class="px-3 py-2">운행 시간</th>
												<th class="px-3 py-2">기점 → 종점</th>
												<th class="px-3 py-2">차고지 (출고/입고)</th>
												<th class="px-3 py-2 text-center">당연 근무</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-slate-100">
											{#each v.timetables || [] as tt}
												<tr>
													<td class="px-3 py-2 font-black">{tt.seq}로번</td>
													<td class="px-3 py-2 font-mono font-bold text-blue-700"
														>{tt.start_time} ~ {tt.end_time}</td
													>
													<td class="px-3 py-2">{tt.start_location} → {tt.end_location}</td>
													<td class="px-3 py-2 text-slate-500"
														>{tt.start_garage || '-'} / {tt.end_garage || '-'}</td
													>
													<td class="px-3 py-2 text-center">
														{#if tt.is_regular_duty}
															<span
																class="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700"
																>당연 근무</span
															>
														{:else}
															<span class="text-[10px] font-bold text-slate-400">일반</span>
														{/if}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{:else}
		<!-- [탭 3] 구간 시간 입력 -->
		<div class="space-y-4">
			<div
				class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
			>
				<div class="flex flex-wrap items-center gap-3">
					<label for="seg-route-select" class="text-xs font-black text-slate-700">대상 노선:</label>
					<select
						id="seg-route-select"
						bind:value={selectedRouteName}
						class="rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-900"
					>
						{#each uniqueRoutes as r}
							<option value={r.route_name}>{r.route_name}</option>
						{/each}
					</select>
					<span
						class="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-800"
					>
						총 소요시간: {totalSegmentMinutes}분 ({Math.floor(totalSegmentMinutes / 60)}시간 {totalSegmentMinutes %
							60}분)
					</span>
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={addSegmentRow}
						class="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
					>
						<Icon icon="ph:plus-bold" />
						<span>구간 추가</span>
					</button>
					<button
						type="button"
						disabled={savingSegments}
						onclick={handleSaveSegments}
						class="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
					>
						<Icon icon="ph:floppy-disk-bold" />
						<span>{savingSegments ? '저장 중...' : '구간 시간 저장'}</span>
					</button>
				</div>
			</div>

			<div class="overflow-x-auto rounded-2xl border-2 border-slate-200 bg-white">
				{#if segmentRows.length === 0}
					<div class="py-12 text-center text-xs font-bold text-slate-400">
						등록된 구간이 없습니다. `구간 추가` 버튼을 눌러 노선의 구간별 소요시간을 입력하세요.
					</div>
				{:else}
					<table class="w-full text-left text-xs">
						<thead
							class="border-b border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500"
						>
							<tr>
								<th class="px-4 py-3">순번</th>
								<th class="px-4 py-3">구간명</th>
								<th class="px-4 py-3">출발 정류장</th>
								<th class="px-4 py-3">도착 정류장</th>
								<th class="px-4 py-3">소요시간 (분)</th>
								<th class="px-4 py-3">거리 (km)</th>
								<th class="px-4 py-3">비고</th>
								<th class="px-4 py-3 text-right">관리</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each segmentRows as seg, idx}
								<tr>
									<td class="px-4 py-2.5 font-black text-slate-800">{idx + 1}</td>
									<td class="px-4 py-2.5">
										<input
											type="text"
											bind:value={seg.segment_name}
											placeholder="예: 터미널 → 연동"
											class="w-40 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold"
										/>
									</td>
									<td class="px-4 py-2.5">
										<input
											type="text"
											bind:value={seg.start_stop}
											placeholder="출발지"
											class="w-28 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
										/>
									</td>
									<td class="px-4 py-2.5">
										<input
											type="text"
											bind:value={seg.end_stop}
											placeholder="도착지"
											class="w-28 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
										/>
									</td>
									<td class="px-4 py-2.5">
										<input
											type="number"
											min="0"
											bind:value={seg.duration_min}
											class="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-amber-700"
										/>
									</td>
									<td class="px-4 py-2.5">
										<input
											type="text"
											bind:value={seg.distance_km}
											placeholder="예: 4.5"
											class="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
										/>
									</td>
									<td class="px-4 py-2.5">
										<input
											type="text"
											bind:value={seg.memo}
											placeholder="메모"
											class="w-32 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
										/>
									</td>
									<td class="space-x-1 px-4 py-2.5 text-right">
										<button
											type="button"
											disabled={idx === 0}
											onclick={() => moveSegmentRow(idx, -1)}
											class="rounded border border-slate-200 px-1.5 py-1 text-[10px] font-black disabled:opacity-30"
											>▲</button
										>
										<button
											type="button"
											disabled={idx === segmentRows.length - 1}
											onclick={() => moveSegmentRow(idx, 1)}
											class="rounded border border-slate-200 px-1.5 py-1 text-[10px] font-black disabled:opacity-30"
											>▼</button
										>
										<button
											type="button"
											onclick={() => removeSegmentRow(idx)}
											class="px-2 py-1 font-bold text-rose-500 hover:underline">삭제</button
										>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- 1단계 노선 정의 생성/수정 모달 -->
{#if showRouteModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		onclick={() => (showRouteModal = false)}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
	>
		<div
			onclick={(e) => e.stopPropagation()}
			class="w-full max-w-md space-y-4 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-2xl"
		>
			<h3 class="text-lg font-black text-slate-900">
				1단계 · 노선 정의 {editingRouteMasterId ? '수정' : '등록'}
			</h3>
			<div class="space-y-3">
				<div>
					<label for="rm-name" class="mb-1 block text-xs font-black text-slate-700">노선명 *</label>
					<input
						id="rm-name"
						type="text"
						bind:value={routeForm.route_name}
						placeholder="예: 121/122"
						class="w-full rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-xs font-bold"
					/>
				</div>
				<div>
					<label for="rm-type" class="mb-1 block text-xs font-black text-slate-700">노선 유형</label
					>
					<select
						id="rm-type"
						bind:value={routeForm.route_type}
						class="w-full rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-xs font-bold"
					>
						<option value="REGULAR">정규 노선 (REGULAR)</option>
						<option value="TEMPORARY">임시 노선 (TEMPORARY)</option>
					</select>
				</div>
				{#if !editingRouteMasterId}
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
						<div>
							<label for="rm-start" class="mb-1 block text-xs font-black text-slate-700"
								>초기 적용 시작일</label
							>
							<input
								id="rm-start"
								type="date"
								bind:value={routeForm.start_date}
								class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold"
							/>
						</div>
						<div>
							<label for="rm-veh" class="mb-1 block text-xs font-black text-slate-700"
								>초기 로번 수</label
							>
							<input
								id="rm-veh"
								type="number"
								min="1"
								bind:value={routeForm.vehicle_count}
								class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold"
							/>
						</div>
						<div>
							<label for="rm-start-turn" class="mb-1 block text-xs font-black text-slate-700"
								>시작 로번 (표 맨 위)</label
							>
							<input
								id="rm-start-turn"
								type="number"
								min="1"
								max={Math.max(1, Number(routeForm.vehicle_count) || 50)}
								bind:value={routeForm.start_turn_seq}
								class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold"
							/>
						</div>
					</div>
				{:else}
					<div>
						<label for="rm-start-turn-edit" class="mb-1 block text-xs font-black text-slate-700"
							>시작 로번 (표 제일 위 로번 번호)</label
						>
						<input
							id="rm-start-turn-edit"
							type="number"
							min="1"
							bind:value={routeForm.start_turn_seq}
							class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold"
						/>
					</div>
				{/if}
				<label
					class="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700"
				>
					<input
						type="checkbox"
						bind:checked={routeForm.is_regular_duty}
						class="h-4 w-4 rounded border-slate-300 text-blue-600"
					/>
					<span>당연 근무 노선</span>
				</label>
			</div>
			<div class="flex justify-end gap-2 pt-2">
				<button
					type="button"
					onclick={() => (showRouteModal = false)}
					class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
					>취소</button
				>
				<button
					type="button"
					onclick={saveRouteDefinition}
					class="rounded-xl bg-blue-600 px-5 py-2 text-xs font-black text-white hover:bg-blue-700"
					>저장</button
				>
			</div>
		</div>
	</div>
{/if}

<script>
	/**
	 * @file (app)/v1/admin/backup/+page.svelte
	 * @description 관리자 백업 관리 페이지 (탭 구조: 프린트 백업 / DB·파일 백업)
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import { getSiteTitle } from '$lib/config/site';
	import Icon from '@iconify/svelte';

	const auth = getAuthContext();

	let activeTab = $state(/** @type {'print' | 'archive'} */ ('print'));
	let loadingApps = $state(true);
	let loadingData = $state(false);
	let savingLog = $state(false);
	let exportingXlsx = $state(false);
	let deletingLogId = $state(/** @type {number | null} */ (null));

	/** @type {Array<{ app_id: string, name: string, has_date_filter: boolean, date_field: string | null, fields: Array<{ key: string, label: string, default: boolean }>, last_log: any }>} */
	let backupApps = $state([]);
	let selectedAppId = $state('');
	let selectedFields = $state(/** @type {string[]} */ ([]));

	// 기간 · 모드 상태
	let mode = $state(/** @type {'CONTINUE' | 'HALF_YEAR' | 'CUSTOM'} */ ('CUSTOM'));
	let startDate = $state('');
	let endDate = $state('');

	// 인쇄 옵션
	let paperSize = $state(/** @type {'auto' | 'A4' | 'A3' | 'A5' | 'B4' | 'B5'} */ ('A4'));
	let orientation = $state(/** @type {'portrait' | 'landscape'} */ ('landscape'));
	let colorMode = $state(/** @type {'color' | 'mono'} */ ('mono'));
	let showApproval = $state(true);
	let showWatermark = $state(true);

	// 조회된 대장 데이터 & 출력 이력
	let printResult = $state(/** @type {any | null} */ (null));
	let printLogs = $state(/** @type {any[]} */ ([]));
	let printedAt = $state('');

	let currentApp = $derived(backupApps.find((a) => a.app_id === selectedAppId) ?? null);
	let filteredPrintLogs = $derived(
		selectedAppId ? printLogs.filter((l) => l.app_id === selectedAppId) : printLogs
	);
	let issuerDisplay = $derived.by(() => {
		const u = auth?.user;
		if (!u) return '관리자';
		const name = u.real_name || u.username || '관리자';
		return u.primary_group ? `${name} (${u.primary_group})` : name;
	});

	function initDefaultDates() {
		const now = new Date();
		const y = now.getFullYear();
		const m = String(now.getMonth() + 1).padStart(2, '0');
		const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
		startDate = `${y}-${m}-01`;
		endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
		printedAt = `${y}-${m}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	}

	/** @param {string} appId */
	function handleSelectApp(appId) {
		selectedAppId = appId;
		const app = backupApps.find((a) => a.app_id === appId);
		if (app) {
			selectedFields = app.fields.filter((f) => f.default).map((f) => f.key);
			mode = app.last_log ? 'CONTINUE' : 'CUSTOM';
		}
		printResult = null;
	}

	/** @param {string} key */
	function toggleField(key) {
		if (selectedFields.includes(key)) {
			if (selectedFields.length === 1) {
				toast.warning('최소 1개 이상의 필드를 선택해야 합니다.');
				return;
			}
			selectedFields = selectedFields.filter((k) => k !== key);
		} else {
			// 원래 정의된 순서 유지
			const order = currentApp?.fields.map((f) => f.key) || [];
			const next = new Set([...selectedFields, key]);
			selectedFields = order.filter((k) => next.has(k));
		}
	}

	function selectAllFields() {
		if (!currentApp) return;
		selectedFields = currentApp.fields.map((f) => f.key);
	}

	function resetDefaultFields() {
		if (!currentApp) return;
		selectedFields = currentApp.fields.filter((f) => f.default).map((f) => f.key);
	}

	/** @param {'H1' | 'H2' | 'MONTH'} preset */
	function applyDatePreset(preset) {
		const y = new Date().getFullYear();
		if (preset === 'H1') {
			mode = 'HALF_YEAR';
			startDate = `${y}-01-01`;
			endDate = `${y}-06-30`;
		} else if (preset === 'H2') {
			mode = 'HALF_YEAR';
			startDate = `${y}-07-01`;
			endDate = `${y}-12-31`;
		} else {
			mode = 'CUSTOM';
			initDefaultDates();
		}
	}

	async function loadInitial() {
		loadingApps = true;
		try {
			const [appsRes, logsRes] = await Promise.all([
				api.adminGetBackupApps(),
				api.adminGetBackupPrintLogs()
			]);
			backupApps = appsRes?.apps || [];
			printLogs = logsRes?.logs || [];
			if (backupApps.length > 0 && !selectedAppId) {
				handleSelectApp(backupApps[0].app_id);
			}
		} catch (e) {
			toast.error(`백업 설정 로드 실패: ${/** @type {Error} */ (e).message}`);
		} finally {
			loadingApps = false;
		}
	}

	async function fetchPrintData() {
		if (!selectedAppId) return;
		loadingData = true;
		try {
			const res = await api.adminFetchBackupPrintData({
				app_id: selectedAppId,
				fields: selectedFields,
				mode,
				start_date: mode === 'CONTINUE' ? null : startDate,
				end_date: mode === 'CONTINUE' ? null : endDate,
				limit: 2000
			});
			printResult = res;
			const now = new Date();
			printedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
			if (res.record_count === 0) {
				toast.info('선택한 조건에 해당하는 데이터가 없습니다.');
			} else {
				toast.success(`${res.record_count}건의 백업 대장 데이터를 불러왔습니다.`);
			}
		} catch (e) {
			toast.error(`데이터 조회 실패: ${/** @type {Error} */ (e).message}`);
		} finally {
			loadingData = false;
		}
	}

	function handlePrint() {
		if (!printResult || printResult.record_count === 0) {
			toast.warning('먼저 출력할 데이터를 조회해 주세요.');
			return;
		}
		window.print();
	}

	async function handleExportXlsx() {
		if (!selectedAppId) {
			toast.warning('먼저 백업할 앱을 선택해 주세요.');
			return;
		}
		if (selectedFields.length === 0) {
			toast.warning('최소 1개 이상의 DB 필드를 선택해 주세요.');
			return;
		}
		exportingXlsx = true;
		try {
			const blob = await api.adminDownloadBackupPrintXlsx({
				app_id: selectedAppId,
				fields: selectedFields,
				mode,
				start_date: startDate || null,
				end_date: endDate || null,
				limit: 5000
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
			a.href = url;
			a.download = `backup_${selectedAppId}_${stamp}.xlsx`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
			toast.success('엑셀(.xlsx) 백업 파일이 다운로드되었습니다.');
		} catch (e) {
			toast.error(`엑셀 저장 실패: ${/** @type {Error} */ (e).message}`);
		} finally {
			exportingXlsx = false;
		}
	}

	async function handleConfirmPrintLog() {
		if (!printResult || printResult.record_count === 0) return;
		savingLog = true;
		try {
			await api.adminSaveBackupPrintLog({
				app_id: selectedAppId,
				app_name: currentApp?.name || selectedAppId,
				mode: printResult.mode,
				start_date: printResult.mode === 'CONTINUE' ? null : startDate,
				end_date: printResult.mode === 'CONTINUE' ? null : endDate,
				last_record_id: printResult.last_record_id,
				last_seq_no: printResult.last_seq_no,
				record_count: printResult.record_count,
				fields: selectedFields,
				checksum: printResult.checksum
			});
			toast.success('출력 이력 및 체크포인트가 저장되었습니다.');
			await loadInitial();
		} catch (e) {
			toast.error(`출력 이력 저장 실패: ${/** @type {Error} */ (e).message}`);
		} finally {
			savingLog = false;
		}
	}

	/** @param {any} log */
	async function handleReprintFromLog(log) {
		selectedAppId = log.app_id;
		selectedFields = Array.isArray(log.fields) && log.fields.length > 0 ? log.fields : selectedFields;
		if (log.start_date && log.end_date) {
			mode = log.mode === 'HALF_YEAR' ? 'HALF_YEAR' : 'CUSTOM';
			startDate = log.start_date;
			endDate = log.end_date;
		} else {
			mode = 'CUSTOM';
		}
		await fetchPrintData();
	}

	/** @param {any} log */
	async function handleDeletePrintLog(log) {
		if (!confirm(`제${log.id}호 (${log.app_name}) 출력 이력(체크포인트)을 삭제하시겠습니까?\n삭제 시 '이어서 출력' 기준점이 이전 이력으로 되돌아갑니다.`)) {
			return;
		}
		deletingLogId = log.id;
		try {
			await api.adminDeleteBackupPrintLog(log.id);
			toast.success(`제${log.id}호 체크포인트가 삭제되었습니다.`);
			await loadInitial();
		} catch (e) {
			toast.error(`체크포인트 삭제 실패: ${/** @type {Error} */ (e).message}`);
		} finally {
			deletingLogId = null;
		}
	}

	onMount(() => {
		initDefaultDates();
		loadInitial();
	});
</script>

<svelte:head>
	<title>{getSiteTitle('백업 관리')}</title>
	{@html `<style>
		@media print {
			@page {
				size: ${paperSize === 'auto' ? orientation : `${paperSize} ${orientation}`};
				margin: 10mm;
			}
		}
	</style>`}
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 lg:px-8 print:max-w-none print:space-y-3 print:px-0 print:py-0 print:pb-0">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 액션 바 (기본값: 새로고침 + 관리자 홈) -->
	<!-- ===================================================================== -->
	<div class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4 md:pb-8 print:hidden">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-emerald-400 uppercase">
					<span class="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
					Enterprise Backup Governance
				</span>
				<span class="text-xs font-bold text-slate-400">v1/admin/backup</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-4xl">
				백업 관리 <span class="not-italic text-blue-600">물리 대장·이력</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				설치된 앱의 DB 데이터를 기간·증분 조건으로 조회하여 물리적 대장(종이/PDF)으로 백업하고 출력 이력을 관리합니다.
			</p>
		</div>

		<!-- 상단 버튼 그룹 (맨 우측 [관리자 홈], 그 좌측 [새로고침] 고정) -->
		<div class="flex flex-wrap items-center gap-3">
			<button
				type="button"
				onclick={loadInitial}
				disabled={loadingApps}
				class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
			>
				<Icon icon="solar:restart-bold" class="text-base {loadingApps ? 'animate-spin' : ''}" />
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
	<!-- 2. 상단 4대 핵심 지표 요약 카드 (Status Cards) -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5 print:hidden">
		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Target Apps</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
					<Icon icon="solar:widget-5-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900">
					{backupApps.length}<span class="ml-1 text-xs font-normal text-slate-500">개 앱</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-slate-400">백업 지원 대상</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Print Logs</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
					<Icon icon="solar:history-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900">
					{printLogs.length}<span class="ml-1 text-xs font-normal text-slate-500">건</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-emerald-600">DB 마이그레이션 영속</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Selected App</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
					<Icon icon="solar:database-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="truncate text-lg font-black text-slate-900">
					{currentApp?.name || '-'}
				</div>
				<div class="mt-1 text-xs font-semibold text-slate-400">
					{currentApp?.last_log ? `마지막 일련번호 #${currentApp.last_log.last_seq_no}` : '신규 출력 대기'}
				</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Loaded Rows</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
					<Icon icon="solar:printer-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900">
					{printResult ? printResult.record_count.toLocaleString() : 0}<span class="ml-1 text-xs font-normal text-slate-500">건</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-slate-400">
					선택 필드 {selectedFields.length}개 · {paperSize.toUpperCase()}
				</div>
			</div>
		</div>
	</div>

	<!-- 탭 네비게이션 (인쇄 시 숨김) -->
	<div class="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white p-2 shadow-sm print:hidden">
		<button
			type="button"
			onclick={() => (activeTab = 'print')}
			class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition {activeTab === 'print' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}"
		>
			<Icon icon="solar:printer-bold-duotone" class="text-base" />
			<span>프린트 백업</span>
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'archive')}
			class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition {activeTab === 'archive' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}"
		>
			<Icon icon="solar:server-square-bold-duotone" class="text-base" />
			<span>DB / 파일 백업 (확장)</span>
		</button>
	</div>

	{#if activeTab === 'print'}
		<!-- 🎛️ 프린트 조건 설정 패널 (인쇄 시 숨김) -->
		<section class="space-y-5 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-xs md:p-6 print:hidden">
			{#if loadingApps}
				<div class="py-8 text-center text-xs font-bold text-slate-400">설치된 앱 목록을 불러오는 중...</div>
			{:else}
				<div class="grid grid-cols-1 gap-5 lg:grid-cols-12">
					<!-- 1. 설치된 앱 선택 -->
					<div class="space-y-2 lg:col-span-4">
						<label for="backup-app-select" class="block text-xs font-black text-slate-800">
							1. 설치된 앱 선택
						</label>
						<select
							id="backup-app-select"
							value={selectedAppId}
							onchange={(e) => handleSelectApp(/** @type {HTMLSelectElement} */ (e.currentTarget).value)}
							class="select select-bordered w-full rounded-xl font-bold text-slate-900"
						>
							{#each backupApps as appItem (appItem.app_id)}
								<option value={appItem.app_id}>{appItem.name} ({appItem.app_id})</option>
							{/each}
						</select>
						{#if currentApp?.last_log}
							<div class="rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2 text-[11px] font-bold text-blue-800">
								마지막 출력: 제{currentApp.last_log.id}호 · {currentApp.last_log.printed_at}
								(마지막 ID #{currentApp.last_log.last_record_id ?? '-'}, {currentApp.last_log.record_count}건)
							</div>
						{:else}
							<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-500">
								아직 출력 이력이 없습니다.
							</div>
						{/if}
					</div>

					<!-- 2. 기간 · 출력 모드 선택 -->
					<div class="space-y-2 lg:col-span-8">
						<span class="block text-xs font-black text-slate-800">2. 출력 모드 및 기간 선택</span>
						<div class="flex flex-wrap gap-2">
							<button
								type="button"
								disabled={!currentApp?.last_log}
								onclick={() => (mode = 'CONTINUE')}
								class="btn btn-xs md:btn-sm rounded-xl font-black {mode === 'CONTINUE' ? 'btn-primary' : 'btn-outline'}"
							>
								마지막 출력부터 이어서
							</button>
							<button
								type="button"
								onclick={() => applyDatePreset('H1')}
								class="btn btn-xs md:btn-sm rounded-xl font-black {mode === 'HALF_YEAR' && startDate.endsWith('01-01') ? 'btn-neutral' : 'btn-outline'}"
							>
								상반기 (1~6월)
							</button>
							<button
								type="button"
								onclick={() => applyDatePreset('H2')}
								class="btn btn-xs md:btn-sm rounded-xl font-black {mode === 'HALF_YEAR' && startDate.endsWith('07-01') ? 'btn-neutral' : 'btn-outline'}"
							>
								하반기 (7~12월)
							</button>
							<button
								type="button"
								onclick={() => applyDatePreset('MONTH')}
								class="btn btn-xs md:btn-sm rounded-xl font-black {mode === 'CUSTOM' ? 'btn-neutral' : 'btn-outline'}"
							>
								이번 달 / 직접 지정
							</button>
						</div>

						{#if mode !== 'CONTINUE'}
							<div class="mt-2 flex flex-wrap items-center gap-2">
								<input type="date" bind:value={startDate} class="input input-sm input-bordered rounded-xl font-bold" />
								<span class="font-bold text-slate-400">~</span>
								<input type="date" bind:value={endDate} class="input input-sm input-bordered rounded-xl font-bold" />
								{#if !currentApp?.has_date_filter}
									<span class="text-[11px] font-medium text-amber-600">
										* 이 앱은 날짜 컬럼이 없어 전체 레코드가 조회됩니다.
									</span>
								{/if}
							</div>
						{:else if currentApp?.last_log}
							<p class="mt-1 text-xs font-bold text-blue-700">
								ID #{currentApp.last_log.last_record_id} 이후 신규 데이터만 조회합니다. (연번 {Number(currentApp.last_log.last_seq_no || 0) + 1}번부터 시작)
							</p>
						{/if}
					</div>
				</div>

				<!-- 3. DB 필드 선택 -->
				{#if currentApp}
					<div class="space-y-2 border-t border-slate-100 pt-4">
						<div class="flex items-center justify-between">
							<span class="text-xs font-black text-slate-800">
								3. 출력할 DB 필드 선택 ({selectedFields.length}/{currentApp.fields.length})
							</span>
							<div class="flex gap-3 text-xs font-bold">
								<button type="button" onclick={selectAllFields} class="text-blue-600 hover:underline">전체 선택</button>
								<button type="button" onclick={resetDefaultFields} class="text-slate-500 hover:underline">기본값 복원</button>
							</div>
						</div>
						<div class="flex flex-wrap gap-2">
							{#each currentApp.fields as field (field.key)}
								{@const checked = selectedFields.includes(field.key)}
								<button
									type="button"
									onclick={() => toggleField(field.key)}
									class="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition {checked
										? 'border-blue-600 bg-blue-50 text-blue-800'
										: 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}"
								>
									<Icon icon={checked ? 'solar:check-square-bold' : 'solar:square-linear'} class="text-sm" />
									<span>{field.label}</span>
									<span class="font-mono text-[10px] opacity-60">({field.key})</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- 4. 용지 옵션 & 실행 버튼 -->
				<div class="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
					<div class="flex flex-wrap items-center gap-3 text-xs font-bold">
						<select aria-label="용지 규격" bind:value={paperSize} class="select select-xs select-bordered font-bold">
							<option value="A4">A4</option>
							<option value="A3">A3</option>
							<option value="B4">B4</option>
							<option value="B5">B5</option>
							<option value="A5">A5</option>
							<option value="auto">프린터 설정 따름</option>
						</select>
						<div class="join">
							<button type="button" onclick={() => (orientation = 'portrait')} class="btn join-item btn-xs {orientation === 'portrait' ? 'btn-neutral' : 'btn-outline'}">세로</button>
							<button type="button" onclick={() => (orientation = 'landscape')} class="btn join-item btn-xs {orientation === 'landscape' ? 'btn-neutral' : 'btn-outline'}">가로</button>
						</div>
						<div class="join">
							<button type="button" onclick={() => (colorMode = 'color')} class="btn join-item btn-xs {colorMode === 'color' ? 'btn-neutral' : 'btn-outline'}">컬러</button>
							<button type="button" onclick={() => (colorMode = 'mono')} class="btn join-item btn-xs {colorMode === 'mono' ? 'btn-neutral' : 'btn-outline'}">흑백</button>
						</div>
						<label class="flex cursor-pointer items-center gap-1">
							<input type="checkbox" bind:checked={showApproval} class="checkbox checkbox-xs checkbox-primary" />
							결재란
						</label>
						<label class="flex cursor-pointer items-center gap-1">
							<input type="checkbox" bind:checked={showWatermark} class="checkbox checkbox-xs checkbox-primary" />
							워터마크
						</label>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<button
							type="button"
							disabled={loadingData || !selectedAppId}
							onclick={fetchPrintData}
							class="btn btn-sm rounded-xl border-none bg-slate-900 px-5 font-black text-white hover:bg-slate-800"
						>
							{#if loadingData}
								<span class="loading loading-xs loading-spinner"></span>
							{/if}
							데이터 조회
						</button>
						<button
							type="button"
							disabled={exportingXlsx || !selectedAppId || selectedFields.length === 0}
							onclick={handleExportXlsx}
							class="btn btn-sm rounded-xl border border-emerald-300 bg-emerald-50 px-4 font-black text-emerald-800 hover:bg-emerald-600 hover:text-white"
						>
							{#if exportingXlsx}
								<span class="loading loading-xs loading-spinner"></span>
							{:else}
								<Icon icon="solar:file-download-bold-duotone" class="text-base" />
							{/if}
							엑셀(.xlsx) 저장
						</button>
						<button
							type="button"
							disabled={!printResult || printResult.record_count === 0}
							onclick={handlePrint}
							class="btn btn-sm rounded-xl border-none bg-blue-600 px-5 font-black text-white hover:bg-blue-700"
						>
							<Icon icon="solar:printer-bold" class="text-base" />
							인쇄 / PDF 저장
						</button>
						<button
							type="button"
							disabled={!printResult || printResult.record_count === 0 || savingLog}
							onclick={handleConfirmPrintLog}
							class="btn btn-sm rounded-xl border-none bg-emerald-600 px-5 font-black text-white hover:bg-emerald-700"
						>
							출력 이력 확정 저장
						</button>
					</div>
				</div>
			{/if}
		</section>

		<!-- 📄 보관용 대장 출력 영역 (화면 미리보기 + 인쇄 본문) -->
		{#if printResult}
			<article
				class="print-sheet rounded-3xl border border-slate-200 bg-white p-6 shadow-xs print:rounded-none print:border-none print:p-0 print:shadow-none
				{colorMode === 'mono' ? 'grayscale' : ''}"
			>
				<!-- 워터마크 (인쇄 시 전 페이지 반복) -->
				{#if showWatermark}
					<div class="print-watermark hidden" aria-hidden="true">
						<div class="grid h-full w-full grid-cols-2 grid-rows-3 place-items-center gap-12">
							{#each Array.from({ length: 6 }) as _, i (i)}
								<span class="-rotate-[28deg] text-xl font-black tracking-widest text-slate-900/10 select-none">
									물리백업 · {issuerDisplay} · {printedAt}
								</span>
							{/each}
						</div>
					</div>
				{/if}

				<!-- 대장 머리말 -->
				<header class="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-4 sm:flex-row sm:items-start">
					<div>
						<p class="text-[11px] font-bold text-slate-500">
							물리적 DB 백업 대장 · {currentApp?.name || printResult.app_id} ({printResult.app_id})
						</p>
						<h2 class="mt-1 text-2xl font-black text-slate-900">
							{currentApp?.name || printResult.app_id} 백업 대장
						</h2>
						<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-600">
							<span>
								조회구분:
								<strong class="text-slate-900">
									{printResult.mode === 'CONTINUE'
										? '이어서 출력 (증분)'
										: `${startDate || '-'} ~ ${endDate || '-'}`}
								</strong>
							</span>
							<span>총 <strong class="font-mono text-slate-900">{printResult.record_count}</strong>건</span>
							<span>연번 <strong class="font-mono text-slate-900">{printResult.start_seq}~{printResult.last_seq_no}</strong></span>
							<span>출력자: <strong class="text-slate-900">{issuerDisplay}</strong></span>
							<span>출력시각: <strong class="font-mono text-slate-900">{printedAt}</strong></span>
							<span>체크섬: <strong class="font-mono text-slate-900">{printResult.checksum}</strong></span>
						</div>
					</div>

					{#if showApproval}
						<table class="w-auto shrink-0 border-collapse border border-slate-900 text-center text-[11px]">
							<thead>
								<tr class="bg-slate-100">
									<th rowspan="2" class="w-6 border border-slate-900 px-1 py-1 font-black">결<br />재</th>
									<th class="w-16 border border-slate-900 px-2 py-1 font-bold">담당</th>
									<th class="w-16 border border-slate-900 px-2 py-1 font-bold">팀장</th>
									<th class="w-16 border border-slate-900 px-2 py-1 font-bold">대표</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td class="h-12 border border-slate-900"></td>
									<td class="h-12 border border-slate-900"></td>
									<td class="h-12 border border-slate-900"></td>
								</tr>
							</tbody>
						</table>
					{/if}
				</header>

				<!-- 대장 본문 표 -->
				{#if printResult.rows.length === 0}
					<div class="py-16 text-center text-sm font-bold text-slate-400">
						해당 조건에 출력할 신규 레코드가 없습니다.
					</div>
				{:else}
					<div class="mt-4 overflow-x-auto print:overflow-visible">
						<table class="w-full border-collapse border border-slate-400 text-left text-xs">
							<thead class="bg-slate-100 text-slate-900">
								<tr>
									<th class="border border-slate-400 px-2 py-1.5 text-center font-black">연번</th>
									{#each printResult.columns as col (col.key)}
										<th class="border border-slate-400 px-2.5 py-1.5 font-black">{col.label}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each printResult.rows as row (row._seq)}
									<tr class="even:bg-slate-50/70">
										<td class="border border-slate-300 px-2 py-1 text-center font-mono">{row._seq}</td>
										{#each printResult.columns as col (col.key)}
											<td class="max-w-[260px] break-words border border-slate-300 px-2.5 py-1">
												{row[col.key] || '-'}
											</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</article>
		{/if}

		<!-- 📜 최근 출력 이력 테이블 (인쇄 시 숨김) -->
		<section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs print:hidden">
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-sm font-black text-slate-900">
					{currentApp ? `[${currentApp.name}] 출력 이력` : '최근 물리 백업 출력 이력'} ({filteredPrintLogs.length}건)
				</h2>
				<span class="text-xs text-slate-400">선택한 앱의 이어서 출력 기준점(체크포인트)만 표시됩니다.</span>
			</div>

			{#if filteredPrintLogs.length === 0}
				<div class="py-8 text-center text-xs font-bold text-slate-400">
					{currentApp ? `[${currentApp.name}]에 저장된 출력 이력이 없습니다.` : '아직 저장된 출력 이력이 없습니다.'}
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead class="border-b border-slate-200 bg-slate-50 font-black text-slate-500">
							<tr>
								<th class="px-3 py-2.5">회차</th>
								<th class="px-3 py-2.5">앱</th>
								<th class="px-3 py-2.5">모드 / 기간</th>
								<th class="px-3 py-2.5 text-right">건수</th>
								<th class="px-3 py-2.5 text-right">마지막 ID / 연번</th>
								<th class="px-3 py-2.5">체크섬</th>
								<th class="px-3 py-2.5">출력자 · 시각</th>
								<th class="px-3 py-2.5 text-right">관리</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each filteredPrintLogs as log (log.id)}
								<tr class="hover:bg-slate-50">
									<td class="px-3 py-2 font-mono font-black">제{log.id}호</td>
									<td class="px-3 py-2 font-bold">{log.app_name} ({log.app_id})</td>
									<td class="px-3 py-2 text-slate-600">
										{log.mode === 'CONTINUE' ? '이어서 출력' : `${log.start_date || '-'} ~ ${log.end_date || '-'}`}
									</td>
									<td class="px-3 py-2 text-right font-mono font-bold">{log.record_count}건</td>
									<td class="px-3 py-2 text-right font-mono text-slate-600">
										#{log.last_record_id ?? '-'} / {log.last_seq_no}번
									</td>
									<td class="px-3 py-2 font-mono text-[11px] text-slate-500">{log.checksum || '-'}</td>
									<td class="px-3 py-2 text-slate-500">{log.printed_by} · {log.printed_at}</td>
									<td class="px-3 py-2 text-right">
										<div class="inline-flex items-center justify-end gap-3">
											<button
												type="button"
												onclick={() => handleReprintFromLog(log)}
												class="text-xs font-black text-blue-600 hover:underline"
											>
												불러오기
											</button>
											<button
												type="button"
												disabled={deletingLogId === log.id}
												onclick={() => handleDeletePrintLog(log)}
												class="text-xs font-black text-rose-600 hover:underline disabled:opacity-40"
											>
												{deletingLogId === log.id ? '삭제중...' : '삭제'}
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{:else}
		<!-- 🗄️ DB / 파일 백업 탭 (추후 확장용 자리) -->
		<section class="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
			<Icon icon="solar:server-square-bold-duotone" class="mx-auto text-5xl text-slate-300" />
			<h2 class="mt-3 text-lg font-black text-slate-700">DB 스냅샷 · 파일 아카이브 백업</h2>
			<p class="mt-1 text-xs font-medium text-slate-500">
				이 탭에는 추후 PostgreSQL 덤프 다운로드, XLSX 전체 내보내기, 자동 백업 스케줄 설정을 추가할 수 있습니다.
			</p>
		</section>
	{/if}
</div>

<style>
	@media print {
		:global(body) {
			background: #ffffff !important;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
		.print-sheet thead {
			display: table-header-group;
		}
		.print-sheet tr {
			break-inside: avoid;
			page-break-inside: avoid;
		}
		.print-watermark {
			display: block !important;
			position: fixed !important;
			inset: 0 !important;
			pointer-events: none !important;
			z-index: 9999 !important;
		}
	}
</style>

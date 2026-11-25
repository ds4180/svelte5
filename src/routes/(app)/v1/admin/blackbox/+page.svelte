<script lang="ts">
	/**
	 * @file (app)/v1/admin/blackbox/+page.svelte
	 * @description 관리자 블랙박스 비디오 관리 페이지 (장부/현재위치, 기사 교체요청, 사용이력 역조회, 차량 본체스펙)
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/blackbox';
	import { getSiteTitle } from '$lib/config/site';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatApiError } from '$lib/utils/error';
	import Icon from '@iconify/svelte';

	let activeTab = $state<'videos' | 'requests' | 'usages' | 'devices'>('videos');
	let loading = $state(true);

	let summary = $state({
		total_videos: 0,
		active_videos: 0,
		office_count: 0,
		vehicle_count: 0,
		disposed_count: 0,
		pending_requests: 0,
		device_count: 0,
		vehicles: [] as Array<{ vehicle_no: string; route: string }>
	});

	let videos = $state<any[]>([]);
	let requests = $state<any[]>([]);
	let usages = $state<any[]>([]);
	let devices = $state<any[]>([]);

	// 필터 상태
	let videoLocationFilter = $state<'' | 'OFFICE' | 'VEHICLE'>('');
	let videoSearch = $state('');
	let includeDisposed = $state(true);
	let sortKey = $state<'display_num' | 'video_no' | 'location' | 'days_elapsed'>('days_elapsed');
	let sortDir = $state<'asc' | 'desc'>('desc');
	let detailTargetVideo = $state<any | null>(null);

	let requestStatusFilter = $state('');

	let usageVideoQuery = $state('');
	let usageVehicleNo = $state('');
	let usageStartDate = $state('');
	let usageEndDate = $state('');

	let deviceSearch = $state('');

	// 비디오 등록/수정 모달
	let showVideoModal = $state(false);
	let editingVideoId = $state<number | null>(null);
	let videoForm = $state({
		video_no: '',
		display_num: '',
		manufacturer: '',
		spec: '',
		serial_no: '',
		purchase_date: '',
		disposal_date: '',
		location_type: 'OFFICE',
		current_vehicle_no: '',
		mounted_at: '',
		notes: ''
	});

	// 장착/교체 모달
	let mountTargetVideo = $state<any | null>(null);
	let mountVehicleNo = $state('');
	let mountDateTime = $state('');
	let mountNotes = $state('');

	// 요청 처리 모달
	let processingRequest = $state<any | null>(null);
	let processStatus = $state<'PREPARING' | 'COMPLETED' | 'REJECTED'>('COMPLETED');
	let replacementVideoId = $state<string>('');
	let processAdminNote = $state('');

	// 본체 등록/수정 모달
	let showDeviceModal = $state(false);
	let editingDeviceId = $state<number | null>(null);
	let deviceForm = $state({
		vehicle_no: '',
		manufacturer: '',
		model_name: '',
		channels: '2CH',
		led_count: 2,
		serial_no: '',
		installed_date: '',
		status: 'NORMAL',
		notes: ''
	});

	let officeVideos = $derived(videos.filter((v) => v.location_type === 'OFFICE' && !v.is_disposed));

	function toggleVideoSort(key: 'display_num' | 'video_no' | 'location' | 'days_elapsed') {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = key === 'days_elapsed' ? 'desc' : 'asc';
		}
	}

	let sortedVideos = $derived.by(() => {
		const list = [...videos];
		const dir = sortDir === 'asc' ? 1 : -1;
		return list.sort((a, b) => {
			if (sortKey === 'days_elapsed') {
				const da = a.location_type === 'VEHICLE' && a.days_elapsed !== null && a.days_elapsed !== undefined ? Number(a.days_elapsed) : -1;
				const db = b.location_type === 'VEHICLE' && b.days_elapsed !== null && b.days_elapsed !== undefined ? Number(b.days_elapsed) : -1;
				if (da !== db) {
					if (da === -1) return 1;
					if (db === -1) return -1;
					return (da - db) * dir;
				}
				return Number(a.display_num || 0) - Number(b.display_num || 0);
			}
			if (sortKey === 'location') {
				const la = a.is_disposed ? '2_DISPOSED' : a.location_type === 'VEHICLE' ? `0_${a.current_vehicle_no || ''}` : '1_OFFICE';
				const lb = b.is_disposed ? '2_DISPOSED' : b.location_type === 'VEHICLE' ? `0_${b.current_vehicle_no || ''}` : '1_OFFICE';
				return la.localeCompare(lb, 'ko') * dir;
			}
			if (sortKey === 'video_no') {
				return String(a.video_no || '').localeCompare(String(b.video_no || '')) * dir;
			}
			return (Number(a.display_num || 0) - Number(b.display_num || 0)) * dir;
		});
	});

	const REASON_LABELS: Record<string, string> = {
		CHECK: '영상 확인 요청',
		ACCIDENT: '사고 영상 확인',
		COMPLAINT: '민원·운행 확인',
		MALFUNCTION: '녹화/본체 이상',
		ROUTINE: '정기 교체',
		ETC: '기타'
	};

	async function loadAll() {
		loading = true;
		try {
			const [sumRes, vidRes, reqRes, devRes, usageRes] = await Promise.all([
				api.adminGetBlackboxSummary(),
				api.adminGetBlackboxVideos({
					location_type: videoLocationFilter || undefined,
					search: videoSearch.trim() || undefined,
					include_disposed: includeDisposed
				}),
				api.adminGetBlackboxRequests(requestStatusFilter || undefined),
				api.adminGetBlackboxDevices(deviceSearch.trim() || undefined),
				api.adminReverseLookupUsages({
					video_query: usageVideoQuery.trim() || undefined,
					vehicle_no: usageVehicleNo.trim() || undefined,
					start_date: usageStartDate || undefined,
					end_date: usageEndDate || undefined
				})
			]);
			if (sumRes) summary = sumRes;
			videos = vidRes?.videos || [];
			requests = reqRes?.requests || [];
			devices = devRes?.devices || [];
			usages = usageRes?.usages || [];
		} catch (e) {
			toast.error(formatApiError(e, '블랙박스 관리 데이터를 불러오지 못했습니다.'));
		} finally {
			loading = false;
		}
	}

	async function searchUsages() {
		try {
			const res = await api.adminReverseLookupUsages({
				video_query: usageVideoQuery.trim() || undefined,
				vehicle_no: usageVehicleNo.trim() || undefined,
				start_date: usageStartDate || undefined,
				end_date: usageEndDate || undefined
			});
			usages = res?.usages || [];
		} catch (e) {
			toast.error(formatApiError(e, '사용이력 역조회에 실패했습니다.'));
		}
	}

	function openReverseLookupForVideo(v: any) {
		usageVideoQuery = v.video_no;
		usageVehicleNo = '';
		usageStartDate = '';
		usageEndDate = '';
		activeTab = 'usages';
		searchUsages();
	}

	function getLocalDateNow(): string {
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}

	function getLocalDateTimeNow(): string {
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function openVideoCreate() {
		editingVideoId = null;
		videoForm = {
			video_no: '',
			display_num: '',
			manufacturer: '',
			spec: '',
			serial_no: '',
			purchase_date: getLocalDateNow(),
			disposal_date: '',
			location_type: 'OFFICE',
			current_vehicle_no: '',
			mounted_at: getLocalDateTimeNow(),
			notes: ''
		};
		showVideoModal = true;
	}

	function openVideoEdit(v: any) {
		editingVideoId = v.id;
		videoForm = {
			video_no: v.video_no || '',
			display_num: v.display_num || '',
			manufacturer: v.manufacturer || '',
			spec: v.spec || '',
			serial_no: v.serial_no || '',
			purchase_date: v.purchase_date || '',
			disposal_date: v.disposal_date || '',
			location_type: v.location_type || 'OFFICE',
			current_vehicle_no: v.current_vehicle_no || '',
			mounted_at: '',
			notes: v.notes || ''
		};
		showVideoModal = true;
	}

	async function saveVideo(e: Event) {
		e.preventDefault();
		try {
			if (editingVideoId) {
				await api.adminUpdateBlackboxVideo(editingVideoId, {
					video_no: videoForm.video_no.trim() || undefined,
					display_num: videoForm.display_num.trim(),
					manufacturer: videoForm.manufacturer.trim() || null,
					spec: videoForm.spec.trim() || null,
					serial_no: videoForm.serial_no.trim() || null,
					purchase_date: videoForm.purchase_date || null,
					disposal_date: videoForm.disposal_date || null,
					notes: videoForm.notes.trim() || null
				});
				toast.success('비디오 정보가 수정되었습니다.');
			} else {
				await api.adminCreateBlackboxVideo({
					video_no: videoForm.video_no.trim() || null,
					display_num: videoForm.display_num.trim(),
					manufacturer: videoForm.manufacturer.trim() || null,
					spec: videoForm.spec.trim() || null,
					serial_no: videoForm.serial_no.trim() || null,
					purchase_date: videoForm.purchase_date || null,
					disposal_date: videoForm.disposal_date || null,
					location_type: videoForm.location_type,
					current_vehicle_no: videoForm.location_type === 'VEHICLE' ? videoForm.current_vehicle_no.trim() : null,
					mounted_at: videoForm.location_type === 'VEHICLE' && videoForm.mounted_at ? videoForm.mounted_at : null,
					notes: videoForm.notes.trim() || null
				});
				toast.success('신규 비디오가 장부에 등록되었습니다.');
			}
			showVideoModal = false;
			await loadAll();
		} catch (err) {
			toast.error(formatApiError(err, '비디오 저장에 실패했습니다.'));
		}
	}

	async function removeVideo(v: any) {
		if (!confirm(`비디오 '${v.video_no} (#${v.display_num})'를 삭제하시겠습니까?`)) return;
		try {
			await api.adminDeleteBlackboxVideo(v.id);
			toast.success('삭제되었습니다.');
			await loadAll();
		} catch (err) {
			toast.error(formatApiError(err, '삭제 실패'));
		}
	}

	function openMountModal(v: any) {
		mountTargetVideo = v;
		mountVehicleNo = v.current_vehicle_no || (summary.vehicles[0]?.vehicle_no ?? '');
		mountDateTime = getLocalDateTimeNow();
		mountNotes = '';
	}

	async function confirmMount(e: Event) {
		e.preventDefault();
		if (!mountTargetVideo || !mountVehicleNo.trim()) {
			toast.warning('장착할 차량번호를 입력해 주세요.');
			return;
		}
		try {
			await api.adminMountBlackboxVideo(mountTargetVideo.id, {
				vehicle_no: mountVehicleNo.trim(),
				mounted_at: mountDateTime || null,
				notes: mountNotes.trim() || null,
				auto_swap: true
			});
			toast.success(`${mountVehicleNo.trim()}호에 장착 완료 (기존 장착 비디오는 자동 사무실 회수)`);
			mountTargetVideo = null;
			await loadAll();
		} catch (err) {
			toast.error(formatApiError(err, '차량 장착 처리 실패'));
		}
	}

	async function handleUnmount(v: any) {
		if (!confirm(`${v.video_no} (#${v.display_num})를 ${v.current_vehicle_no}호에서 사무실로 회수하시겠습니까?`)) return;
		try {
			await api.adminUnmountBlackboxVideo(v.id, { notes: '사무실 회수' });
			toast.success('사무실로 회수되었습니다.');
			await loadAll();
		} catch (err) {
			toast.error(formatApiError(err, '회수 처리 실패'));
		}
	}

	function openProcessModal(r: any) {
		processingRequest = r;
		processStatus = 'COMPLETED';
		replacementVideoId = officeVideos[0] ? String(officeVideos[0].id) : '';
		processAdminNote = r.admin_note || '';
	}

	async function markRequestPreparing(r: any) {
		try {
			await api.adminProcessBlackboxRequest(r.id, {
				status: 'PREPARING',
				replacement_video_id: null,
				admin_note: r.admin_note || '사무실 확인 완료 (교체 준비 중)'
			});
			toast.success('준비 중 상태로 변경되었습니다.');
			await loadAll();
		} catch (err) {
			toast.error(formatApiError(err, '상태 변경 실패'));
		}
	}

	async function confirmProcessRequest(e: Event) {
		e.preventDefault();
		if (!processingRequest) return;
		try {
			await api.adminProcessBlackboxRequest(processingRequest.id, {
				status: processStatus,
				replacement_video_id: processStatus === 'COMPLETED' && replacementVideoId ? Number(replacementVideoId) : null,
				admin_note: processAdminNote.trim() || null
			});
			toast.success('요청이 처리되었습니다.');
			processingRequest = null;
			await loadAll();
		} catch (err) {
			toast.error(formatApiError(err, '요청 처리 실패'));
		}
	}

	function openDeviceCreate() {
		editingDeviceId = null;
		deviceForm = {
			vehicle_no: summary.vehicles[0]?.vehicle_no ?? '',
			manufacturer: '',
			model_name: '',
			channels: '2CH',
			led_count: 2,
			serial_no: '',
			installed_date: getLocalDateNow(),
			status: 'NORMAL',
			notes: ''
		};
		showDeviceModal = true;
	}

	function openDeviceEdit(d: any) {
		editingDeviceId = d.id;
		deviceForm = {
			vehicle_no: d.vehicle_no || '',
			manufacturer: d.manufacturer || '',
			model_name: d.model_name || '',
			channels: d.channels || '2CH',
			led_count: Number(d.led_count ?? 0),
			serial_no: d.serial_no || '',
			installed_date: d.installed_date || '',
			status: d.status || 'NORMAL',
			notes: d.notes || ''
		};
		showDeviceModal = true;
	}

	async function saveDevice(e: Event) {
		e.preventDefault();
		try {
			const payload = {
				vehicle_no: deviceForm.vehicle_no.trim(),
				manufacturer: deviceForm.manufacturer.trim() || null,
				model_name: deviceForm.model_name.trim() || null,
				channels: deviceForm.channels.trim() || null,
				led_count: Number(deviceForm.led_count || 0),
				serial_no: deviceForm.serial_no.trim() || null,
				installed_date: deviceForm.installed_date || null,
				status: deviceForm.status,
				notes: deviceForm.notes.trim() || null
			};
			if (editingDeviceId) {
				await api.adminUpdateBlackboxDevice(editingDeviceId, payload);
				toast.success('본체 정보가 수정되었습니다.');
			} else {
				await api.adminCreateBlackboxDevice(payload);
				toast.success('차량 블랙박스 본체가 등록되었습니다.');
			}
			showDeviceModal = false;
			await loadAll();
		} catch (err) {
			toast.error(formatApiError(err, '본체 저장 실패'));
		}
	}

	async function removeDevice(d: any) {
		if (!confirm(`${d.vehicle_no}호 본체 정보를 삭제하시겠습니까?`)) return;
		try {
			await api.adminDeleteBlackboxDevice(d.id);
			toast.success('삭제되었습니다.');
			await loadAll();
		} catch (err) {
			toast.error(formatApiError(err, '삭제 실패'));
		}
	}

	onMount(() => {
		loadAll();
	});
</script>

<svelte:head>
	<title>{getSiteTitle('블랙박스 비디오 관리')}</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 lg:px-8">
	<!-- 1. 표준 페이지 헤더 & 액션 바 -->
	<div class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4 md:pb-8">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-emerald-400 uppercase">
					<span class="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
					Enterprise Blackbox Governance
				</span>
				<span class="text-xs font-bold text-slate-400">v1/admin/blackbox</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-4xl">
				블랙박스 <span class="not-italic text-blue-600">비디오 관리</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				비디오 장부(고유·0~999 육안번호), 현재 위치(차량/사무실) 추적, 기사 교체 요청 처리, 사용이력 역조회 및 본체 스펙 관리
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<a
				href="/v1/custom/blackbox"
				class="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 shadow-sm transition hover:bg-blue-100"
			>
				<Icon icon="solar:user-hand-up-bold-duotone" class="text-base" />
				<span>기사 요청 화면</span>
			</a>
			<button
				type="button"
				onclick={loadAll}
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

	<!-- 2. 상단 4대 요약 카드 -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-4">
		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400 uppercase">Total Videos</span>
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
					<Icon icon="mdi:sd" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900">
					{summary.active_videos}<span class="ml-1 text-xs font-normal text-slate-500">개 운용</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-slate-400">폐기 {summary.disposed_count}개 포함 총 {summary.total_videos}개</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400 uppercase">Location Split</span>
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
					<Icon icon="mdi:bus-marker" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900">
					{summary.vehicle_count}<span class="ml-1 text-xs font-normal text-slate-500">차량</span>
					<span class="mx-1 text-slate-300">/</span>
					{summary.office_count}<span class="ml-1 text-xs font-normal text-slate-500">사무실</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-emerald-600">차량 · 사무실 실시간 추적</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400 uppercase">Swap Requests</span>
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
					<Icon icon="solar:bell-bing-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black {summary.pending_requests > 0 ? 'text-amber-600' : 'text-slate-900'}">
					{summary.pending_requests}<span class="ml-1 text-xs font-normal text-slate-500">건 대기</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-slate-400">기사 교체 요청</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400 uppercase">Devices</span>
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
					<Icon icon="mdi:cctv" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900">
					{summary.device_count}<span class="ml-1 text-xs font-normal text-slate-500">대</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-slate-400">차량 블랙박스 본체 등록</div>
			</div>
		</div>
	</div>

	<!-- 3. 탭 네비게이션 -->
	<div class="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white p-2 shadow-sm">
		<button
			type="button"
			onclick={() => (activeTab = 'videos')}
			class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition {activeTab === 'videos' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}"
		>
			<Icon icon="mdi:sd" class="text-base" />
			<span>비디오 장부 & 위치</span>
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'requests')}
			class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition {activeTab === 'requests' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}"
		>
			<Icon icon="solar:transfer-horizontal-bold-duotone" class="text-base" />
			<span>기사 교체 요청 ({summary.pending_requests})</span>
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'usages')}
			class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition {activeTab === 'usages' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}"
		>
			<Icon icon="solar:history-bold-duotone" class="text-base" />
			<span>사용이력 역조회</span>
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'devices')}
			class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition {activeTab === 'devices' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}"
		>
			<Icon icon="mdi:cctv" class="text-base" />
			<span>차량 본체 스펙</span>
		</button>
	</div>

	<!-- =================================================================== -->
	<!-- TAB 1: 비디오 장부 & 현재 위치 -->
	<!-- =================================================================== -->
	{#if activeTab === 'videos'}
		<section class="space-y-4 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-xs">
			<div class="flex flex-col justify-between gap-3 md:flex-row md:items-center">
				<div class="flex flex-wrap items-center gap-2">
					<select bind:value={videoLocationFilter} onchange={loadAll} class="select select-bordered select-sm rounded-xl font-bold">
						<option value="">전체 위치 (차량+사무실)</option>
						<option value="VEHICLE">차량 장착 (VEHICLE)</option>
						<option value="OFFICE">사무실 보관 (OFFICE)</option>
					</select>
					<input
						type="text"
						bind:value={videoSearch}
						onkeydown={(e) => e.key === 'Enter' && loadAll()}
						placeholder="관리번호, 육안번호(0~999), 차량번호 검색..."
						class="input input-bordered input-sm w-64 rounded-xl font-medium"
					/>
					<select
						value={`${sortKey}:${sortDir}`}
						onchange={(e) => {
							const [k, d] = e.currentTarget.value.split(':') as any;
							sortKey = k;
							sortDir = d;
						}}
						class="select select-bordered select-sm rounded-xl font-bold"
					>
						<option value="days_elapsed:desc">정렬: 장착 경과일 긴 순</option>
						<option value="days_elapsed:asc">정렬: 장착 경과일 짧은 순</option>
						<option value="display_num:asc">정렬: 육안번호 오름차순</option>
						<option value="display_num:desc">정렬: 육안번호 내림차순</option>
						<option value="location:asc">정렬: 현재 위치(차량번호) 순</option>
						<option value="video_no:asc">정렬: 관리번호 순</option>
					</select>
					<label class="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-600">
						<input type="checkbox" bind:checked={includeDisposed} onchange={loadAll} class="checkbox checkbox-xs" />
						<span>폐기 포함</span>
					</label>
					<button type="button" onclick={loadAll} class="btn btn-sm btn-outline rounded-xl font-bold">검색</button>
				</div>
				<button type="button" onclick={openVideoCreate} class="btn btn-sm rounded-xl border-none bg-blue-600 font-black text-white hover:bg-blue-700">
					<Icon icon="solar:add-circle-bold" class="text-base" />
					비디오 등록
				</button>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs">
					<thead class="border-b border-slate-200 bg-slate-50 font-black text-slate-500">
						<tr>
							<th class="px-3 py-2.5">
								<button type="button" onclick={() => toggleVideoSort('display_num')} class="inline-flex items-center gap-1 hover:text-slate-900">
									육안번호 {#if sortKey === 'display_num'}<span>{sortDir === 'asc' ? '▲' : '▼'}</span>{/if}
								</button>
							</th>
							<th class="px-3 py-2.5">
								<button type="button" onclick={() => toggleVideoSort('video_no')} class="inline-flex items-center gap-1 hover:text-slate-900">
									관리번호 {#if sortKey === 'video_no'}<span>{sortDir === 'asc' ? '▲' : '▼'}</span>{/if}
								</button>
							</th>
							<th class="px-3 py-2.5">
								<button type="button" onclick={() => toggleVideoSort('location')} class="inline-flex items-center gap-1 hover:text-slate-900">
									현재 위치 {#if sortKey === 'location'}<span>{sortDir === 'asc' ? '▲' : '▼'}</span>{/if}
								</button>
							</th>
							<th class="px-3 py-2.5">
								<button type="button" onclick={() => toggleVideoSort('days_elapsed')} class="inline-flex items-center gap-1 hover:text-slate-900">
									장착 경과일 {#if sortKey === 'days_elapsed'}<span>{sortDir === 'asc' ? '▲' : '▼'}</span>{/if}
								</button>
							</th>
							<th class="px-3 py-2.5 text-right">위치 변경 · 관리</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#if sortedVideos.length === 0}
							<tr>
								<td colspan="5" class="py-10 text-center font-bold text-slate-400">등록된 비디오가 없습니다.</td>
							</tr>
						{:else}
							{#each sortedVideos as v (v.id)}
								<tr class="hover:bg-slate-50 {v.is_disposed ? 'opacity-55' : ''}">
									<td class="px-3 py-2.5">
										<button
											type="button"
											onclick={() => (detailTargetVideo = v)}
											title="상세보기"
											class="inline-flex h-8 min-w-9 items-center justify-center rounded-xl bg-slate-900 px-2 font-mono text-sm font-black text-amber-400 transition hover:scale-105"
										>
											{v.display_num}
										</button>
									</td>
									<td class="px-3 py-2.5">
										<button type="button" onclick={() => (detailTargetVideo = v)} class="font-mono font-black text-slate-900 hover:text-blue-600 hover:underline">
											{v.video_no}
										</button>
									</td>
									<td class="px-3 py-2.5">
										{#if v.is_disposed}
											<span class="badge badge-sm badge-error font-bold text-white">폐기됨 ({v.disposal_date})</span>
										{:else if v.location_type === 'VEHICLE'}
											<div class="font-black text-blue-700">{v.current_vehicle_no}호 차량</div>
											<div class="font-mono text-[11px] text-slate-400">장착: {v.mounted_at || '-'}</div>
										{:else}
											<span class="badge badge-sm badge-ghost font-bold">사무실 보관</span>
										{/if}
									</td>
									<td class="px-3 py-2.5">
										{#if !v.is_disposed && v.location_type === 'VEHICLE' && v.days_elapsed !== null && v.days_elapsed !== undefined}
											<span class="inline-flex items-center rounded-lg px-2.5 py-1 font-mono text-xs font-black {v.days_elapsed >= 14 ? 'bg-rose-50 text-rose-700' : v.days_elapsed >= 7 ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}">
												{v.days_elapsed}일째 ({v.days_elapsed === 0 ? '오늘 장착' : `${v.days_elapsed}일 전부터`})
											</span>
										{:else}
											<span class="text-slate-400">-</span>
										{/if}
									</td>
									<td class="px-3 py-2.5 text-right">
										<div class="inline-flex flex-wrap items-center justify-end gap-2">
											<button type="button" onclick={() => (detailTargetVideo = v)} class="text-xs font-bold text-slate-700 hover:underline">
												상세
											</button>
											{#if !v.is_disposed}
												<button type="button" onclick={() => openMountModal(v)} class="text-xs font-black text-blue-600 hover:underline">
													{v.location_type === 'VEHICLE' ? '차량이동' : '차량장착'}
												</button>
												{#if v.location_type === 'VEHICLE'}
													<button type="button" onclick={() => handleUnmount(v)} class="text-xs font-black text-emerald-700 hover:underline">
														사무실회수
													</button>
												{/if}
											{/if}
											<button type="button" onclick={() => openReverseLookupForVideo(v)} class="text-xs font-bold text-indigo-600 hover:underline">
												이력
											</button>
											<button type="button" onclick={() => openVideoEdit(v)} class="text-xs font-bold text-slate-600 hover:underline">
												수정
											</button>
											<button type="button" onclick={() => removeVideo(v)} class="text-xs font-bold text-rose-600 hover:underline">
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
		</section>

	<!-- =================================================================== -->
	<!-- TAB 2: 기사 교체 요청 관제 -->
	<!-- =================================================================== -->
	{:else if activeTab === 'requests'}
		<section class="space-y-4 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-xs">
			<div class="flex items-center justify-between">
				<select bind:value={requestStatusFilter} onchange={loadAll} class="select select-bordered select-sm rounded-xl font-bold">
					<option value="">전체 상태</option>
					<option value="PENDING">대기 중 (PENDING)</option>
					<option value="PREPARING">준비 중 (PREPARING)</option>
					<option value="COMPLETED">교체 완료 (COMPLETED)</option>
					<option value="REJECTED">반려 (REJECTED)</option>
				</select>
				<span class="text-xs font-bold text-slate-400">총 {requests.length}건</span>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs">
					<thead class="border-b border-slate-200 bg-slate-50 font-black text-slate-500">
						<tr>
							<th class="px-3 py-2.5">상태</th>
							<th class="px-3 py-2.5">요청 기사 · 차량</th>
							<th class="px-3 py-2.5">장착 비디오</th>
							<th class="px-3 py-2.5">사유 / 확인일시</th>
							<th class="px-3 py-2.5">교체 처리 결과</th>
							<th class="px-3 py-2.5 text-right">처리</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#if requests.length === 0}
							<tr>
								<td colspan="6" class="py-10 text-center font-bold text-slate-400">교체 요청 내역이 없습니다.</td>
							</tr>
						{:else}
							{#each requests as r (r.id)}
								<tr class="hover:bg-slate-50">
									<td class="px-3 py-2.5">
										<span class="badge badge-sm font-black {r.status === 'COMPLETED' ? 'badge-success text-white' : r.status === 'REJECTED' ? 'badge-error text-white' : r.status === 'PREPARING' ? 'badge-info text-white' : 'badge-warning'}">
											{r.status === 'COMPLETED' ? '교체완료' : r.status === 'REJECTED' ? '반려' : r.status === 'PREPARING' ? '준비중' : '대기'}
										</span>
									</td>
									<td class="px-3 py-2.5">
										<div class="font-black text-slate-900">{r.vehicle_no}호 · {r.requester_name}</div>
										<div class="text-[11px] text-slate-400">{r.created_at}</div>
									</td>
									<td class="px-3 py-2.5 font-mono">
										{r.current_video_no ? `${r.current_video_no} (#${r.current_display_num})` : '-'}
									</td>
									<td class="px-3 py-2.5">
										<div class="font-bold text-slate-800">
											{REASON_LABELS[r.reason_type] || r.reason_type}
											{#if r.incident_date}
												<span class="ml-1 font-mono text-[11px] text-blue-600">(확인일시: {r.incident_date})</span>
											{/if}
										</div>
										<div class="text-[11px] text-slate-500">{r.reason_detail || '-'}</div>
									</td>
									<td class="px-3 py-2.5">
										{#if r.replacement_video_no}
											<div class="font-bold text-emerald-700">투입: {r.replacement_video_no} (#{r.replacement_display_num})</div>
										{/if}
										{#if r.admin_note}
											<div class="text-[11px] text-slate-500">{r.admin_note}</div>
										{/if}
										{#if r.processed_by}
											<div class="text-[11px] text-slate-400">{r.processed_by} · {r.processed_at}</div>
										{/if}
									</td>
									<td class="px-3 py-2.5 text-right">
										{#if r.status === 'PENDING' || r.status === 'PREPARING'}
											<div class="inline-flex items-center justify-end gap-1.5">
												{#if r.status === 'PENDING'}
													<button
														type="button"
														onclick={() => markRequestPreparing(r)}
														class="btn btn-xs rounded-lg border border-sky-200 bg-sky-50 font-black text-sky-700 hover:bg-sky-100"
													>
														준비중
													</button>
												{/if}
												<button
													type="button"
													onclick={() => openProcessModal(r)}
													class="btn btn-xs rounded-lg border-none bg-blue-600 font-black text-white hover:bg-blue-700"
												>
													교체 처리
												</button>
											</div>
										{:else}
											<span class="text-[11px] text-slate-400">완료</span>
										{/if}
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</section>

	<!-- =================================================================== -->
	<!-- TAB 3: 사용이력 양방향 역조회 -->
	<!-- =================================================================== -->
	{:else if activeTab === 'usages'}
		<section class="space-y-4 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-xs">
			<div class="grid grid-cols-1 gap-3 md:grid-cols-5">
				<div>
					<label for="usage-vq" class="mb-1 block text-xs font-black text-slate-600">비디오번호 / 육안번호(0~999)</label>
					<input id="usage-vq" type="text" bind:value={usageVideoQuery} placeholder="예: BB-0001 또는 125" class="input input-bordered input-sm w-full rounded-xl font-bold" />
				</div>
				<div>
					<label for="usage-vno" class="mb-1 block text-xs font-black text-slate-600">차량번호</label>
					<input id="usage-vno" type="text" bind:value={usageVehicleNo} placeholder="예: 1234" class="input input-bordered input-sm w-full rounded-xl font-bold" />
				</div>
				<div>
					<label for="usage-sd" class="mb-1 block text-xs font-black text-slate-600">시작일</label>
					<input id="usage-sd" type="date" bind:value={usageStartDate} class="input input-bordered input-sm w-full rounded-xl font-bold" />
				</div>
				<div>
					<label for="usage-ed" class="mb-1 block text-xs font-black text-slate-600">종료일</label>
					<input id="usage-ed" type="date" bind:value={usageEndDate} class="input input-bordered input-sm w-full rounded-xl font-bold" />
				</div>
				<div class="flex items-end gap-2">
					<button type="button" onclick={searchUsages} class="btn btn-sm flex-1 rounded-xl border-none bg-slate-900 font-black text-white">
						역조회
					</button>
					<button
						type="button"
						onclick={() => {
							usageVideoQuery = '';
							usageVehicleNo = '';
							usageStartDate = '';
							usageEndDate = '';
							searchUsages();
						}}
						class="btn btn-sm btn-outline rounded-xl font-bold"
					>
						초기화
					</button>
				</div>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs">
					<thead class="border-b border-slate-200 bg-slate-50 font-black text-slate-500">
						<tr>
							<th class="px-3 py-2.5">육안번호</th>
							<th class="px-3 py-2.5">비디오 관리번호</th>
							<th class="px-3 py-2.5">차량번호</th>
							<th class="px-3 py-2.5">장착 일시</th>
							<th class="px-3 py-2.5">탈거/종료 일시</th>
							<th class="px-3 py-2.5">비고</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#if usages.length === 0}
							<tr>
								<td colspan="6" class="py-10 text-center font-bold text-slate-400">조건에 해당하는 사용이력이 없습니다.</td>
							</tr>
						{:else}
							{#each usages as u (u.id)}
								<tr class="hover:bg-slate-50">
									<td class="px-3 py-2.5">
										<span class="inline-flex h-7 min-w-8 items-center justify-center rounded-lg bg-slate-900 px-1.5 font-mono text-xs font-black text-amber-400">
											{u.display_num}
										</span>
									</td>
									<td class="px-3 py-2.5 font-mono font-bold text-slate-900">{u.video_no}</td>
									<td class="px-3 py-2.5 font-black text-blue-700">{u.vehicle_no}호</td>
									<td class="px-3 py-2.5 font-mono text-slate-700">{u.started_at}</td>
									<td class="px-3 py-2.5 font-mono">
										{#if u.is_active}
											<span class="badge badge-sm badge-success font-bold text-white">현재 장착중</span>
										{:else}
											{u.ended_at}
										{/if}
									</td>
									<td class="px-3 py-2.5 text-slate-500">{u.notes || '-'}</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</section>

	<!-- =================================================================== -->
	<!-- TAB 4: 차량 블랙박스 본체 스펙 -->
	<!-- =================================================================== -->
	{:else}
		<section class="space-y-4 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-xs">
			<div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
				<div class="flex items-center gap-2">
					<input
						type="text"
						bind:value={deviceSearch}
						onkeydown={(e) => e.key === 'Enter' && loadAll()}
						placeholder="차량번호, 제조사, 모델명 검색..."
						class="input input-bordered input-sm w-64 rounded-xl font-medium"
					/>
					<button type="button" onclick={loadAll} class="btn btn-sm btn-outline rounded-xl font-bold">검색</button>
				</div>
				<button type="button" onclick={openDeviceCreate} class="btn btn-sm rounded-xl border-none bg-blue-600 font-black text-white hover:bg-blue-700">
					<Icon icon="solar:add-circle-bold" class="text-base" />
					차량 본체 등록
				</button>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs">
					<thead class="border-b border-slate-200 bg-slate-50 font-black text-slate-500">
						<tr>
							<th class="px-3 py-2.5">차량번호</th>
							<th class="px-3 py-2.5">제조사 · 모델명</th>
							<th class="px-3 py-2.5">채널</th>
							<th class="px-3 py-2.5">LED 개수</th>
							<th class="px-3 py-2.5">설치일 / 상태</th>
							<th class="px-3 py-2.5">비고</th>
							<th class="px-3 py-2.5 text-right">관리</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#if devices.length === 0}
							<tr>
								<td colspan="7" class="py-10 text-center font-bold text-slate-400">등록된 블랙박스 본체가 없습니다.</td>
							</tr>
						{:else}
							{#each devices as d (d.id)}
								<tr class="hover:bg-slate-50">
									<td class="px-3 py-2.5 font-black text-slate-900">{d.vehicle_no}호</td>
									<td class="px-3 py-2.5">
										<div class="font-bold">{d.manufacturer || '-'} {d.model_name || ''}</div>
										{#if d.serial_no}
											<div class="font-mono text-[11px] text-slate-400">S/N: {d.serial_no}</div>
										{/if}
									</td>
									<td class="px-3 py-2.5 font-bold">{d.channels || '-'}</td>
									<td class="px-3 py-2.5 font-mono font-black text-blue-700">{d.led_count}개</td>
									<td class="px-3 py-2.5">
										<span class="badge badge-xs font-bold {d.status === 'NORMAL' ? 'badge-success text-white' : 'badge-warning'}">{d.status}</span>
										<div class="mt-0.5 font-mono text-[11px] text-slate-400">{d.installed_date || '-'}</div>
									</td>
									<td class="px-3 py-2.5 text-slate-500">{d.notes || '-'}</td>
									<td class="px-3 py-2.5 text-right">
										<div class="inline-flex gap-3">
											<button type="button" onclick={() => openDeviceEdit(d)} class="text-xs font-bold text-blue-600 hover:underline">수정</button>
											<button type="button" onclick={() => removeDevice(d)} class="text-xs font-bold text-rose-600 hover:underline">삭제</button>
										</div>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>

<!-- 모달 1: 비디오 등록/수정 -->
{#if showVideoModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
		<form onsubmit={saveVideo} class="w-full max-w-lg space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
			<div class="flex items-center justify-between border-b border-slate-200 pb-3">
				<h3 class="text-base font-black text-slate-900">{editingVideoId ? '비디오 정보 수정' : '신규 비디오 등록'}</h3>
				<button type="button" onclick={() => (showVideoModal = false)} class="btn btn-circle btn-ghost btn-xs">✕</button>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div>
					<label for="vf-disp" class="mb-1 block text-xs font-black text-slate-600">육안번호 (0~999, 중복불가)</label>
					<input id="vf-disp" type="text" inputmode="numeric" maxlength="3" required bind:value={videoForm.display_num} placeholder="예: 0~999" class="input input-bordered input-sm w-full rounded-xl font-mono font-black" />
				</div>
				<div>
					<label for="vf-vno" class="mb-1 block text-xs font-black text-slate-600">관리번호 (비우면 자동부여)</label>
					<input id="vf-vno" type="text" bind:value={videoForm.video_no} placeholder="예: BB-0001" class="input input-bordered input-sm w-full rounded-xl font-mono font-bold" />
				</div>
				<div>
					<label for="vf-mfr" class="mb-1 block text-xs font-black text-slate-600">제조사</label>
					<input id="vf-mfr" type="text" bind:value={videoForm.manufacturer} placeholder="예: 삼성전자 / 샌디스크" class="input input-bordered input-sm w-full rounded-xl" />
				</div>
				<div>
					<label for="vf-spec" class="mb-1 block text-xs font-black text-slate-600">스펙</label>
					<input id="vf-spec" type="text" bind:value={videoForm.spec} placeholder="예: 128GB MLC PRO Endurance" class="input input-bordered input-sm w-full rounded-xl" />
				</div>
				<div>
					<label for="vf-pdate" class="mb-1 block text-xs font-black text-slate-600">구매일</label>
					<input id="vf-pdate" type="date" bind:value={videoForm.purchase_date} class="input input-bordered input-sm w-full rounded-xl" />
				</div>
				<div>
					<label for="vf-ddate" class="mb-1 block text-xs font-black text-slate-600">폐기일 (운용중이면 공란)</label>
					<input id="vf-ddate" type="date" bind:value={videoForm.disposal_date} class="input input-bordered input-sm w-full rounded-xl" />
				</div>
			</div>

			{#if !editingVideoId}
				<div class="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
					<div>
						<label for="vf-loc" class="mb-1 block text-xs font-black text-slate-600">초기 위치</label>
						<select id="vf-loc" bind:value={videoForm.location_type} class="select select-bordered select-sm w-full rounded-xl font-bold">
							<option value="OFFICE">사무실 (OFFICE)</option>
							<option value="VEHICLE">차량 (VEHICLE)</option>
						</select>
					</div>
					{#if videoForm.location_type === 'VEHICLE'}
						<div>
							<label for="vf-cvno" class="mb-1 block text-xs font-black text-slate-600">장착 차량번호</label>
							<input id="vf-cvno" type="text" required bind:value={videoForm.current_vehicle_no} placeholder="예: 1234" class="input input-bordered input-sm w-full rounded-xl font-bold" />
						</div>
					{/if}
				</div>
			{/if}

			<div>
				<label for="vf-notes" class="mb-1 block text-xs font-black text-slate-600">비고</label>
				<input id="vf-notes" type="text" bind:value={videoForm.notes} class="input input-bordered input-sm w-full rounded-xl" />
			</div>

			<div class="flex justify-end gap-2 pt-2">
				<button type="button" onclick={() => (showVideoModal = false)} class="btn btn-sm btn-ghost rounded-xl font-bold">취소</button>
				<button type="submit" class="btn btn-sm rounded-xl border-none bg-blue-600 px-5 font-black text-white">저장</button>
			</div>
		</form>
	</div>
{/if}

<!-- 모달 2: 차량 장착/이동 -->
{#if mountTargetVideo}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
		<form onsubmit={confirmMount} class="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
			<div class="flex items-center justify-between border-b border-slate-200 pb-3">
				<h3 class="text-base font-black text-slate-900">
					비디오 장착 · 이동 ({mountTargetVideo.video_no} #{mountTargetVideo.display_num})
				</h3>
				<button type="button" onclick={() => (mountTargetVideo = null)} class="btn btn-circle btn-ghost btn-xs">✕</button>
			</div>
			<div>
				<label for="mf-vno" class="mb-1 block text-xs font-black text-slate-600">대상 차량번호</label>
				<input id="mf-vno" type="text" required bind:value={mountVehicleNo} placeholder="예: 1234" list="vehicle-pool-list" class="input input-bordered input-sm w-full rounded-xl font-bold" />
				<datalist id="vehicle-pool-list">
					{#each summary.vehicles as v}
						<option value={v.vehicle_no}>{v.vehicle_no} ({v.route})</option>
					{/each}
				</datalist>
			</div>
			<div>
				<label for="mf-dt" class="mb-1 block text-xs font-black text-slate-600">장착 일시 (비우면 현재 시각)</label>
				<input id="mf-dt" type="datetime-local" bind:value={mountDateTime} class="input input-bordered input-sm w-full rounded-xl" />
			</div>
			<div>
				<label for="mf-note" class="mb-1 block text-xs font-black text-slate-600">작업 메모</label>
				<input id="mf-note" type="text" bind:value={mountNotes} placeholder="예: 정기 교체 장착" class="input input-bordered input-sm w-full rounded-xl" />
			</div>
			<p class="text-[11px] font-medium text-slate-500">
				※ 해당 차량에 기존 장착된 비디오가 있으면 자동으로 사무실 회수 및 사용이력 종료 처리됩니다.
			</p>
			<div class="flex justify-end gap-2">
				<button type="button" onclick={() => (mountTargetVideo = null)} class="btn btn-sm btn-ghost rounded-xl font-bold">취소</button>
				<button type="submit" class="btn btn-sm rounded-xl border-none bg-blue-600 px-5 font-black text-white">장착 확정</button>
			</div>
		</form>
	</div>
{/if}

<!-- 모달 3: 기사 교체 요청 처리 -->
{#if processingRequest}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
		<form onsubmit={confirmProcessRequest} class="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
			<div class="flex items-center justify-between border-b border-slate-200 pb-3">
				<h3 class="text-base font-black text-slate-900">교체 요청 처리 ({processingRequest.vehicle_no}호)</h3>
				<button type="button" onclick={() => (processingRequest = null)} class="btn btn-circle btn-ghost btn-xs">✕</button>
			</div>
			<div>
				<label for="pr-status" class="mb-1 block text-xs font-black text-slate-600">처리 결과</label>
				<select id="pr-status" bind:value={processStatus} class="select select-bordered select-sm w-full rounded-xl font-bold">
					<option value="PREPARING">준비 중 · 사무실 확인 (PREPARING)</option>
					<option value="COMPLETED">교체 완료 (COMPLETED)</option>
					<option value="REJECTED">반려 (REJECTED)</option>
				</select>
			</div>
			{#if processStatus === 'COMPLETED'}
				<div>
					<label for="pr-vid" class="mb-1 block text-xs font-black text-slate-600">투입할 새 비디오 (사무실 보관 목록)</label>
					<select id="pr-vid" bind:value={replacementVideoId} class="select select-bordered select-sm w-full rounded-xl font-bold">
						<option value="">-- 비디오 미지정(단순 완료) --</option>
						{#each officeVideos as ov (ov.id)}
							<option value={String(ov.id)}>#{ov.display_num} · {ov.video_no} ({ov.spec || '스펙미상'})</option>
						{/each}
					</select>
				</div>
			{/if}
			<div>
				<label for="pr-note" class="mb-1 block text-xs font-black text-slate-600">관리자 메모</label>
				<input id="pr-note" type="text" bind:value={processAdminNote} placeholder="예: 사무실에서 확인 후 #07로 교체 완료" class="input input-bordered input-sm w-full rounded-xl" />
			</div>
			<div class="flex justify-end gap-2">
				<button type="button" onclick={() => (processingRequest = null)} class="btn btn-sm btn-ghost rounded-xl font-bold">취소</button>
				<button type="submit" class="btn btn-sm rounded-xl border-none bg-blue-600 px-5 font-black text-white">처리 확정</button>
			</div>
		</form>
	</div>
{/if}

<!-- 모달 4: 차량 본체 등록/수정 -->
{#if showDeviceModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
		<form onsubmit={saveDevice} class="w-full max-w-lg space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
			<div class="flex items-center justify-between border-b border-slate-200 pb-3">
				<h3 class="text-base font-black text-slate-900">{editingDeviceId ? '본체 정보 수정' : '차량 블랙박스 본체 등록'}</h3>
				<button type="button" onclick={() => (showDeviceModal = false)} class="btn btn-circle btn-ghost btn-xs">✕</button>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label for="df-vno" class="mb-1 block text-xs font-black text-slate-600">차량번호</label>
					<input id="df-vno" type="text" required bind:value={deviceForm.vehicle_no} list="vehicle-pool-list" placeholder="예: 1234" class="input input-bordered input-sm w-full rounded-xl font-bold" />
				</div>
				<div>
					<label for="df-status" class="mb-1 block text-xs font-black text-slate-600">장비 상태</label>
					<select id="df-status" bind:value={deviceForm.status} class="select select-bordered select-sm w-full rounded-xl font-bold">
						<option value="NORMAL">정상 (NORMAL)</option>
						<option value="REPAIR">점검/수리 (REPAIR)</option>
						<option value="REPLACED">교체됨 (REPLACED)</option>
					</select>
				</div>
				<div>
					<label for="df-mfr" class="mb-1 block text-xs font-black text-slate-600">제조사</label>
					<input id="df-mfr" type="text" bind:value={deviceForm.manufacturer} placeholder="예: 아이나비 / 파인뷰" class="input input-bordered input-sm w-full rounded-xl" />
				</div>
				<div>
					<label for="df-model" class="mb-1 block text-xs font-black text-slate-600">모델명</label>
					<input id="df-model" type="text" bind:value={deviceForm.model_name} placeholder="예: QXD8000" class="input input-bordered input-sm w-full rounded-xl" />
				</div>
				<div>
					<label for="df-ch" class="mb-1 block text-xs font-black text-slate-600">채널 수</label>
					<input id="df-ch" type="text" bind:value={deviceForm.channels} placeholder="예: 2CH / 4CH" class="input input-bordered input-sm w-full rounded-xl" />
				</div>
				<div>
					<label for="df-led" class="mb-1 block text-xs font-black text-slate-600">LED 개수 (`led_count`)</label>
					<input id="df-led" type="number" min="0" max="99" required bind:value={deviceForm.led_count} class="input input-bordered input-sm w-full rounded-xl font-mono font-bold" />
				</div>
				<div>
					<label for="df-sn" class="mb-1 block text-xs font-black text-slate-600">시리얼번호</label>
					<input id="df-sn" type="text" bind:value={deviceForm.serial_no} class="input input-bordered input-sm w-full rounded-xl" />
				</div>
				<div>
					<label for="df-idate" class="mb-1 block text-xs font-black text-slate-600">설치일</label>
					<input id="df-idate" type="date" bind:value={deviceForm.installed_date} class="input input-bordered input-sm w-full rounded-xl" />
				</div>
			</div>
			<div>
				<label for="df-notes" class="mb-1 block text-xs font-black text-slate-600">비고</label>
				<input id="df-notes" type="text" bind:value={deviceForm.notes} class="input input-bordered input-sm w-full rounded-xl" />
			</div>
			<div class="flex justify-end gap-2 pt-2">
				<button type="button" onclick={() => (showDeviceModal = false)} class="btn btn-sm btn-ghost rounded-xl font-bold">취소</button>
				<button type="submit" class="btn btn-sm rounded-xl border-none bg-blue-600 px-5 font-black text-white">저장</button>
			</div>
		</form>
	</div>
{/if}

<!-- 모달 5: 비디오 상세보기 (제조사, 스펙, 구매일, 폐기일, 시리얼 등) -->
{#if detailTargetVideo}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
		<div class="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
			<div class="flex items-center justify-between border-b border-slate-200 pb-3">
				<div class="flex items-center gap-2.5">
					<span class="inline-flex h-9 min-w-10 items-center justify-center rounded-xl bg-slate-900 px-2 font-mono text-base font-black text-amber-400">
						{detailTargetVideo.display_num}
					</span>
					<div>
						<h3 class="text-base font-black text-slate-900">{detailTargetVideo.video_no} 상세 정보</h3>
						<p class="text-[11px] font-bold text-slate-500">{detailTargetVideo.location_label}</p>
					</div>
				</div>
				<button type="button" onclick={() => (detailTargetVideo = null)} class="btn btn-circle btn-ghost btn-xs">✕</button>
			</div>

			<dl class="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs">
				<div>
					<dt class="font-bold text-slate-400">현재 위치</dt>
					<dd class="mt-0.5 font-black text-slate-900">{detailTargetVideo.location_label}</dd>
				</div>
				<div>
					<dt class="font-bold text-slate-400">장착 일시</dt>
					<dd class="mt-0.5 font-mono font-bold text-slate-700">{detailTargetVideo.mounted_at || '-'}</dd>
				</div>
				<div>
					<dt class="font-bold text-slate-400">제조사</dt>
					<dd class="mt-0.5 font-bold text-slate-800">{detailTargetVideo.manufacturer || '-'}</dd>
				</div>
				<div>
					<dt class="font-bold text-slate-400">스펙</dt>
					<dd class="mt-0.5 font-bold text-slate-800">{detailTargetVideo.spec || '-'}</dd>
				</div>
				<div>
					<dt class="font-bold text-slate-400">구매일</dt>
					<dd class="mt-0.5 font-mono font-bold text-slate-700">{detailTargetVideo.purchase_date || '-'}</dd>
				</div>
				<div>
					<dt class="font-bold text-slate-400">폐기일</dt>
					<dd class="mt-0.5 font-mono font-bold {detailTargetVideo.disposal_date ? 'text-rose-600' : 'text-slate-700'}">
						{detailTargetVideo.disposal_date || '-'}
					</dd>
				</div>
				<div>
					<dt class="font-bold text-slate-400">시리얼번호</dt>
					<dd class="mt-0.5 font-mono text-slate-700">{detailTargetVideo.serial_no || '-'}</dd>
				</div>
				<div>
					<dt class="font-bold text-slate-400">등록일시</dt>
					<dd class="mt-0.5 font-mono text-slate-700">{detailTargetVideo.created_at || '-'}</dd>
				</div>
				<div class="col-span-2">
					<dt class="font-bold text-slate-400">비고</dt>
					<dd class="mt-0.5 text-slate-700">{detailTargetVideo.notes || '-'}</dd>
				</div>
			</dl>

			<div class="flex justify-end gap-2">
				<button
					type="button"
					onclick={() => {
						const v = detailTargetVideo;
						detailTargetVideo = null;
						openReverseLookupForVideo(v);
					}}
					class="btn btn-sm btn-outline rounded-xl font-bold"
				>
					사용이력 보기
				</button>
				<button
					type="button"
					onclick={() => {
						const v = detailTargetVideo;
						detailTargetVideo = null;
						openVideoEdit(v);
					}}
					class="btn btn-sm rounded-xl border-none bg-blue-600 font-black text-white"
				>
					정보 수정
				</button>
			</div>
		</div>
	</div>
{/if}

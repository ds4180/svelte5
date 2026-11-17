<script lang="ts">
	/**
	 * @file (app)/v1/custom/blackbox/+page.svelte
	 * @description 운전기사/현장용 블랙박스 비디오 위치 확인 및 교체 요청 페이지
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/blackbox';
	import { getSiteTitle } from '$lib/config/site';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatApiError } from '$lib/utils/error';
	import Icon from '@iconify/svelte';

	let loading = $state(true);
	let submitting = $state(false);

	let vehicles = $state<Array<{ vehicle_no: string; route: string }>>([]);
	let deviceByVehicle = $state<Record<string, any>>({});
	let videoByVehicle = $state<Record<string, any>>({});
	let myRequests = $state<any[]>([]);

	function getLocalDateTimeNow(): string {
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	let selectedVehicleNo = $state('');
	let reasonType = $state('CHECK');
	let incidentDate = $state(getLocalDateTimeNow());
	let reasonDetail = $state('');

	let currentVideo = $derived(selectedVehicleNo ? (videoByVehicle[selectedVehicleNo] ?? null) : null);
	let currentDevice = $derived(selectedVehicleNo ? (deviceByVehicle[selectedVehicleNo] ?? null) : null);

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
			const [statusRes, reqRes] = await Promise.all([
				api.getDriverBlackboxStatus(),
				api.getMyBlackboxRequests()
			]);
			vehicles = statusRes?.vehicles || [];
			deviceByVehicle = statusRes?.device_by_vehicle || {};
			videoByVehicle = statusRes?.video_by_vehicle || {};
			myRequests = reqRes?.requests || [];
			if (!selectedVehicleNo && vehicles.length > 0) {
				selectedVehicleNo = vehicles[0].vehicle_no;
			}
		} catch (e) {
			toast.error(formatApiError(e, '블랙박스 정보를 불러오지 못했습니다.'));
		} finally {
			loading = false;
		}
	}

	async function handleSubmitRequest(e: Event) {
		e.preventDefault();
		if (!selectedVehicleNo.trim()) {
			toast.warning('차량번호를 선택하거나 입력해 주세요.');
			return;
		}
		submitting = true;
		try {
			await api.createBlackboxRequest({
				vehicle_no: selectedVehicleNo.trim(),
				reason_type: reasonType,
				incident_date: incidentDate || null,
				reason_detail: reasonDetail.trim() || null
			});
			toast.success('사무실에 비디오 교체 요청이 접수되었습니다.');
			reasonDetail = '';
			incidentDate = getLocalDateTimeNow();
			await loadAll();
		} catch (err) {
			toast.error(formatApiError(err, '교체 요청 접수에 실패했습니다.'));
		} finally {
			submitting = false;
		}
	}

	onMount(() => {
		loadAll();
	});
</script>

<svelte:head>
	<title>{getSiteTitle('블랙박스 비디오 관리')}</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6 px-4 py-6 pb-24 font-['Noto_Sans_KR','Outfit',sans-serif]">
	<!-- 상단 헤더 -->
	<div class="flex flex-col justify-between gap-3 border-b-2 border-slate-900 pb-5 sm:flex-row sm:items-end">
		<div>
			<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-emerald-400 uppercase">
				<Icon icon="mdi:video-box" class="text-sm" />
				Blackbox Field Desk
			</span>
			<h1 class="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">블랙박스 비디오 교체 요청</h1>
			<p class="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
				차량에 장착된 현재 비디오 식별번호와 본체 정보를 확인하고 사무실에 교체를 요청합니다.
			</p>
		</div>
		<button
			type="button"
			onclick={loadAll}
			disabled={loading}
			class="btn btn-outline btn-sm rounded-xl font-bold"
		>
			<Icon icon="solar:restart-bold" class="text-base {loading ? 'animate-spin' : ''}" />
			새로고침
		</button>
	</div>

	<!-- 차량 선택 & 현재 상태 카드 -->
	<section class="space-y-4 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-xs">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
			<div class="flex-1">
				<label for="driver-vehicle-select" class="mb-1 block text-xs font-black text-slate-600">차량 선택</label>
				<select
					id="driver-vehicle-select"
					bind:value={selectedVehicleNo}
					class="select select-bordered w-full rounded-xl font-bold"
				>
					{#each vehicles as v (v.vehicle_no)}
						<option value={v.vehicle_no}>{v.vehicle_no}호 ({v.route})</option>
					{/each}
				</select>
			</div>
			<div class="sm:w-44">
				<label for="driver-vehicle-manual" class="mb-1 block text-xs font-black text-slate-600">직접 입력</label>
				<input
					id="driver-vehicle-manual"
					type="text"
					bind:value={selectedVehicleNo}
					placeholder="예: 1234"
					class="input input-bordered w-full rounded-xl font-bold"
				/>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<!-- 현재 장착 비디오 -->
			<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
				<div class="text-[11px] font-black tracking-wider text-slate-400 uppercase">현재 장착 비디오</div>
				{#if currentVideo}
					<div class="mt-2 flex items-center gap-3">
						<span class="flex h-12 min-w-12 items-center justify-center rounded-2xl bg-slate-900 px-2 font-mono text-xl font-black text-amber-400">
							{currentVideo.display_num}
						</span>
						<div>
							<div class="text-sm font-black text-slate-900">
								{currentVideo.video_no}
								<span class="ml-1 text-xs font-bold text-blue-600">#{currentVideo.display_num}</span>
							</div>
							<div class="text-xs font-bold text-emerald-700">{currentVideo.location_label}</div>
							{#if currentVideo.mounted_at}
								<div class="font-mono text-[11px] font-semibold text-slate-600">장착일시: {currentVideo.mounted_at}</div>
							{/if}
							<div class="text-[11px] text-slate-500">
								{[currentVideo.manufacturer, currentVideo.spec].filter(Boolean).join(' · ') || '스펙 미입력'}
							</div>
						</div>
					</div>
				{:else}
					<div class="mt-3 text-xs font-bold text-slate-400">
						해당 차량에 등록·장착된 비디오 정보가 없습니다.
					</div>
				{/if}
			</div>

			<!-- 차량 블랙박스 본체 정보 -->
			<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
				<div class="text-[11px] font-black tracking-wider text-slate-400 uppercase">설치된 블랙박스 본체</div>
				{#if currentDevice}
					<div class="mt-2 space-y-1 text-xs">
						<div class="font-black text-slate-900">
							{[currentDevice.manufacturer, currentDevice.model_name].filter(Boolean).join(' ') || '모델 미입력'}
						</div>
						<div class="flex flex-wrap gap-2 text-slate-600">
							<span class="badge badge-sm badge-outline font-bold">채널: {currentDevice.channels || '-'}</span>
							<span class="badge badge-sm badge-outline font-bold">LED: {currentDevice.led_count}개</span>
							<span class="badge badge-sm font-bold {currentDevice.status === 'NORMAL' ? 'badge-success text-white' : 'badge-warning'}">
								{currentDevice.status}
							</span>
						</div>
						{#if currentDevice.notes}
							<p class="text-[11px] text-slate-500">{currentDevice.notes}</p>
						{/if}
					</div>
				{:else}
					<div class="mt-3 text-xs font-bold text-slate-400">
						등록된 본체 스펙 정보가 없습니다.
					</div>
				{/if}
			</div>
		</div>
	</section>

	<!-- 교체 요청 폼 -->
	<form onsubmit={handleSubmitRequest} class="space-y-4 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-xs">
		<h2 class="flex items-center gap-2 text-base font-black text-slate-900">
			<Icon icon="solar:transfer-horizontal-bold-duotone" class="text-lg text-blue-600" />
			사무실 비디오 교체 요청하기
		</h2>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div>
				<label for="req-reason-type" class="mb-1 block text-xs font-black text-slate-600">요청 사유</label>
				<select id="req-reason-type" bind:value={reasonType} class="select select-bordered w-full rounded-xl font-bold">
					{#each Object.entries(REASON_LABELS) as [code, label]}
						<option value={code}>{label}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="req-incident-date" class="mb-1 block text-xs font-black text-slate-600">확인 필요 일시 (연·월·일·시간, 선택)</label>
				<input
					id="req-incident-date"
					type="datetime-local"
					bind:value={incidentDate}
					class="input input-bordered w-full rounded-xl font-mono font-bold"
				/>
			</div>
		</div>

		<div>
			<label for="req-detail" class="mb-1 block text-xs font-black text-slate-600">상세 사유 / 요청 사항</label>
			<textarea
				id="req-detail"
				rows="3"
				bind:value={reasonDetail}
				placeholder="예: 11/16 오후 접촉사고 영상 확인을 위해 비디오 교체 요청합니다."
				class="textarea textarea-bordered w-full rounded-xl font-medium"
			></textarea>
		</div>

		<div class="flex justify-end">
			<button
				type="submit"
				disabled={submitting}
				class="btn rounded-xl border-none bg-blue-600 px-6 font-black text-white hover:bg-blue-700"
			>
				{#if submitting}
					<span class="loading loading-xs loading-spinner"></span>
				{/if}
				교체 요청 접수
			</button>
		</div>
	</form>

	<!-- 내 요청 내역 -->
	<section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
		<h2 class="mb-3 text-sm font-black text-slate-900">내 교체 요청 내역 ({myRequests.length}건)</h2>
		{#if myRequests.length === 0}
			<div class="py-8 text-center text-xs font-bold text-slate-400">아직 접수한 요청이 없습니다.</div>
		{:else}
			<div class="space-y-2.5">
				{#each myRequests as r (r.id)}
					<div class="flex flex-col justify-between gap-2 rounded-2xl border border-slate-200 p-3.5 sm:flex-row sm:items-center">
						<div class="space-y-1">
							<div class="flex flex-wrap items-center gap-2">
								<span class="badge badge-sm font-black {r.status === 'COMPLETED' ? 'badge-success text-white' : r.status === 'REJECTED' ? 'badge-error text-white' : 'badge-warning'}">
									{r.status === 'COMPLETED' ? '교체 완료' : r.status === 'REJECTED' ? '반려' : '대기 중'}
								</span>
								<span class="text-xs font-black text-slate-900">{r.vehicle_no}호</span>
								<span class="text-xs font-bold text-slate-500">{REASON_LABELS[r.reason_type] || r.reason_type}</span>
								{#if r.incident_date}
									<span class="font-mono text-[11px] font-semibold text-blue-600">확인일시: {r.incident_date}</span>
								{/if}
							</div>
							{#if r.reason_detail}
								<p class="text-xs text-slate-600">{r.reason_detail}</p>
							{/if}
							{#if r.status === 'COMPLETED' && r.replacement_video_no}
								<p class="text-xs font-bold text-emerald-700">
									투입 비디오: {r.replacement_video_no} (#{r.replacement_display_num})
									{#if r.admin_note}· {r.admin_note}{/if}
								</p>
							{:else if r.admin_note}
								<p class="text-xs text-slate-500">관리자 메모: {r.admin_note}</p>
							{/if}
						</div>
						<div class="text-right text-[11px] font-medium text-slate-400">
							<div>접수: {r.created_at}</div>
							{#if r.processed_at}
								<div>처리: {r.processed_at}</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

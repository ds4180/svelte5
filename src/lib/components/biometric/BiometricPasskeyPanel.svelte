<script lang="ts">
	/**
	 * @file BiometricPasskeyPanel.svelte
	 * @description WebAuthn(Passkey) 지문·생체인증 기기 등록, 검증, 별명 수정, 삭제(해지) 및 최근 이력 관리 공용 패널
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import {
		browserSupportsWebAuthn,
		platformAuthenticatorIsAvailable,
		startAuthentication,
		startRegistration
	} from '@simplewebauthn/browser';
	import Icon from '@iconify/svelte';
	import { fastApi } from '$lib/api';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatDateTime } from '$lib/utils';

	interface PasskeyItem {
		id: number;
		credential_id: string;
		device_name: string;
		transports?: string[];
		sign_count?: number;
		created_at?: string;
		last_used_at?: string | null;
	}

	interface BiometricLogItem {
		id: number;
		action: string;
		status: string;
		device_name?: string | null;
		detail?: string | null;
		created_at: string;
	}

	interface Props {
		/** 전용 페이지 링크 노출 여부 (프로필 탭 내부에서는 true, 전용 페이지에서는 false) */
		showStandaloneLink?: boolean;
		standaloneHref?: string;
	}

	let { showStandaloneLink = true, standaloneHref = '/v1/pages/profile/biometric' }: Props =
		$props();

	const auth = getAuthContext();
	let user = $derived(auth.user ?? null);

	let webauthnSupported = $state(false);
	let platformAvailable = $state(false);
	let sensorStatusText = $state('확인 중...');

	let loading = $state(true);
	let busy = $state(false);
	let rpId = $state('-');
	let passkeys = $state<PasskeyItem[]>([]);
	let logs = $state<BiometricLogItem[]>([]);

	let newDeviceName = $state('');
	let editingPasskeyId = $state<number | null>(null);
	let editingDeviceName = $state('');
	let statusBanner = $state('');

	function getDefaultDeviceLabel(): string {
		if (!browser) return '내 보안 기기';
		const ua = navigator.userAgent || '';
		if (/Android/i.test(ua)) return 'Android 스마트폰';
		if (/iPhone|iPad/i.test(ua)) return 'Apple iOS 기기';
		if (/Mac/i.test(ua)) return 'MacBook / Touch ID';
		if (/Windows/i.test(ua)) return 'Windows Hello PC';
		return '내 생체인증 기기';
	}

	async function checkSensorSupport() {
		if (!browser) return;
		webauthnSupported = browserSupportsWebAuthn();
		if (!webauthnSupported) {
			platformAvailable = false;
			sensorStatusText = 'WebAuthn 미지원 브라우저 (HTTPS 환경 필요)';
			return;
		}
		try {
			platformAvailable = await platformAuthenticatorIsAvailable();
			sensorStatusText = platformAvailable
				? '지문 · Face ID · 화면잠금 센서 사용 가능'
				: '내장 생체 센서 미감지 (외부 보안키 또는 모바일 등록 권장)';
		} catch {
			platformAvailable = false;
			sensorStatusText = '센서 지원 여부 확인 불가';
		}
	}

	async function loadBiometricState() {
		if (!user) {
			loading = false;
			return;
		}
		loading = true;
		try {
			const res = await fastApi<{
				rp_id?: string;
				passkeys?: PasskeyItem[];
				logs?: BiometricLogItem[];
			}>('GET', '/api/v1/biometric/passkeys', {}, { offline: false });
			if (res) {
				rpId = res.rp_id || '-';
				passkeys = Array.isArray(res.passkeys) ? res.passkeys : [];
				logs = Array.isArray(res.logs) ? res.logs : [];
			}
		} catch (e: any) {
			toast.error(e?.detail || e?.message || '지문 등록 정보를 불러오지 못했습니다.');
		} finally {
			loading = false;
		}
	}

	async function handleRegisterPasskey() {
		if (busy) return;
		if (!webauthnSupported) {
			toast.error('이 브라우저에서는 WebAuthn 생체인증을 지원하지 않습니다.');
			return;
		}
		busy = true;
		try {
			const optionsJSON = await fastApi<any>(
				'POST',
				'/api/v1/biometric/register/options',
				{},
				{ offline: false }
			);
			const credential = await startRegistration({ optionsJSON });
			const deviceName = newDeviceName.trim() || getDefaultDeviceLabel();
			const result = await fastApi<{ verified?: boolean }>(
				'POST',
				'/api/v1/biometric/register/verify',
				{ credential, device_name: deviceName },
				{ offline: false }
			);
			if (result?.verified) {
				toast.success(`'${deviceName}' 지문 보안 열쇠가 등록되었습니다.`);
				statusBanner = `'${deviceName}' 기기가 서버 DB(${rpId})에 안전하게 등록되었습니다.`;
				newDeviceName = '';
				await loadBiometricState();
			}
		} catch (err: any) {
			if (err?.name === 'NotAllowedError') {
				toast.warning('지문 등록이 취소되었거나 시간이 초과되었습니다.');
			} else if (err?.name === 'InvalidStateError') {
				toast.info('이미 이 기기가 현재 계정에 등록되어 있습니다.');
			} else {
				toast.error(err?.detail || err?.message || '지문 등록 중 오류가 발생했습니다.');
			}
		} finally {
			busy = false;
		}
	}

	async function handleVerifyPasskey() {
		if (busy) return;
		if (passkeys.length === 0) {
			toast.warning('먼저 지문 기기를 1개 이상 등록해 주세요.');
			return;
		}
		busy = true;
		try {
			const optionsJSON = await fastApi<any>(
				'POST',
				'/api/v1/biometric/authenticate/options',
				{},
				{ offline: false }
			);
			const credential = await startAuthentication({ optionsJSON });
			const res = await fastApi<{
				verified?: boolean;
				device_name?: string;
				sign_count?: number;
			}>(
				'POST',
				'/api/v1/biometric/authenticate/verify',
				{ credential, action: 'VERIFY', detail: '프로필 보안설정 지문 테스트' },
				{ offline: false }
			);
			if (res?.verified) {
				statusBanner = `[${res.device_name}] 공개키 지문 서명 검증 통과 (누적 ${res.sign_count}회)`;
				toast.success(`'${res.device_name}' 지문 인증에 성공했습니다.`);
				await loadBiometricState();
			}
		} catch (err: any) {
			if (err?.name === 'NotAllowedError') {
				toast.warning('지문 인증이 취소되었습니다.');
			} else {
				toast.error(err?.detail || err?.message || '지문 검증에 실패했습니다.');
			}
		} finally {
			busy = false;
		}
	}

	function startEditName(pk: PasskeyItem) {
		editingPasskeyId = pk.id;
		editingDeviceName = pk.device_name;
	}

	async function saveDeviceName(passkeyId: number) {
		const trimmed = editingDeviceName.trim();
		if (!trimmed) {
			toast.warning('기기 이름을 입력해 주세요.');
			return;
		}
		try {
			await fastApi(
				'PATCH',
				`/api/v1/biometric/passkeys/${passkeyId}`,
				{ device_name: trimmed },
				{ offline: false }
			);
			editingPasskeyId = null;
			toast.success('기기 이름이 변경되었습니다.');
			await loadBiometricState();
		} catch (e: any) {
			toast.error(e?.detail || e?.message || '기기 이름 변경 실패');
		}
	}

	async function handleDeletePasskey(pk: PasskeyItem) {
		if (
			!confirm(
				`'${pk.device_name}' 지문 보안 열쇠를 삭제(해지)하시겠습니까?\n삭제 후에는 이 기기로 지문 인증을 사용할 수 없습니다.`
			)
		) {
			return;
		}
		try {
			await fastApi('DELETE', `/api/v1/biometric/passkeys/${pk.id}`, {}, { offline: false });
			toast.success(`'${pk.device_name}' 지문 보안 열쇠가 삭제되었습니다.`);
			statusBanner = `'${pk.device_name}' 보안 열쇠가 해지되었습니다.`;
			await loadBiometricState();
		} catch (e: any) {
			toast.error(e?.detail || e?.message || '지문 삭제에 실패했습니다.');
		}
	}

	onMount(() => {
		checkSensorSupport();
		loadBiometricState();
	});
</script>

<div class="space-y-6">
	<!-- 상단 센서 상태 및 요약 카드 -->
	<div
		class="flex flex-col justify-between gap-4 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-6"
	>
		<div class="flex items-start gap-4">
			<div
				class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl {platformAvailable
					? 'bg-emerald-50 text-emerald-600'
					: 'bg-slate-100 text-slate-500'}"
			>
				<Icon icon="ph:fingerprint-bold" class="h-7 w-7" />
			</div>
			<div>
				<div class="flex flex-wrap items-center gap-2">
					<h2 class="text-lg font-black tracking-tight text-slate-900 sm:text-xl">
						지문 · 생체인증 (Passkey) 관리
					</h2>
					<span
						class="rounded-full px-2.5 py-0.5 text-[11px] font-black {platformAvailable
							? 'bg-emerald-100 text-emerald-700'
							: 'bg-slate-100 text-slate-600'}"
					>
						{platformAvailable ? '센서 사용 가능' : '센서 미감지'}
					</span>
				</div>
				<p class="mt-1 text-xs font-bold text-slate-500">{sensorStatusText}</p>
				<p class="mt-0.5 text-[11px] font-medium text-slate-400">
					등록 기기 {passkeys.length}개 · 인증 도메인(RP ID): <span class="font-mono">{rpId}</span>
				</p>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			{#if showStandaloneLink}
				<a
					href={standaloneHref}
					class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
				>
					<Icon icon="ph:arrow-square-out-bold" class="h-4 w-4" />
					<span>지문 등록·삭제 전용 페이지</span>
				</a>
			{/if}
			<a
				href="/v1/pages/biometric"
				class="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100"
			>
				<Icon icon="ph:device-mobile-camera-bold" class="h-4 w-4" />
				<span>원격 공조 · 전체 이력</span>
			</a>
		</div>
	</div>

	{#if statusBanner}
		<div
			class="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800"
		>
			<div class="flex items-center gap-2">
				<Icon icon="ph:shield-check-fill" class="h-4 w-4 shrink-0 text-emerald-600" />
				<span>{statusBanner}</span>
			</div>
			<button
				type="button"
				onclick={() => (statusBanner = '')}
				class="text-emerald-600 hover:text-emerald-900"
				aria-label="알림 닫기"
			>
				<Icon icon="ph:x-bold" class="h-4 w-4" />
			</button>
		</div>
	{/if}

	<!-- 지문 등록 및 테스트 카드 -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
		<div class="rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-5">
			<h3 class="text-base font-black text-slate-900">새 지문 기기 등록</h3>
			<p class="mt-1 text-xs font-medium text-slate-500">
				현재 사용 중인 스마트폰이나 PC의 지문·Face ID·화면잠금(Passkey)을 계정에 등록합니다.
			</p>

			<div class="mt-4 space-y-3">
				<div class="space-y-1.5">
					<label for="biometric-device-name" class="block text-xs font-black text-slate-600">
						기기 별명 (선택)
					</label>
					<input
						id="biometric-device-name"
						type="text"
						bind:value={newDeviceName}
						placeholder={`예: ${getDefaultDeviceLabel()}`}
						class="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none"
					/>
				</div>

				<div class="flex flex-col gap-2 sm:flex-row">
					<button
						type="button"
						disabled={busy || !webauthnSupported}
						onclick={handleRegisterPasskey}
						class="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Icon icon="ph:fingerprint-bold" class="h-4 w-4" />
						<span>{busy ? '처리 중...' : '이 기기 지문 등록'}</span>
					</button>

					<button
						type="button"
						disabled={busy || passkeys.length === 0}
						onclick={handleVerifyPasskey}
						class="inline-flex items-center justify-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Icon icon="ph:shield-check-bold" class="h-4 w-4" />
						<span>인증 테스트</span>
					</button>
				</div>
			</div>
		</div>

		<!-- 등록된 지문 기기 목록 (이름 변경 & 삭제) -->
		<div class="rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-7">
			<div class="flex items-center justify-between gap-2">
				<div>
					<h3 class="text-base font-black text-slate-900">등록된 지문 보안 열쇠</h3>
					<p class="mt-0.5 text-xs font-medium text-slate-500">
						사용하지 않는 기기는 즉시 삭제(해지)하여 보안을 유지하세요.
					</p>
				</div>
				<button
					type="button"
					onclick={loadBiometricState}
					disabled={loading}
					class="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-100"
				>
					<Icon icon="ph:arrows-clockwise-bold" class="h-3.5 w-3.5" />
					<span>새로고침</span>
				</button>
			</div>

			<div class="mt-4 space-y-3">
				{#if loading}
					<div
						class="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-10 text-center text-xs font-bold text-slate-400"
					>
						등록된 지문 목록을 불러오는 중입니다...
					</div>
				{:else if passkeys.length === 0}
					<div
						class="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center"
					>
						<Icon icon="ph:fingerprint-simple-bold" class="mx-auto mb-2 h-10 w-10 text-slate-300" />
						<p class="text-xs font-black text-slate-600">아직 등록된 지문 보안 열쇠가 없습니다.</p>
						<p class="mt-1 text-[11px] font-medium text-slate-400">
							왼쪽의 [이 기기 지문 등록] 버튼을 눌러 첫 보안 기기를 등록해 주세요.
						</p>
					</div>
				{:else}
					{#each passkeys as pk (pk.id)}
						<div
							class="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center"
						>
							<div class="min-w-0 flex-1">
								{#if editingPasskeyId === pk.id}
									<div class="flex items-center gap-2">
										<input
											type="text"
											bind:value={editingDeviceName}
											class="w-full max-w-xs rounded-xl border border-blue-400 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none"
										/>
										<button
											type="button"
											onclick={() => saveDeviceName(pk.id)}
											class="rounded-xl bg-blue-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-blue-700"
										>
											저장
										</button>
										<button
											type="button"
											onclick={() => (editingPasskeyId = null)}
											class="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600"
										>
											취소
										</button>
									</div>
								{:else}
									<div class="flex flex-wrap items-center gap-2">
										<Icon icon="ph:key-bold" class="h-4 w-4 text-blue-600" />
										<span class="truncate text-sm font-black text-slate-900">{pk.device_name}</span>
										<span
											class="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200"
										>
											인증 {pk.sign_count ?? 0}회
										</span>
									</div>
									<p class="mt-1 text-[11px] font-medium text-slate-400">
										등록: {pk.created_at ? formatDateTime(pk.created_at) : '-'}
										{#if pk.last_used_at}
											· 최근 사용: {formatDateTime(pk.last_used_at)}
										{/if}
									</p>
								{/if}
							</div>

							{#if editingPasskeyId !== pk.id}
								<div class="flex shrink-0 items-center gap-2">
									<button
										type="button"
										onclick={() => startEditName(pk)}
										class="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 hover:bg-slate-100"
									>
										<Icon icon="ph:pencil-simple-bold" class="h-3.5 w-3.5" />
										<span>이름 변경</span>
									</button>
									<button
										type="button"
										onclick={() => handleDeletePasskey(pk)}
										class="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-black text-rose-700 hover:bg-rose-100"
									>
										<Icon icon="ph:trash-bold" class="h-3.5 w-3.5" />
										<span>삭제</span>
									</button>
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>

	<!-- 최근 생체인증 감사 이력 (최대 5건) -->
	{#if logs.length > 0}
		<div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-black text-slate-900">최근 지문 인증 이력</h3>
				<a href="/v1/pages/biometric" class="text-[11px] font-black text-blue-600 hover:underline">
					전체 이력 보기 →
				</a>
			</div>
			<div class="mt-3 divide-y divide-slate-100">
				{#each logs.slice(0, 5) as log (log.id)}
					<div class="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
						<div class="flex items-center gap-2">
							<span
								class="rounded-md px-2 py-0.5 text-[10px] font-black {log.status === 'SUCCESS'
									? 'bg-emerald-100 text-emerald-700'
									: 'bg-rose-100 text-rose-700'}"
							>
								{log.status}
							</span>
							<span class="font-bold text-slate-800">{log.action}</span>
							{#if log.device_name}
								<span class="text-slate-500">({log.device_name})</span>
							{/if}
							{#if log.detail}
								<span class="text-slate-400">- {log.detail}</span>
							{/if}
						</div>
						<span class="text-[11px] font-medium text-slate-400">
							{formatDateTime(log.created_at)}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

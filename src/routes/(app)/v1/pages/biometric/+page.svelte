<script lang="ts">
	/**
	 * @file /v1/pages/biometric/+page.svelte
	 * @description WebAuthn(Passkey) DB 연동 + 실시간 데스크톱↔모바일 원격 지문 공조 + 인증 감사 이력 통합 페이지
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import {
		browserSupportsWebAuthn,
		platformAuthenticatorIsAvailable,
		startAuthentication,
		startRegistration
	} from '@simplewebauthn/browser';
	import { fastApi } from '$lib/api';
	import { formatDateTime } from '$lib/utils';
	import { websocket } from '$lib/runes/websocket.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import { speakTTS } from '$lib/utils/sound';
	import Icon from '@iconify/svelte';

	let { data } = $props();
	let user = $derived(data?.user ?? null);

	// 3탭 상태: devices | coop | logs
	let activeTab = $state<'devices' | 'coop' | 'logs'>('devices');

	// 센서 / WebAuthn 지원 상태
	let webauthnSupported = $state(false);
	let platformAvailable = $state(false);
	let sensorStatusText = $state('확인 중...');

	// 서버 DB 상태
	let loading = $state(true);
	let busy = $state(false);
	let rpId = $state('-');
	let originUrl = $state('-');
	let passkeys = $state<any[]>([]);
	let logs = $state<any[]>([]);

	// 기기 등록 & 별명 수정 상태
	let newDeviceName = $state('');
	let editingPasskeyId = $state<number | null>(null);
	let editingDeviceName = $state('');
	let lastVerifyBanner = $state('');

	// 원격 지문 공조 (데스크톱 ↔ 모바일)
	let coopWaiting = $state(false);
	let coopDocUnlocked = $state(false);
	let coopCountdown = $state(0);
	let coopRequestId = $state('');
	let coopTimer: ReturnType<typeof setInterval> | null = null;
	let coopIncoming = $state<{
		requestId: string;
		docTitle: string;
		requesterName: string;
		requestedAt: string;
	} | null>(null);

	function getDefaultDeviceLabel() {
		if (!browser) return '내 보안 기기';
		const ua = navigator.userAgent || '';
		if (/Android/i.test(ua)) return 'Android 스마트폰';
		if (/iPhone|iPad/i.test(ua)) return 'Apple iOS 기기';
		if (/Mac/i.test(ua)) return 'MacBook / Touch ID';
		if (/Windows/i.test(ua)) return 'Windows Hello PC';
		return '내 생체인증 기기';
	}

	async function loadBiometricState() {
		if (!user) {
			loading = false;
			return;
		}
		loading = true;
		try {
			const res = await fastApi('GET', '/api/v1/biometric/passkeys', {}, { offline: false });
			if (res) {
				rpId = res.rp_id || '-';
				originUrl = res.origin || '-';
				passkeys = Array.isArray(res.passkeys) ? res.passkeys : [];
				logs = Array.isArray(res.logs) ? res.logs : [];
			}
		} catch (e: any) {
			toast.error(e?.message || '생체인증 정보를 불러오지 못했습니다.');
		} finally {
			loading = false;
		}
	}

	async function checkSensorSupport() {
		if (!browser) return;
		webauthnSupported = browserSupportsWebAuthn();
		if (!webauthnSupported) {
			platformAvailable = false;
			sensorStatusText = 'WebAuthn 미지원 브라우저 (HTTPS 필요)';
			return;
		}
		try {
			platformAvailable = await platformAuthenticatorIsAvailable();
			sensorStatusText = platformAvailable
				? '지문 · Face ID · 화면잠금 센서 사용 가능'
				: '내장 생체 센서 미감지 (외부 보안키 가능)';
		} catch {
			platformAvailable = false;
			sensorStatusText = '센서 지원 여부 확인 불가';
		}
	}

	async function handleRegisterPasskey() {
		if (busy) return;
		if (!webauthnSupported) {
			toast.error('이 브라우저에서는 WebAuthn Passkey를 지원하지 않습니다.');
			return;
		}
		busy = true;
		try {
			const optionsJSON = await fastApi('POST', '/api/v1/biometric/register/options', {}, { offline: false });
			const credential = await startRegistration({ optionsJSON });
			const deviceName = newDeviceName.trim() || getDefaultDeviceLabel();
			const result = await fastApi(
				'POST',
				'/api/v1/biometric/register/verify',
				{ credential, device_name: deviceName },
				{ offline: false }
			);
			if (result?.verified) {
				toast.success(`🎉 '${deviceName}' Passkey 등록이 완료되었습니다!`);
				lastVerifyBanner = `✅ '${deviceName}' 보안 열쇠가 서버 DB(${rpId})에 안전하게 등록되었습니다.`;
				newDeviceName = '';
				await loadBiometricState();
			}
		} catch (err: any) {
			if (err?.name === 'NotAllowedError') {
				toast.warning('지문 등록이 취소되었거나 시간 초과되었습니다.');
			} else if (err?.name === 'InvalidStateError') {
				toast.info('이미 이 기기가 현재 계정에 등록되어 있습니다.');
			} else {
				toast.error(err?.detail || err?.message || 'Passkey 등록 중 오류가 발생했습니다.');
			}
		} finally {
			busy = false;
		}
	}

	async function handleVerifyPasskey(action = 'VERIFY', detail?: string): Promise<boolean> {
		if (busy) return false;
		if (passkeys.length === 0) {
			toast.warning('먼저 [내 보안 기기] 탭에서 지문 기기를 등록해 주세요.');
			return false;
		}
		busy = true;
		try {
			const optionsJSON = await fastApi('POST', '/api/v1/biometric/authenticate/options', {}, { offline: false });
			const credential = await startAuthentication({ optionsJSON });
			const res = await fastApi(
				'POST',
				'/api/v1/biometric/authenticate/verify',
				{ credential, action, detail },
				{ offline: false }
			);
			if (res?.verified) {
				lastVerifyBanner = `🛡️ [${res.device_name}] 서버 공개키 서명 검증 통과 (누적 ${res.sign_count}회)`;
				if (action === 'VERIFY') {
					toast.success(`✅ '${res.device_name}' 지문 서명 검증 성공!`);
				}
				await loadBiometricState();
				return true;
			}
			return false;
		} catch (err: any) {
			if (err?.name === 'NotAllowedError') {
				toast.warning('지문 인증이 취소되었습니다.');
			} else {
				toast.error(err?.detail || err?.message || '지문 검증에 실패했습니다.');
			}
			return false;
		} finally {
			busy = false;
		}
	}

	async function saveDeviceName(passkeyId: number) {
		const trimmed = editingDeviceName.trim();
		if (!trimmed) {
			toast.warning('기기 이름을 입력해 주세요.');
			return;
		}
		try {
			await fastApi('PATCH', `/api/v1/biometric/passkeys/${passkeyId}`, { device_name: trimmed }, { offline: false });
			editingPasskeyId = null;
			toast.success('기기 이름이 변경되었습니다.');
			await loadBiometricState();
		} catch (e: any) {
			toast.error(e?.detail || '기기 이름 변경 실패');
		}
	}

	async function handleRevokePasskey(pk: any) {
		if (!confirm(`'${pk.device_name}' 보안 열쇠를 해지하시겠습니까? 해지 후에는 이 기기로 지문 인증할 수 없습니다.`)) {
			return;
		}
		try {
			await fastApi('DELETE', `/api/v1/biometric/passkeys/${pk.id}`, {}, { offline: false });
			toast.success(`'${pk.device_name}' 보안 열쇠가 해지되었습니다.`);
			await loadBiometricState();
		} catch (e: any) {
			toast.error(e?.detail || '기기 해지 실패');
		}
	}

	// --- 원격 지문 공조 (데스크톱 ↔ 모바일) ---
	function clearCoopTimer() {
		if (coopTimer) {
			clearInterval(coopTimer);
			coopTimer = null;
		}
	}

	function sendCoopRequest(includeSelf = false) {
		if (!user) return;
		if (websocket.status !== 'connected') {
			toast.error('실시간 WebSocket 연결을 확인해 주세요.');
			return;
		}
		clearCoopTimer();
		const isMobileDevice =
			typeof navigator !== 'undefined' &&
			/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
		const allowSelf = includeSelf || isMobileDevice;
		const reqId = `coop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
		coopRequestId = reqId;
		coopWaiting = true;
		coopDocUnlocked = false;
		coopCountdown = 60;

		websocket.send({
			type: 'BIOMETRIC_COOP_REQUEST',
			requestId: reqId,
			includeSelf: allowSelf,
			docTitle: '1급 대외비 운행·관제 보안 문서',
			requesterName: user.real_name || user.username,
			requestedAt: new Date().toLocaleTimeString('ko-KR')
		});
		toast.info(
			allowSelf
				? '📲 현재 휴대폰(자기 자신)으로 지문 승인 요청을 발송했습니다!'
				: '📲 내 스마트폰으로 원격 지문 승인 요청을 발송했습니다!'
		);

		coopTimer = setInterval(() => {
			coopCountdown -= 1;
			if (coopCountdown <= 0) {
				clearCoopTimer();
				coopWaiting = false;
				toast.warning('⏱️ 지문 승인 대기 시간(60초)이 만료되었습니다.');
			}
		}, 1000);
	}

	function cancelCoopRequest() {
		clearCoopTimer();
		coopWaiting = false;
		if (coopRequestId) {
			websocket.send({ type: 'BIOMETRIC_COOP_CANCEL', requestId: coopRequestId });
		}
		toast.info('원격 지문 승인 요청을 취소했습니다.');
	}

	async function approveIncomingCoop() {
		if (!coopIncoming) return;
		const req = coopIncoming;
		const ok = await handleVerifyPasskey('COOP_APPROVE', `원격 공조 승인 (${req.docTitle})`);
		if (ok) {
			websocket.send({
				type: 'BIOMETRIC_COOP_RESULT',
				requestId: req.requestId,
				includeSelf: coopRequestId === req.requestId,
				approved: true,
				approverName: user?.real_name || user?.username || '본인'
			});
			if (coopRequestId === req.requestId) {
				clearCoopTimer();
				coopWaiting = false;
				coopDocUnlocked = true;
			}
			coopIncoming = null;
			toast.success('🔓 지문 서명 검증 완료! 문서 잠금이 해제되었습니다.');
		}
	}

	async function rejectIncomingCoop() {
		if (!coopIncoming) return;
		const req = coopIncoming;
		websocket.send({
			type: 'BIOMETRIC_COOP_RESULT',
			requestId: req.requestId,
			includeSelf: coopRequestId === req.requestId,
			approved: false,
			reason: '스마트폰에서 열람 요청을 거부했습니다.'
		});
		if (coopRequestId === req.requestId) {
			clearCoopTimer();
			coopWaiting = false;
		}
		coopIncoming = null;
		try {
			await fastApi(
				'POST',
				'/api/v1/biometric/coop/log',
				{ action: 'COOP_REJECT', status: 'REJECTED', detail: `원격 공조 거부 (${req.docTitle})` },
				{ offline: false }
			);
			await loadBiometricState();
		} catch {
			// 로그 기록 실패는 무시
		}
		toast.info('원격 지문 승인 요청을 거부했습니다.');
	}

	onMount(() => {
		newDeviceName = getDefaultDeviceLabel();
		checkSensorSupport();
		loadBiometricState();

		const unsubscribe = websocket.addMessageListener((msg: any) => {
			if (!msg) return;
			if (msg.type === 'BIOMETRIC_COOP_REQUEST') {
				const isMobileDevice =
					typeof navigator !== 'undefined' &&
					/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
				if (!isMobileDevice) return;
				coopIncoming = {
					requestId: msg.requestId,
					docTitle: msg.docTitle || '대외비 보안 문서',
					requesterName: msg.requesterName || '본인 PC',
					requestedAt: msg.requestedAt || new Date().toLocaleTimeString('ko-KR')
				};
				activeTab = 'coop';
				speakTTS('데스크톱에서 중요 문서 열람 지문 승인을 요청했습니다. 지문을 인증해 주십시오.');
				toast.info('📲 데스크톱 지문 승인 요청이 도착했습니다!');
			} else if (msg.type === 'BIOMETRIC_COOP_RESULT') {
				if (coopRequestId && msg.requestId === coopRequestId) {
					clearCoopTimer();
					coopWaiting = false;
					if (msg.approved) {
						coopDocUnlocked = true;
						toast.success('🔓 스마트폰 지문 승인 완료! 데스크톱 보안 금고가 열렸습니다.');
						loadBiometricState();
					} else {
						toast.error(msg.reason || '스마트폰에서 지문 승인이 거부되었습니다.');
					}
				}
			} else if (msg.type === 'BIOMETRIC_COOP_CANCEL') {
				if (coopIncoming && (!msg.requestId || coopIncoming.requestId === msg.requestId)) {
					coopIncoming = null;
					toast.info('데스크톱에서 지문 승인 요청을 취소했습니다.');
				}
			}
		});

		websocket.send({ type: 'BIOMETRIC_COOP_SYNC' });

		return () => {
			clearCoopTimer();
			unsubscribe();
		};
	});

	const ACTION_META: Record<string, { label: string; badge: string }> = {
		REGISTER: { label: '기기 등록', badge: 'bg-blue-100 text-blue-700' },
		VERIFY: { label: '서명 검증', badge: 'bg-emerald-100 text-emerald-700' },
		COOP_APPROVE: { label: '원격 승인', badge: 'bg-violet-100 text-violet-700' },
		COOP_REJECT: { label: '원격 거부', badge: 'bg-rose-100 text-rose-700' },
		REVOKE: { label: '기기 해지', badge: 'bg-slate-200 text-slate-700' }
	};
</script>

<div class="mx-auto max-w-5xl space-y-6">
	<!-- 상단 헤더 -->
	<header class="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center gap-4">
				<div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
					<Icon icon="ph:fingerprint-bold" class="text-3xl" />
				</div>
				<div>
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
							생체 인증 · Passkey 보안 센터
						</h1>
						<span class="rounded-full px-2.5 py-0.5 text-[11px] font-black {platformAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}">
							{platformAvailable ? '생체 센서 활성' : webauthnSupported ? '보안키 지원' : '미지원 환경'}
						</span>
					</div>
					<p class="mt-1 text-xs font-medium text-slate-500">{sensorStatusText}</p>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2 text-xs">
				<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-600">
					RP ID: <span class="font-mono text-indigo-700">{rpId}</span>
				</div>
				<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-600">
					등록 기기: <span class="font-black text-slate-900">{passkeys.length}대</span>
				</div>
			</div>
		</div>

		{#if lastVerifyBanner}
			<div class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800">
				{lastVerifyBanner}
			</div>
		{/if}
	</header>

	{#if !user}
		<div class="rounded-3xl border-2 border-amber-200 bg-amber-50 p-8 text-center">
			<Icon icon="ph:lock-key-bold" class="mx-auto text-4xl text-amber-600" />
			<p class="mt-3 text-sm font-black text-amber-900">생체 인증 · Passkey 관리는 로그인 후 이용할 수 있습니다.</p>
			<a href="/login" class="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-black text-white hover:bg-amber-700">
				로그인 하러 가기
			</a>
		</div>
	{:else}
		<!-- 3탭 네비게이션 -->
		<nav class="flex gap-2 overflow-x-auto border-b-2 border-slate-200 pb-0">
			<button
				type="button"
				onclick={() => (activeTab = 'devices')}
				class="flex shrink-0 items-center gap-2 border-b-4 px-5 py-3 text-xs font-black transition {activeTab === 'devices' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-900'}"
			>
				<Icon icon="ph:device-mobile-bold" class="text-base" />
				<span>내 보안 기기 ({passkeys.length})</span>
			</button>
			<button
				type="button"
				onclick={() => (activeTab = 'coop')}
				class="flex shrink-0 items-center gap-2 border-b-4 px-5 py-3 text-xs font-black transition {activeTab === 'coop' ? 'border-violet-600 bg-violet-50/50 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-900'}"
			>
				<Icon icon="ph:devices-bold" class="text-base" />
				<span>원격 지문 공조 (PC ↔ 모바일)</span>
				{#if coopIncoming}
					<span class="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">요청 도착</span>
				{/if}
			</button>
			<button
				type="button"
				onclick={() => (activeTab = 'logs')}
				class="flex shrink-0 items-center gap-2 border-b-4 px-5 py-3 text-xs font-black transition {activeTab === 'logs' ? 'border-slate-900 bg-slate-100/70 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}"
			>
				<Icon icon="ph:clock-counter-clockwise-bold" class="text-base" />
				<span>인증·승인 이력 ({logs.length})</span>
			</button>
		</nav>

		<!-- 탭 1: 내 보안 기기 (Passkey 등록/검증/관리) -->
		{#if activeTab === 'devices'}
			<section class="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<!-- 등록 카드 -->
				<div class="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
					<h2 class="flex items-center gap-2 text-sm font-black text-slate-900">
						<Icon icon="ph:plus-circle-bold" class="text-lg text-indigo-600" />
						새 지문 · Passkey 기기 등록
					</h2>
					<p class="mt-1.5 text-xs leading-relaxed text-slate-500">
						현재 기기의 지문·Face ID 공개키를 서버 DB(<span class="font-mono">{rpId}</span>)에 등록합니다.
					</p>

					<div class="mt-4 space-y-3">
						<div>
							<label for="device-name-input" class="mb-1 block text-[11px] font-black text-slate-600">기기 별명</label>
							<input
								id="device-name-input"
								type="text"
								bind:value={newDeviceName}
								placeholder="예: 내 갤럭시 S24"
								class="input input-bordered input-sm w-full rounded-xl font-bold"
							/>
						</div>

						<button
							type="button"
							onclick={handleRegisterPasskey}
							disabled={busy || !webauthnSupported}
							class="btn btn-primary w-full rounded-xl font-black shadow-md shadow-indigo-500/20"
						>
							<Icon icon="ph:fingerprint-bold" class="text-lg" />
							<span>{busy ? '인증 처리 중...' : '이 기기 지문 등록하기'}</span>
						</button>

						<button
							type="button"
							onclick={() => handleVerifyPasskey('VERIFY')}
							disabled={busy || passkeys.length === 0}
							class="btn btn-outline btn-sm w-full rounded-xl font-bold"
						>
							<Icon icon="ph:shield-check-bold" class="text-base" />
							<span>등록된 기기로 즉시 서명 검증</span>
						</button>
					</div>
				</div>

				<!-- 등록 기기 목록 -->
				<div class="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
					<div class="mb-4 flex items-center justify-between">
						<h2 class="text-sm font-black text-slate-900">내 계정에 등록된 보안 기기</h2>
						<button type="button" onclick={loadBiometricState} class="btn btn-ghost btn-xs font-bold text-slate-500">
							새로고침
						</button>
					</div>

					{#if loading}
						<div class="py-12 text-center text-xs font-bold text-slate-400">기기 목록을 불러오는 중...</div>
					{:else if passkeys.length === 0}
						<div class="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
							<Icon icon="ph:fingerprint-simple-bold" class="mx-auto text-4xl text-slate-300" />
							<p class="mt-2 text-sm font-black text-slate-600">아직 등록된 Passkey 기기가 없습니다.</p>
							<p class="mt-1 text-xs text-slate-400">좌측에서 [이 기기 지문 등록하기]를 눌러 첫 보안 열쇠를 발급하세요.</p>
						</div>
					{:else}
						<div class="space-y-3">
							{#each passkeys as pk (pk.id)}
								<div class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
									<div class="min-w-0 flex-1">
										{#if editingPasskeyId === pk.id}
											<div class="flex items-center gap-2">
												<input
													type="text"
													bind:value={editingDeviceName}
													class="input input-bordered input-xs w-48 rounded-lg font-bold"
												/>
												<button type="button" onclick={() => saveDeviceName(pk.id)} class="btn btn-xs btn-primary">저장</button>
												<button type="button" onclick={() => (editingPasskeyId = null)} class="btn btn-xs btn-ghost">취소</button>
											</div>
										{:else}
											<div class="flex items-center gap-2">
												<Icon icon="ph:key-bold" class="shrink-0 text-indigo-600" />
												<span class="truncate text-sm font-black text-slate-900">{pk.device_name}</span>
												<span class="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
													서명 {pk.sign_count}회
												</span>
											</div>
										{/if}
										<div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-slate-500">
											<span>ID: <span class="font-mono">{pk.credential_id.slice(0, 14)}...</span></span>
											<span>등록: {formatDateTime(pk.created_at)}</span>
											<span>최근 인증: {pk.last_used_at ? formatDateTime(pk.last_used_at) : '미사용'}</span>
										</div>
									</div>

									<div class="flex shrink-0 items-center gap-1.5">
										<button
											type="button"
											onclick={() => {
												editingPasskeyId = pk.id;
												editingDeviceName = pk.device_name;
											}}
											class="btn btn-xs btn-ghost rounded-lg font-bold text-slate-600"
										>
											이름변경
										</button>
										<button
											type="button"
											onclick={() => handleRevokePasskey(pk)}
											class="btn btn-xs btn-ghost rounded-lg font-bold text-rose-600 hover:bg-rose-50"
										>
											해지
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</section>

		<!-- 탭 2: 원격 지문 공조 (데스크톱 ↔ 모바일) -->
		{:else if activeTab === 'coop'}
			<section class="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm">
				<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 class="flex items-center gap-2 text-base font-black text-slate-900">
							<Icon icon="ph:shield-star-bold" class="text-xl text-violet-600" />
							데스크톱 ↔ 스마트폰 실시간 원격 지문 공조
						</h2>
						<p class="mt-1 text-xs text-slate-500">
							데스크톱에서 보안 문서 잠금 해제를 요청하면, 내 스마트폰에서 DB Passkey 서명 검증 후 즉시 잠금이 해제됩니다.
						</p>
					</div>
					<span class="rounded-full px-3 py-1 text-xs font-black {coopDocUnlocked ? 'bg-emerald-100 text-emerald-700' : coopWaiting ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-slate-100 text-slate-700'}">
						{coopDocUnlocked ? '🔓 잠금 해제됨' : coopWaiting ? `⏳ 승인 대기 중 (${coopCountdown}초)` : '🔒 1급 대외비 잠김'}
					</span>
				</div>

				<div class="mt-6 rounded-2xl border-2 {coopDocUnlocked ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-slate-50'} p-6">
					{#if coopDocUnlocked}
						<div class="space-y-3">
							<div class="flex items-center gap-2 text-sm font-black text-emerald-800">
								<Icon icon="ph:lock-open-bold" class="text-xl" />
								<span>원격 지문 공조 승인 완료 — 1급 대외비 문서 열람 중</span>
							</div>
							<p class="text-xs leading-relaxed text-slate-700">
								스마트폰에서 WebAuthn 공개키 서명 검증을 통과하여 데스크톱 보안 금고가 열렸습니다.
							</p>
							<button
								type="button"
								onclick={() => (coopDocUnlocked = false)}
								class="btn btn-sm rounded-xl bg-slate-900 font-bold text-white"
							>
								다시 잠그기
							</button>
						</div>
					{:else if coopWaiting}
						<div class="flex flex-col items-center gap-3 py-4 text-center">
							<Icon icon="ph:device-mobile-speaker-bold" class="text-4xl text-violet-600 animate-bounce" />
							<p class="text-sm font-black text-slate-900">
								스마트폰 화면에서 지문 승인을 기다리는 중입니다... ({coopCountdown}초)
							</p>
							<button type="button" onclick={cancelCoopRequest} class="btn btn-sm btn-ghost text-rose-600 font-bold">
								요청 취소
							</button>
						</div>
					{:else}
						<div class="flex flex-col items-center gap-3 py-4 text-center">
							<Icon icon="ph:lock-bold" class="text-4xl text-slate-400" />
							<p class="text-sm font-bold text-slate-700">이 문서는 스마트폰 원격 지문 승인이 필요합니다.</p>
							<button
								type="button"
								onclick={() => sendCoopRequest()}
								class="btn rounded-xl bg-violet-600 font-black text-white hover:bg-violet-700"
							>
								<Icon icon="ph:paper-plane-tilt-bold" class="text-lg" />
								<span>내 스마트폰으로 지문 승인 요청 보내기</span>
							</button>
						</div>
					{/if}
				</div>
			</section>

		<!-- 탭 3: 인증·승인 이력 -->
		{:else}
			<section class="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-sm font-black text-slate-900">최근 생체 인증 · Passkey 감사 이력</h2>
					<button type="button" onclick={loadBiometricState} class="btn btn-ghost btn-xs font-bold text-slate-500">
						새로고침
					</button>
				</div>

				{#if logs.length === 0}
					<div class="py-12 text-center text-xs font-bold text-slate-400">아직 기록된 생체 인증 이력이 없습니다.</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="table table-sm w-full">
							<thead>
								<tr class="text-xs text-slate-500">
									<th>구분</th>
									<th>결과</th>
									<th>기기</th>
									<th>상세</th>
									<th>IP</th>
									<th>일시</th>
								</tr>
							</thead>
							<tbody>
								{#each logs as log (log.id)}
									{@const meta = ACTION_META[log.action] || { label: log.action, badge: 'bg-slate-100 text-slate-700' }}
									<tr class="text-xs">
										<td>
											<span class="rounded-md px-2 py-0.5 text-[11px] font-black {meta.badge}">{meta.label}</span>
										</td>
										<td>
											<span class="font-black {log.status === 'SUCCESS' ? 'text-emerald-600' : 'text-rose-600'}">
												{log.status}
											</span>
										</td>
										<td class="font-bold text-slate-700">{log.device_name || '-'}</td>
										<td class="text-slate-600">{log.detail || '-'}</td>
										<td class="font-mono text-[11px] text-slate-400">{log.ip_address || '-'}</td>
										<td class="whitespace-nowrap text-slate-500">{formatDateTime(log.created_at)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</section>
		{/if}
	{/if}
</div>

<!-- 📱 모바일 수신 전용 긴급 지문 승인 모달 -->
{#if coopIncoming}
	<div class="fixed inset-0 z-[10005] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
		<div class="w-full max-w-sm rounded-3xl border-2 border-violet-300 bg-white p-6 shadow-2xl">
			<div class="flex items-center gap-3">
				<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
					<Icon icon="ph:fingerprint-bold" class="text-3xl" />
				</div>
				<div>
					<span class="text-[11px] font-black uppercase tracking-wider text-violet-600">원격 지문 승인 요청</span>
					<h3 class="text-base font-black text-slate-900">{coopIncoming.docTitle}</h3>
				</div>
			</div>

			<div class="mt-4 rounded-2xl bg-slate-50 p-3.5 text-xs text-slate-600 space-y-1">
				<div>요청자: <strong class="text-slate-900">{coopIncoming.requesterName}</strong></div>
				<div>요청 시각: <strong class="text-slate-900">{coopIncoming.requestedAt}</strong></div>
			</div>

			<div class="mt-5 flex flex-col gap-2">
				<button
					type="button"
					onclick={approveIncomingCoop}
					disabled={busy}
					class="btn w-full rounded-xl bg-violet-600 font-black text-white hover:bg-violet-700"
				>
					<Icon icon="ph:fingerprint-bold" class="text-xl" />
					<span>{busy ? '지문 서명 검증 중...' : '지금 지문 찍어 승인하기'}</span>
				</button>
				<button
					type="button"
					onclick={rejectIncomingCoop}
					disabled={busy}
					class="btn btn-ghost btn-sm w-full rounded-xl font-bold text-slate-500"
				>
					거부하기
				</button>
			</div>
		</div>
	</div>
{/if}

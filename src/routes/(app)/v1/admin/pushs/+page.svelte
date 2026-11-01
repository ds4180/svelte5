<script>
	/**
	 * ============================================================================
	 * [모바일/PC 웹 푸시 & 구독 기기 관제 (+page.svelte)]
	 * ============================================================================
	 * 
	 * 💡 이 페이지의 역할:
	 * 1. Web Push 활성 구독 기기(PushSubscription) 실시간 전수 조회 및 상태 모니터링
	 * 2. 기기/브라우저 유형(Chrome, Firefox, Safari, Edge) 자동 판별 및 소속 그룹 확인
	 * 3. 무효/만료 기기 강제 삭제 및 전체/개별 브로드캐스트 푸시 즉시 발송
	 */

	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import * as api from '$lib/api/admin.js';
	import { toast } from '$lib/runes/toast.svelte.js';
	import Icon from '@iconify/svelte';

	let subscriptions = $state(/** @type {any[]} */ ([]));
	let loading = $state(true);
	let showSendModal = $state(false);
	let searchKeyword = $state('');
	let platformFilter = $state('');

	// 📊 푸시 발송 폼 상태
	let pushData = $state({
		title: '📢 jeju.live 공지사항',
		body: '',
		url: '/'
	});

	/**
	 * 구독자 목록 로드
	 */
	async function loadSubscriptions() {
		loading = true;
		try {
			subscriptions = await api.adminGetPushSubscriptions();
		} catch (/** @type {any} */ e) {
			toast.error('구독 목록 로드 실패: ' + e.message);
		} finally {
			loading = false;
		}
	}

	/**
	 * 전체 브로드캐스트 푸시 발송
	 */
	async function sendPush() {
		if (!pushData.body.trim()) {
			toast.warning('메시지 본문을 입력해 주세요.');
			return;
		}

		try {
			const result = await api.adminSendPush(pushData);
			toast.success(`${result.sent_count}개의 기기에 푸시를 성공적으로 발송했습니다.`);
			showSendModal = false;
			pushData.body = '';
		} catch (/** @type {any} */ e) {
			toast.error('푸시 발송 실패: ' + e.message);
		}
	}

	/**
	 * 특정 구독 정보 삭제
	 * @param {number} id
	 * @param {string} label
	 */
	async function deleteSubscription(id, label) {
		if (!confirm(`[주의] '${label}' 기기의 푸시 구독 정보를 삭제하시겠습니까?\n삭제 즉시 해당 기기는 웹 푸시 수신 대상에서 제외됩니다.`)) {
			return;
		}
		try {
			await api.adminDeletePushSubscription(id);
			toast.success('구독 정보가 안전하게 삭제되었습니다.');
			await loadSubscriptions();
		} catch (/** @type {any} */ e) {
			toast.error('구독 삭제 실패: ' + e.message);
		}
	}

	/**
	 * 엔드포인트 클립보드 복사
	 * @param {string} text
	 */
	function copyEndpoint(text) {
		navigator.clipboard.writeText(text);
		toast.info('엔드포인트 URL이 클립보드에 복사되었습니다.');
	}

	// 🔍 검색 및 플랫폼 필터링 파생 상태
	const filteredSubscriptions = $derived(
		subscriptions.filter(sub => {
			const matchesSearch =
				!searchKeyword ||
				(sub.username || '').toLowerCase().includes(searchKeyword.toLowerCase()) ||
				(sub.real_name || '').toLowerCase().includes(searchKeyword.toLowerCase()) ||
				(sub.primary_group || '').toLowerCase().includes(searchKeyword.toLowerCase()) ||
				(sub.endpoint || '').toLowerCase().includes(searchKeyword.toLowerCase());

			const matchesPlatform =
				!platformFilter ||
				(sub.browser_type || '').includes(platformFilter);

			return matchesSearch && matchesPlatform;
		})
	);

	// 📊 통계 집계
	const stats = $derived({
		total: subscriptions.length,
		chrome: subscriptions.filter(s => (s.browser_type || '').includes('Chrome')).length,
		firefox: subscriptions.filter(s => (s.browser_type || '').includes('Firefox')).length,
		apple: subscriptions.filter(s => (s.browser_type || '').includes('Safari')).length,
		other: subscriptions.filter(s => !(s.browser_type || '').includes('Chrome') && !(s.browser_type || '').includes('Firefox') && !(s.browser_type || '').includes('Safari')).length
	});

	onMount(loadSubscriptions);
</script>

<svelte:head>
	<title>모바일 웹 푸시 & 구독자 관리 | jeju.live Core</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-8 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 lg:px-8">
	<!-- ===================================================================== -->
	<!-- 1. 헤더 영역 -->
	<!-- ===================================================================== -->
	<div class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-pink-400 uppercase">
					<Icon icon="solar:bell-bing-bold" class="text-xs" />
					Web Push Governance
				</span>
				<span class="text-xs font-bold text-slate-400">/v1/admin/pushs</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-4xl">
				모바일 웹 푸시 & <span class="not-italic text-pink-600">구독자 관리</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				사원 기기별 Web Push 구독 상태 확인, 플랫폼별 모니터링 및 전체/그룹 긴급 푸시 전송
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<button
				onclick={loadSubscriptions}
				class="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
			>
				<Icon icon="solar:restart-bold" class="text-base {loading ? 'animate-spin' : ''}" />
				<span>새로고침</span>
			</button>

			<button
				onclick={() => (showSendModal = true)}
				class="flex items-center gap-2 rounded-xl bg-pink-600 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-pink-200 transition hover:bg-pink-700 active:scale-95"
			>
				<Icon icon="solar:plain-bold" class="text-base" />
				<span>전체 푸시 즉시 발송</span>
			</button>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 2. 통계 지표 카드 -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
		<!-- 카드 1: 전체 구독 기기 -->
		<div class="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Active Devices</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 text-pink-600">
					<Icon icon="solar:devices-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900">
					{stats.total.toLocaleString()}
					<span class="text-xs font-bold text-slate-500 font-normal">대 등록</span>
				</div>
				<div class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
					<span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
					FCM & WPush 정상 가동
				</div>
			</div>
		</div>

		<!-- 카드 2: Chrome / Android -->
		<div class="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Google / FCM</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
					<Icon icon="mdi:google-chrome" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900">
					{stats.chrome.toLocaleString()}
					<span class="text-xs font-bold text-slate-500 font-normal">대</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-slate-400">
					Chrome 및 안드로이드 기기
				</div>
			</div>
		</div>

		<!-- 카드 3: Firefox -->
		<div class="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Mozilla Firefox</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
					<Icon icon="mdi:firefox" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900">
					{stats.firefox.toLocaleString()}
					<span class="text-xs font-bold text-slate-500 font-normal">대</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-slate-400">
					Mozilla WPush 엔드포인트
				</div>
			</div>
		</div>

		<!-- 카드 4: Apple & 기타 -->
		<div class="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Safari & Others</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
					<Icon icon="mdi:apple-safari" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900">
					{(stats.apple + stats.other).toLocaleString()}
					<span class="text-xs font-bold text-slate-500 font-normal">대</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-slate-400">
					Apple WebPush 및 표준 기기
				</div>
			</div>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 3. 검색 및 필터 툴바 -->
	<!-- ===================================================================== -->
	<div class="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
		<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div class="flex flex-1 flex-wrap items-center gap-3">
				<!-- 검색창 -->
				<div class="relative min-w-[240px] flex-1 md:max-w-xs">
					<Icon icon="solar:magnifer-linear" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
					<input
						type="text"
						placeholder="이름, 아이디, 소속 그룹, 엔드포인트 검색..."
						bind:value={searchKeyword}
						class="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:border-pink-500 focus:bg-white focus:outline-none"
					/>
				</div>

				<!-- 플랫폼 필터 -->
				<select
					bind:value={platformFilter}
					class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:border-pink-500 focus:bg-white focus:outline-none"
				>
					<option value="">모든 플랫폼 (All)</option>
					<option value="Chrome">Chrome / Google FCM</option>
					<option value="Firefox">Mozilla Firefox</option>
					<option value="Safari">Apple Safari</option>
				</select>
			</div>

			<div class="text-xs font-bold text-slate-400">
				총 <span class="font-black text-pink-600">{filteredSubscriptions.length}</span>대의 기기 감지됨
			</div>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 4. 구독자 목록 테이블 -->
	<!-- ===================================================================== -->
	<div class="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
		{#if loading}
			<div class="flex flex-col items-center justify-center py-20 text-slate-400">
				<Icon icon="solar:refresh-circle-bold-duotone" class="h-10 w-10 animate-spin text-pink-600" />
				<span class="mt-3 text-xs font-bold">웹 푸시 구독 기기 목록을 동기화하고 있습니다...</span>
			</div>
		{:else if filteredSubscriptions.length === 0}
			<div class="py-20 text-center text-slate-400">
				<Icon icon="solar:bell-off-bold" class="mx-auto h-12 w-12 text-slate-300" />
				<p class="mt-2 text-sm font-bold">조건에 해당하는 활성 푸시 구독 기기가 없습니다.</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-left text-xs">
					<thead class="border-b border-slate-200 bg-slate-50/80 font-black text-slate-500 uppercase tracking-wider">
						<tr>
							<th class="px-5 py-3.5">사원 / 사용자 정보</th>
							<th class="px-4 py-3.5">소속 그룹</th>
							<th class="px-4 py-3.5">기기 / 브라우저 플랫폼</th>
							<th class="px-4 py-3.5">엔드포인트 (Preview)</th>
							<th class="px-5 py-3.5 text-right">구독 제어</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100 font-medium text-slate-700">
						{#each filteredSubscriptions as sub}
							<tr class="hover:bg-slate-50/80 transition">
								<!-- 사원 정보 -->
								<td class="px-5 py-4">
									<div class="flex items-center gap-3">
										<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-50 font-black text-pink-600 border border-pink-100">
											{(sub.real_name || sub.username || '?')[0].toUpperCase()}
										</div>
										<div>
											<div class="flex items-center gap-1.5 font-black text-slate-900 text-sm">
												{sub.real_name || sub.username}
												<span class="text-xs font-normal text-slate-400">(@{sub.username})</span>
											</div>
											<div class="text-[11px] text-slate-400 font-normal mt-0.5">
												사원 식별번호 #{sub.user_id}
											</div>
										</div>
									</div>
								</td>

								<!-- 소속 그룹 -->
								<td class="px-4 py-4">
									<span class="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700">
										<Icon icon="solar:users-group-rounded-bold" class="text-xs text-slate-400" />
										{sub.primary_group || '소속 미정'}
									</span>
								</td>

								<!-- 기기 / 브라우저 -->
								<td class="px-4 py-4">
									<span class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold {sub.badge_color || 'bg-slate-50 text-slate-700 border-slate-200'}">
										<Icon icon={sub.browser_icon || 'mdi:cellphone-wireless'} class="text-sm" />
										{sub.browser_type || 'Web Push'}
									</span>
								</td>

								<!-- 엔드포인트 프리뷰 -->
								<td class="px-4 py-4">
									<div class="flex items-center gap-2">
										<span class="max-w-xs truncate font-mono text-[11px] text-slate-500" title={sub.endpoint}>
											{sub.endpoint_preview || sub.endpoint}
										</span>
										<button
											onclick={() => copyEndpoint(sub.endpoint)}
											class="text-slate-400 transition hover:text-slate-700"
											title="엔드포인트 URL 전체 복사"
										>
											<Icon icon="solar:copy-linear" class="text-sm" />
										</button>
									</div>
								</td>

								<!-- 제어 버튼 -->
								<td class="px-5 py-4 text-right">
									<button
										onclick={() => deleteSubscription(sub.id, sub.real_name || sub.username)}
										class="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-600 hover:text-white active:scale-95"
										title="구독 취소 및 삭제"
									>
										<Icon icon="solar:trash-bin-trash-bold" class="text-sm" />
										구독 삭제
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<!-- ========================================================================= -->
<!-- 5. 전체 푸시 즉시 발송 모달 -->
<!-- ========================================================================= -->
{#if showSendModal}
	<dialog class="modal modal-open backdrop-blur-sm" transition:fade>
		<div class="modal-box max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl">
			<div class="flex items-center justify-between border-b border-slate-100 pb-4">
				<div class="flex items-center gap-2">
					<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 text-pink-600">
						<Icon icon="solar:plain-bold" class="text-xl" />
					</div>
					<div>
						<h3 class="text-lg font-black text-slate-900">전체 웹 푸시 즉시 발송</h3>
						<p class="text-[11px] font-bold text-slate-400">등록된 {subscriptions.length}대의 활성 기기에 브로드캐스트합니다</p>
					</div>
				</div>
				<button onclick={() => (showSendModal = false)} class="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
					<Icon icon="solar:close-circle-bold" class="text-xl" />
				</button>
			</div>

			<div class="mt-6 space-y-4">
				<div>
					<label for="push-title" class="block text-xs font-black text-slate-700 mb-1.5">푸시 알림 제목</label>
					<input
						id="push-title"
						type="text"
						class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-900 focus:border-pink-500 focus:bg-white focus:outline-none"
						bind:value={pushData.title}
					/>
				</div>

				<div>
					<label for="push-body" class="block text-xs font-black text-slate-700 mb-1.5">푸시 알림 내용 (Body)</label>
					<textarea
						id="push-body"
						rows="4"
						class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-900 focus:border-pink-500 focus:bg-white focus:outline-none"
						placeholder="발송할 핵심 메시지를 입력하세요..."
						bind:value={pushData.body}
					></textarea>
				</div>

				<div>
					<label for="push-url" class="block text-xs font-black text-slate-700 mb-1.5">클릭 시 이동할 URL (선택)</label>
					<input
						id="push-url"
						type="text"
						class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-900 focus:border-pink-500 focus:bg-white focus:outline-none font-mono"
						placeholder="예: /v1/custom/dispatch 또는 /v1/app/board/notice"
						bind:value={pushData.url}
					/>
				</div>
			</div>

			<div class="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5">
				<button
					class="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
					onclick={() => (showSendModal = false)}
				>
					취소
				</button>
				<button
					class="flex items-center gap-2 rounded-xl bg-pink-600 px-6 py-2.5 text-xs font-black text-white shadow-md shadow-pink-200 transition hover:bg-pink-700 active:scale-95"
					onclick={sendPush}
				>
					<Icon icon="solar:plain-bold" class="text-base" />
					<span>지금 발송하기</span>
				</button>
			</div>
		</div>
	</dialog>
{/if}

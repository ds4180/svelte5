<script lang="ts">
	/**
	 * ============================================================================
	 * [차량 배차 관리자 — 설정 탭 (DispatchSettingsTab.svelte)]
	 * ============================================================================
	 * 💡 항상 맨 오른쪽 마지막 탭에 위치하여 배차 앱의 핵심 비즈니스 로직을 통제합니다:
	 * 1. 배차 예고(사전 공개) 설정: D+x일부터 y일 예고, 공개 시각(xx:yy), 즉시 예고 / 예고 정지
	 * 2. 명일 배차 자동 고지 설정: D-1일 xx:yy 자동 확정 + 인앱 알림/웹 푸시 발송
	 * 3. 노선-차량 매핑 규칙 & 사용자 뷰 표시 옵션
	 */
	import { untrack } from 'svelte';
	import * as dispatchApi from '$lib/api/dispatch';
	import type { DispatchPreviewWindow, DispatchSettings } from '$lib/api/dispatch';
	import {
		DEFAULT_DISPATCH_SETTINGS,
		DEFAULT_DRIVER_ASSIGN_COLORS
	} from '$lib/services/dispatchAdminService';
	import { formatApiError } from '$lib/utils/error';
	import { toast } from '$lib/runes/toast.svelte';
	import Icon from '@iconify/svelte';

	interface Props {
		settings: DispatchSettings;
		previewWindow: DispatchPreviewWindow | null;
		vehiclesByGroup: Record<string, string[]>;
		onSaved: (nextSettings: DispatchSettings, nextWindow: DispatchPreviewWindow) => void;
	}

	let { settings, previewWindow, vehiclesByGroup, onSaved }: Props = $props();

	function cloneWithDefaults(src: DispatchSettings): DispatchSettings {
		const copy = {
			...JSON.parse(JSON.stringify(DEFAULT_DISPATCH_SETTINGS)),
			...JSON.parse(JSON.stringify(src))
		};
		if (!copy.driver_assign_colors) {
			copy.driver_assign_colors = JSON.parse(JSON.stringify(DEFAULT_DRIVER_ASSIGN_COLORS));
		}
		if (!Array.isArray(copy.night_turn_seqs)) {
			copy.night_turn_seqs = [...(DEFAULT_DISPATCH_SETTINGS.night_turn_seqs ?? [1])];
		}
		if (!Array.isArray(copy.disciplined_drivers)) {
			copy.disciplined_drivers = [];
		}
		return copy;
	}

	let draft = $state<DispatchSettings>(untrack(() => cloneWithDefaults(settings)));
	let nightTurnSeqsText = $state(untrack(() => (draft.night_turn_seqs ?? [1]).join(', ')));
	let disciplinedDriversText = $state(untrack(() => (draft.disciplined_drivers ?? []).join(', ')));
	let saving = $state(false);
	let announcing = $state(false);
	let newRuleKeywords = $state('');
	let newRuleFleetKey = $state('');

	$effect(() => {
		const next = cloneWithDefaults(settings);
		draft = next;
		nightTurnSeqsText = (next.night_turn_seqs ?? [1]).join(', ');
		disciplinedDriversText = (next.disciplined_drivers ?? []).join(', ');
	});

	const availableFleetKeys = $derived(Object.keys(vehiclesByGroup || {}));

	async function handleSave() {
		if (saving) return;
		saving = true;
		try {
			draft.night_turn_seqs = nightTurnSeqsText
				.split(',')
				.map((s) => Number(s.trim()))
				.filter((n) => Number.isInteger(n) && n > 0);
			draft.disciplined_drivers = disciplinedDriversText
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
			const res = await dispatchApi.adminUpdateDispatchSettings(draft);
			toast.success(res.message || '배차 설정이 저장되었습니다.');
			onSaved(res.settings, res.preview_window);
		} catch (e) {
			toast.error('설정 저장 실패: ' + formatApiError(e, '오류'));
		} finally {
			saving = false;
		}
	}

	async function handleImmediateToggle(mode: 'STOP' | 'FORCE_OPEN' | 'NORMAL') {
		if (mode === 'STOP') {
			draft.preview_enabled = false;
			draft.preview_force_open = false;
		} else if (mode === 'FORCE_OPEN') {
			draft.preview_enabled = true;
			draft.preview_force_open = true;
		} else {
			draft.preview_enabled = true;
			draft.preview_force_open = false;
		}
		await handleSave();
	}

	async function handleAnnounceNow() {
		if (announcing) return;
		if (!confirm('내일(D+1) 배차를 지금 즉시 확정 고지하고 알림·웹 푸시를 발송할까요?')) return;
		announcing = true;
		try {
			const res = await dispatchApi.adminAnnounceDispatchNow();
			toast.success(res.message || '명일 배차가 고지되었습니다.');
		} catch (e) {
			toast.error('즉시 고지 실패: ' + formatApiError(e, '오류'));
		} finally {
			announcing = false;
		}
	}

	function addRouteRule() {
		const kws = newRuleKeywords
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		const fkey = newRuleFleetKey.trim();
		if (kws.length === 0 || !fkey) {
			toast.warning('노선 키워드와 차량 그룹을 모두 입력/선택해 주세요.');
			return;
		}
		draft.route_fleet_rules = [
			...(draft.route_fleet_rules || []),
			{ keywords: kws, fleet_key: fkey }
		];
		newRuleKeywords = '';
		newRuleFleetKey = '';
	}

	function removeRouteRule(idx: number) {
		draft.route_fleet_rules = draft.route_fleet_rules.filter((_, i) => i !== idx);
	}
</script>

<div class="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
	<!-- 1. 배차 예고(사전 공개) 설정 -->
	<div class="min-w-0 space-y-5 lg:col-span-6">
		<div
			class="space-y-5 rounded-[1.5rem] border-2 border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6"
		>
			<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
				<div>
					<span
						class="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-black text-white uppercase"
					>
						Preview Policy
					</span>
					<h3 class="mt-1.5 text-lg font-black text-slate-900">배차 예고 공개 설정</h3>
					<p class="text-xs font-medium text-slate-500">
						일반 사원/운전원(`custom/dispatch`)에게 공개할 예고 일수와 공개 시각을 통제합니다.
					</p>
				</div>
			</div>

			<!-- 즉시 제어 3버튼: 정상 예고 | 즉시 예고 | 예고 정지 -->
			<div class="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4">
				<span class="block text-xs font-black text-slate-800">예고 상태 즉시 제어</span>
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
					<button
						type="button"
						disabled={saving}
						onclick={() => handleImmediateToggle('NORMAL')}
						class="rounded-xl border px-3 py-2 text-xs font-black transition {draft.preview_enabled &&
						!draft.preview_force_open
							? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
							: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}"
					>
						⏱️ 예약 시각 적용
					</button>
					<button
						type="button"
						disabled={saving}
						onclick={() => handleImmediateToggle('FORCE_OPEN')}
						class="rounded-xl border px-3 py-2 text-xs font-black transition {draft.preview_enabled &&
						draft.preview_force_open
							? 'border-blue-600 bg-blue-600 text-white shadow-sm'
							: 'border-slate-300 bg-white text-slate-700 hover:bg-blue-50'}"
					>
						⚡ 즉시 예고
					</button>
					<button
						type="button"
						disabled={saving}
						onclick={() => handleImmediateToggle('STOP')}
						class="rounded-xl border px-3 py-2 text-xs font-black transition {!draft.preview_enabled
							? 'border-rose-600 bg-rose-600 text-white shadow-sm'
							: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'}"
					>
						⛔ 예고 정지
					</button>
				</div>
				{#if previewWindow}
					<div
						class="mt-2 rounded-xl px-3 py-2 text-xs font-bold {previewWindow.is_paused
							? 'bg-rose-100 text-rose-800'
							: 'bg-indigo-50 text-indigo-800'}"
					>
						현재 적용 상태: {previewWindow.reason}
					</div>
				{/if}
			</div>

			<!-- D+x, y일, 공개 시각 xx:yy -->
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div>
					<label for="disp-start-off" class="mb-1 block text-xs font-black text-slate-700">
						예고 시작 (D + X일)
					</label>
					<input
						id="disp-start-off"
						type="number"
						min="0"
						max="30"
						bind:value={draft.preview_start_offset}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900"
					/>
				</div>
				<div>
					<label for="disp-days" class="mb-1 block text-xs font-black text-slate-700">
						예고 일수 (Y일간)
					</label>
					<input
						id="disp-days"
						type="number"
						min="1"
						max="30"
						bind:value={draft.preview_days}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900"
					/>
				</div>
				<div>
					<label for="disp-open-time" class="mb-1 block text-xs font-black text-slate-700">
						예고 공개 시각 (xx:yy)
					</label>
					<input
						id="disp-open-time"
						type="time"
						bind:value={draft.preview_open_time}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900"
					/>
				</div>
			</div>

			<div>
				<label for="disp-pause-msg" class="mb-1 block text-xs font-black text-slate-700">
					예고 정지 시 안내 문구
				</label>
				<input
					id="disp-pause-msg"
					type="text"
					bind:value={draft.preview_pause_message}
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800"
				/>
			</div>
		</div>

		<!-- 배정 기사 셀 색상 강조 설정 (좌측 하단 배치로 좌우 높이 균형) -->
		{#if draft.driver_assign_colors}
			<div
				class="space-y-3 rounded-[1.5rem] border-2 border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6"
			>
				<div>
					<h4 class="text-sm font-black text-slate-900">배정 기사 셀 색상 강조 설정</h4>
					<p class="text-[11px] font-medium text-slate-500">
						조율 캔버스에서 예비기사·타차(패턴 불일치) 배정 기사의 배경색과 글자색을 지정합니다.
					</p>
				</div>

				<div class="space-y-2.5">
					{#each [{ key: 'reserve' as const, label: '예비기사 (고정 차량 없음)', sample: '홍길동(예)' }, { key: 'cross' as const, label: '타차 · 패턴 불일치 배정', sample: '김철수(타차)' }] as item (item.key)}
						{@const cfg = draft.driver_assign_colors[item.key]}
						<div
							class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs"
						>
							<label class="flex cursor-pointer items-center gap-2 font-black text-slate-800">
								<input type="checkbox" bind:checked={cfg.enabled} class="rounded text-blue-600" />
								<span>{item.label}</span>
							</label>

							<div class="flex items-center gap-2.5">
								<label class="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600">
									<span>배경</span>
									<input
										type="color"
										bind:value={cfg.bg_color}
										class="h-6 w-8 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
									/>
								</label>
								<label class="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600">
									<span>글자</span>
									<input
										type="color"
										bind:value={cfg.text_color}
										class="h-6 w-8 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
									/>
								</label>
								<span
									class="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-black"
									style={cfg.enabled
										? `background-color: ${cfg.bg_color}; color: ${cfg.text_color};`
										: ''}
								>
									{item.sample}
								</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- 2. 명일 배차 자동 고지 + 노선 매핑 & 표시 옵션 -->
	<div class="min-w-0 space-y-5 lg:col-span-6">
		<div
			class="space-y-4 rounded-[1.5rem] border-2 border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6"
		>
			<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
				<div>
					<span
						class="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black text-white uppercase"
					>
						Auto Announce & Push
					</span>
					<h3 class="mt-1.5 text-lg font-black text-slate-900">명일 배차 자동 고지 · 알림 설정</h3>
					<p class="text-xs font-medium text-slate-500">
						D-1일 설정 시각에 내일(D+1) 배차를 자동 확정하고 인앱 알림·웹 푸시를 발송합니다.
					</p>
				</div>
				<button
					type="button"
					disabled={announcing}
					onclick={handleAnnounceNow}
					class="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
				>
					<Icon icon="solar:bell-bing-bold" class="text-sm" />
					<span>{announcing ? '발송 중...' : '명일 배차 즉시 고지'}</span>
				</button>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<label
					class="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
				>
					<span class="text-xs font-black text-slate-800">D-1 자동 고지 활성화</span>
					<input
						type="checkbox"
						bind:checked={draft.auto_announce_enabled}
						class="toggle toggle-primary toggle-sm"
					/>
				</label>

				<div>
					<label for="disp-ann-time" class="mb-1 block text-xs font-black text-slate-700">
						자동 고지 시각 (D-1일 xx:yy)
					</label>
					<input
						id="disp-ann-time"
						type="time"
						bind:value={draft.auto_announce_time}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900"
					/>
				</div>
			</div>

			<div
				class="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-700"
			>
				<label class="flex cursor-pointer items-center gap-2">
					<input
						type="checkbox"
						bind:checked={draft.auto_announce_push}
						class="rounded text-blue-600"
					/>
					<span>고지 시 전 직원 인앱 알림 및 웹 푸시 알림 자동 발송</span>
				</label>
				<label class="flex cursor-pointer items-center gap-2">
					<input
						type="checkbox"
						bind:checked={draft.auto_announce_skip_if_confirmed}
						class="rounded text-blue-600"
					/>
					<span>이미 전 노선이 확정(CONFIRMED)된 경우 자동 고지 중복 실행 건너뛰기</span>
				</label>
				<label class="flex cursor-pointer items-center gap-2">
					<input
						type="checkbox"
						bind:checked={draft.show_substitute_columns}
						class="rounded text-blue-600"
					/>
					<span>사용자 배차표(`custom/dispatch`)에 대인·대차 빈 셀 표시</span>
				</label>
			</div>
		</div>

		<!-- 노선-차량 그룹 매핑 규칙 -->
		<div
			class="space-y-3 rounded-[1.5rem] border-2 border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6"
		>
			<div>
				<h4 class="text-sm font-black text-slate-900">노선별 전담 차량 그룹 매핑</h4>
				<p class="text-[11px] font-medium text-slate-500">
					노선명에 키워드가 포함되면 해당 차량 풀(`vehicles.json`)을 자동 매핑합니다.
				</p>
			</div>

			<div class="space-y-2">
				{#each draft.route_fleet_rules || [] as rule, idx (idx)}
					<div
						class="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
					>
						<div class="flex flex-wrap items-center gap-1.5">
							<span class="font-black text-indigo-700">{rule.keywords.join(', ')}</span>
							<span class="text-slate-400">→</span>
							<span class="rounded bg-white px-2 py-0.5 font-mono font-bold text-slate-800">
								{rule.fleet_key}
							</span>
						</div>
						<button
							type="button"
							onclick={() => removeRouteRule(idx)}
							class="text-[11px] font-black text-rose-500 hover:text-rose-700"
						>
							삭제
						</button>
					</div>
				{/each}
			</div>

			<div class="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
				<input
					type="text"
					bind:value={newRuleKeywords}
					placeholder="노선 키워드 (예: 121, 122)"
					class="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold sm:min-w-[140px] sm:flex-1"
				/>
				<select
					bind:value={newRuleFleetKey}
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold sm:w-auto"
				>
					<option value="">-- 차량 그룹 --</option>
					{#each availableFleetKeys as fk (fk)}
						<option value={fk}>{fk}</option>
					{/each}
				</select>
				<button
					type="button"
					onclick={addRouteRule}
					class="w-full rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-700 sm:w-auto"
				>
					규칙 추가
				</button>
			</div>
		</div>
	</div>

	<!-- 투입 기사 공정배분 & 정합성 검증 설정 -->
	<div
		class="min-w-0 space-y-4 rounded-[1.5rem] border-2 border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6 lg:col-span-12"
	>
		<div class="flex flex-wrap items-center justify-between gap-2">
			<div>
				<h4 class="text-sm font-black text-slate-900">투입 기사 공정배분 &amp; 정합성 검증 설정</h4>
				<p class="text-[11px] font-medium text-slate-500">
					대기 기사 보드의 4그룹 분류·공정 정렬 기준과 조율 캔버스 배정 시 블링크 경고 정책을
					설정합니다.
				</p>
			</div>
			<label
				class="flex cursor-pointer items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-800"
			>
				<input
					type="checkbox"
					bind:checked={draft.enable_validation_blink}
					class="rounded text-rose-600"
				/>
				<span>정합성 위반 셀 블링크 경고</span>
			</label>
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<!-- 1. 근무 정책 기준 -->
			<div class="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
				<h5 class="text-xs font-black text-slate-800">근무 정책 기준</h5>
				<div class="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
					<label class="min-w-0 space-y-1 font-bold text-slate-600">
						<span>주 최대 근무일 (일)</span>
						<input
							type="number"
							min="1"
							max="7"
							bind:value={draft.max_weekly_work_days}
							class="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-black text-slate-900"
						/>
					</label>
					<label class="min-w-0 space-y-1 font-bold text-slate-600">
						<span>주간 집계 기준</span>
						<select
							bind:value={draft.weekly_basis}
							class="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-black text-slate-900"
						>
							<option value="calendar_week">달력 주 (일~토)</option>
							<option value="rolling_7d">최근 7일</option>
						</select>
					</label>
				</div>
				<label class="block space-y-1 text-xs font-bold text-slate-600">
					<span>전일 퇴근 후 최소 휴식 (시간)</span>
					<input
						type="number"
						min="0"
						max="24"
						bind:value={draft.min_rest_hours}
						class="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-black text-slate-900"
					/>
				</label>
				<label class="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
					<input
						type="checkbox"
						bind:checked={draft.stats_include_draft}
						class="rounded text-blue-600"
					/>
					<span>임시저장(DRAFT) 배차도 실적에 포함</span>
				</label>
				<label class="flex cursor-pointer items-center gap-2 text-xs font-bold text-rose-700">
					<input
						type="checkbox"
						bind:checked={draft.warn_prev_day_work}
						class="rounded text-rose-600"
					/>
					<span>전일 근무자 투입 경고 (8시간 경과 포함)</span>
				</label>
			</div>

			<!-- 2. 야간 근무 산정 기준 -->
			<div class="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
				<h5 class="text-xs font-black text-slate-800">야간 근무 산정 기준</h5>
				<label class="block space-y-1 text-xs font-bold text-slate-600">
					<span>산정 방식</span>
					<select
						bind:value={draft.night_metric_mode}
						class="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-black text-slate-900"
					>
						<option value="turn_count">로번 횟수 (첫차/막차)</option>
						<option value="time_range">시간대 합산 (조조/심야)</option>
					</select>
				</label>
				{#if draft.night_metric_mode === 'time_range'}
					<div class="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
						<label class="min-w-0 space-y-1 font-bold text-slate-600">
							<span>오전 야간 종료</span>
							<input
								type="text"
								bind:value={draft.night_morning_end}
								placeholder="06:00"
								class="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-black text-slate-900"
							/>
						</label>
						<label class="min-w-0 space-y-1 font-bold text-slate-600">
							<span>저녁 야간 시작</span>
							<input
								type="text"
								bind:value={draft.night_evening_start}
								placeholder="21:00"
								class="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-black text-slate-900"
							/>
						</label>
					</div>
				{:else}
					<label class="block space-y-1 text-xs font-bold text-slate-600">
						<span>야간 로번 번호 (쉼표 구분)</span>
						<input
							type="text"
							bind:value={nightTurnSeqsText}
							placeholder="1"
							class="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-black text-slate-900"
						/>
					</label>
					<label class="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
						<input
							type="checkbox"
							bind:checked={draft.night_include_last_turn}
							class="rounded text-blue-600"
						/>
						<span>각 노선 마지막 로번(막차) 포함</span>
					</label>
				{/if}
			</div>

			<!-- 3. 징계 대상 기사 관리 -->
			<div class="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
				<h5 class="text-xs font-black text-slate-800">징계 기사 임시 지정</h5>
				<p class="text-[11px] font-medium text-slate-500">
					별도 징계 테이블 도입 전까지 4그룹(병가·징계)으로 분류할 기사 성명을 쉼표로 입력합니다.
				</p>
				<textarea
					rows={3}
					bind:value={disciplinedDriversText}
					placeholder="예: 홍길동, 김철수"
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900"
				></textarea>
			</div>
		</div>
	</div>

	<!-- 하단 저장 버튼 -->
	<div class="flex justify-end lg:col-span-12">
		<button
			type="button"
			disabled={saving}
			onclick={handleSave}
			class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-7 py-3 text-sm font-black text-white shadow-lg transition hover:bg-blue-600 disabled:opacity-50 sm:w-auto"
		>
			<Icon icon="solar:diskette-bold" class="text-base" />
			<span>{saving ? '저장 중...' : '배차 설정 전체 저장'}</span>
		</button>
	</div>
</div>

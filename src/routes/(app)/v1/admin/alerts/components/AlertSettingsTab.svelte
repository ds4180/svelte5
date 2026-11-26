<script lang="ts">
	/**
	 * ============================================================================
	 * [알림·지시 관리 — 정책 설정 탭 (AlertSettingsTab.svelte)]
	 * ============================================================================
	 */
	import Icon from '@iconify/svelte';
	import { adminUpdateAlertSettings } from '$lib/api/admin';
	import { toast } from '$lib/runes/toast.svelte';
	import { setAlertMediaPolicy } from '$lib/utils/sound';
	import {
		DEFAULT_ALERT_SETTINGS,
		type AlertSettings
	} from '$lib/services/alertAdminService';

	interface Props {
		settings: AlertSettings;
		onSaved?: (nextSettings: AlertSettings) => void;
	}

	let { settings, onSaved }: Props = $props();

	let draft = $state<AlertSettings>(JSON.parse(JSON.stringify(DEFAULT_ALERT_SETTINGS)));
	let saving = $state(false);

	$effect(() => {
		draft = JSON.parse(
			JSON.stringify({
				...DEFAULT_ALERT_SETTINGS,
				...(settings || {}),
				category_labels: {
					...DEFAULT_ALERT_SETTINGS.category_labels,
					...(settings?.category_labels || {})
				}
			})
		);
	});

	async function handleSave() {
		if (saving) return;
		saving = true;
		try {
			const res = await adminUpdateAlertSettings(draft);
			const saved = res?.settings || draft;
			setAlertMediaPolicy({
				enableSound: saved.enable_sound,
				enableVibration: saved.enable_vibration
			});
			toast.success('알림·지시 기본 정책이 저장되었습니다.');
			onSaved?.(saved);
		} catch (e) {
			console.error('❌ [AlertSettingsTab] 설정 저장 실패:', e);
		} finally {
			saving = false;
		}
	}

	function handleResetDefaults() {
		draft = JSON.parse(JSON.stringify(DEFAULT_ALERT_SETTINGS));
		toast.info('기본값으로 되돌렸습니다. [설정 저장]을 눌러 반영하세요.');
	}
</script>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
	<!-- 좌측: 기본 발행 정책 -->
	<div class="space-y-5 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-6">
		<div class="border-b border-slate-100 pb-4">
			<span class="rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-black text-white uppercase">
				Default Policy
			</span>
			<h3 class="mt-1.5 text-lg font-black text-slate-900">기본 발행 · 노출 정책</h3>
			<p class="text-xs font-medium text-slate-500">
				새 알림/지시 생성 모달과 서버 기본값에 적용되는 전역 정책입니다.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div>
				<label for="al-dur" class="mb-1 block text-xs font-black text-slate-700">
					기본 노출 기간 (일)
				</label>
				<input
					id="al-dur"
					type="number"
					min="1"
					max="90"
					bind:value={draft.default_duration_days}
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900"
				/>
			</div>
			<div>
				<label for="al-read" class="mb-1 block text-xs font-black text-slate-700">
					L4~L5 강제 정독 시간 (초)
				</label>
				<input
					id="al-read"
					type="number"
					min="0"
					max="30"
					bind:value={draft.mandatory_read_seconds}
					class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900"
				/>
			</div>
			<div>
				<label for="al-lvl" class="mb-1 block text-xs font-black text-slate-700">
					기본 알림 레벨 (1~5)
				</label>
				<select
					id="al-lvl"
					bind:value={draft.default_level}
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900"
				>
					<option value={1}>L1 (일반 토스트)</option>
					<option value={2}>L2 (상단 배너)</option>
					<option value={3}>L3 (모달 지시)</option>
					<option value={4}>L4 (강제 정독)</option>
					<option value={5}>L5 (시스템 락)</option>
				</select>
			</div>
			<div>
				<label for="al-style" class="mb-1 block text-xs font-black text-slate-700">
					기본 스타일
				</label>
				<select
					id="al-style"
					bind:value={draft.default_style}
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900"
				>
					<option value="info">info (파랑)</option>
					<option value="success">success (초록)</option>
					<option value="warning">warning (노랑)</option>
					<option value="error">error (빨강)</option>
				</select>
			</div>
			<div>
				<label for="al-urg-lvl" class="mb-1 block text-xs font-black text-slate-700">
					긴급 공지 최소 레벨
				</label>
				<select
					id="al-urg-lvl"
					bind:value={draft.urgent_min_level}
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900"
				>
					<option value={1}>L1 이상</option>
					<option value={2}>L2 이상</option>
					<option value={3}>L3 이상 (모달)</option>
					<option value={4}>L4 이상 (정독)</option>
					<option value={5}>L5 (시스템 락)</option>
				</select>
			</div>
			<div>
				<label for="al-urg-style" class="mb-1 block text-xs font-black text-slate-700">
					긴급 공지 기본 스타일
				</label>
				<select
					id="al-urg-style"
					bind:value={draft.urgent_default_style}
					class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900"
				>
					<option value="error">error (빨강)</option>
					<option value="warning">warning (노랑)</option>
					<option value="info">info (파랑)</option>
				</select>
			</div>
		</div>

		<div>
			<label for="al-confirm" class="mb-1 block text-xs font-black text-slate-700">
				기본 수신 확인 버튼 문구
			</label>
			<input
				id="al-confirm"
				type="text"
				bind:value={draft.default_confirm_text}
				class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
			/>
		</div>
	</div>

	<!-- 우측: 알림함 연동 & 라벨 설정 -->
	<div class="space-y-5 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-6">
		<div class="border-b border-slate-100 pb-4">
			<span class="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black text-white uppercase">
				Inbox &amp; Push
			</span>
			<h3 class="mt-1.5 text-lg font-black text-slate-900">알림함(미니앱) · 웹푸시 연동 정책</h3>
			<p class="text-xs font-medium text-slate-500">
				`core.notify`를 통한 사원 알림함 적재 형식과 기본 체크 상태를 제어합니다.
			</p>
		</div>

		<div class="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-700">
			<label class="flex cursor-pointer items-center gap-2.5">
				<input
					type="checkbox"
					bind:checked={draft.default_save_to_inbox}
					class="checkbox checkbox-success checkbox-xs rounded"
				/>
				<span>새 알림 생성 시 기본적으로 사원 알림함(미니앱 피드)에 기록 남기기</span>
			</label>
			<label class="flex cursor-pointer items-center gap-2.5">
				<input
					type="checkbox"
					bind:checked={draft.default_send_web_push}
					class="checkbox checkbox-primary checkbox-xs rounded"
				/>
				<span>새 알림 생성 시 브라우저 웹 푸시(Web Push) 기본 체크 (pushs/config 기본값보다 우선)</span>
			</label>
			<div class="grid grid-cols-1 gap-2 border-t border-slate-200 pt-2.5 sm:grid-cols-2">
				<label class="flex cursor-pointer items-center gap-2.5">
					<input
						type="checkbox"
						bind:checked={draft.enable_sound}
						class="checkbox checkbox-warning checkbox-xs rounded"
					/>
					<span>알림 수신 시 소리(효과음) 사용</span>
				</label>
				<label class="flex cursor-pointer items-center gap-2.5">
					<input
						type="checkbox"
						bind:checked={draft.enable_vibration}
						class="checkbox checkbox-warning checkbox-xs rounded"
					/>
					<span>알림 수신 시 진동(모바일) 사용</span>
				</label>
			</div>
		</div>

		<div>
			<label for="al-tmax" class="mb-1 block text-xs font-black text-slate-700">
				알림함 제목 요약 길이 (자)
			</label>
			<input
				id="al-tmax"
				type="number"
				min="10"
				max="80"
				bind:value={draft.title_max_length}
				class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900"
			/>
		</div>

		<div class="space-y-2.5">
			<span class="block text-xs font-black text-slate-700">카테고리별 알림함 접두 라벨</span>
			<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
				<div>
					<label for="al-lbl-notice" class="mb-1 block text-[11px] font-bold text-slate-500">
						일반 공지 (NOTICE)
					</label>
					<input
						id="al-lbl-notice"
						type="text"
						bind:value={draft.category_labels.NOTICE}
						class="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-900"
					/>
				</div>
				<div>
					<label for="al-lbl-urgent" class="mb-1 block text-[11px] font-bold text-slate-500">
						중요 공지 (URGENT)
					</label>
					<input
						id="al-lbl-urgent"
						type="text"
						bind:value={draft.category_labels.URGENT_NOTICE}
						class="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-900"
					/>
				</div>
				<div>
					<label for="al-lbl-inst" class="mb-1 block text-[11px] font-bold text-slate-500">
						지시사항 (INSTRUCTION)
					</label>
					<input
						id="al-lbl-inst"
						type="text"
						bind:value={draft.category_labels.INSTRUCTION}
						class="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-900"
					/>
				</div>
			</div>
		</div>

		<div class="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
			<button
				type="button"
				onclick={handleResetDefaults}
				class="btn btn-sm rounded-xl border border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-50"
			>
				기본값 초기화
			</button>
			<button
				type="button"
				disabled={saving}
				onclick={handleSave}
				class="btn btn-sm rounded-xl border-none bg-slate-900 px-5 font-black text-white shadow-sm hover:bg-blue-600 disabled:opacity-50"
			>
				<Icon icon="solar:diskette-bold" class="h-4 w-4" />
				<span>{saving ? '저장 중...' : '설정 저장'}</span>
			</button>
		</div>
	</div>
</div>

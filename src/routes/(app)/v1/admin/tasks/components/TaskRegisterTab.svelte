<script lang="ts">
	/**
	 * ============================================================================
	 * [태스크 관제 — 3단계 작업 예약 등록 위저드 (TaskRegisterTab.svelte)]
	 * ============================================================================
	 * - 정책 설정(default_priority, default_max_retries, default_timeout_sec, cron_presets)을
	 *   기본값으로 반영하며, 누락되어 있던 '일정 간격(초) 반복' 모드까지 4대 모드를 완비합니다.
	 */
	import Icon from '@iconify/svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import {
		parseJsonPayloadSafe,
		type TaskSettings,
		type TaskTypeMeta
	} from '$lib/services/taskAdminService';
	import { toLocalISOString } from '$lib/utils';

	interface Props {
		taskTypes: TaskTypeMeta[];
		settings: TaskSettings;
		onSubmitTask: (payload: Record<string, any>, label: string, isRecurring: boolean) => Promise<void>;
		onCancel: () => void;
	}

	let { taskTypes = [], settings, onSubmitTask, onCancel }: Props = $props();

	let scheduleMode = $state<'once_now' | 'daily' | 'interval' | 'specific_time'>('once_now');
	let selectedTypeItem = $state<TaskTypeMeta | null>(null);
	let showAdvancedOptions = $state(false);
	let isSubmitting = $state(false);

	let form = $state({
		task_type: '',
		payload_str: '{}',
		priority: 5,
		unique_key: '',
		scheduled_at: '',
		cron_expression: '',
		repeat_interval: 300 as number | null,
		max_retries: 3,
		timeout_sec: 300,
		tags_str: ''
	});

	$effect(() => {
		form.priority = settings.default_priority;
		form.max_retries = settings.default_max_retries;
		form.timeout_sec = settings.default_timeout_sec;
	});

	$effect(() => {
		if (taskTypes.length > 0 && !form.task_type) {
			selectTaskType(taskTypes[0]);
		}
	});

	function selectTaskType(item: TaskTypeMeta) {
		selectedTypeItem = item;
		form.task_type = item.type;
		form.payload_str = JSON.stringify(item.example || {}, null, 2);
	}

	function applyCronPreset(cron: string) {
		scheduleMode = 'daily';
		form.cron_expression = cron;
		toast.info(`스케줄이 '${cron}'으로 설정되었습니다.`);
	}

	async function handleRegister() {
		if (!form.task_type) {
			toast.error('수행할 작업 종류를 선택해 주세요.');
			return;
		}
		const parsed = parseJsonPayloadSafe(form.payload_str);
		if (!parsed.ok) {
			toast.error(parsed.error);
			return;
		}

		let finalCron: string | null = null;
		let finalInterval: number | null = null;
		let finalScheduledAt: string | null = null;

		if (scheduleMode === 'daily') {
			finalCron = form.cron_expression.trim() || '0 3 * * *';
		} else if (scheduleMode === 'interval') {
			finalInterval = Math.max(10, Number(form.repeat_interval) || 300);
		} else if (scheduleMode === 'specific_time') {
			if (!form.scheduled_at) {
				toast.warning('예약 실행 일시를 지정해 주세요.');
				return;
			}
			finalScheduledAt = toLocalISOString(form.scheduled_at);
		}

		const body = {
			task_type: form.task_type,
			payload: parsed.data,
			priority: Number(form.priority) || settings.default_priority,
			unique_key: form.unique_key.trim() || null,
			scheduled_at: finalScheduledAt,
			cron_expression: finalCron,
			repeat_interval: finalInterval,
			max_retries: Number(form.max_retries ?? settings.default_max_retries),
			timeout_sec: Number(form.timeout_sec || settings.default_timeout_sec),
			tags: form.tags_str
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean)
		};

		isSubmitting = true;
		try {
			await onSubmitTask(
				body,
				selectedTypeItem?.label || form.task_type,
				Boolean(finalCron || finalInterval)
			);
			scheduleMode = 'once_now';
			form.cron_expression = '';
			form.scheduled_at = '';
			form.unique_key = '';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="p-5 sm:p-6 md:p-8 space-y-8 max-w-4xl">
	<div class="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-xs font-medium text-blue-900">
		<div class="flex items-center gap-2 font-black text-sm text-blue-700">
			<Icon icon="solar:info-circle-bold" class="text-lg shrink-0" />
			<span>백그라운드 워커에게 지시할 작업을 선택하세요</span>
		</div>
		<p class="mt-1 text-slate-600">
			기본 우선순위({settings.default_priority}), 최대 재시도({settings.default_max_retries}회), 제한시간({settings.default_timeout_sec}초)은 정책 설정값이 자동 적용됩니다.
		</p>
	</div>

	<!-- 1단계: 작업 종류 선택 -->
	<div>
		<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
			<span class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-black text-white">1</span>
			작업 종류 선택 ({taskTypes.length}종)
		</h3>

		<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#each taskTypes as item (item.type)}
				<button
					type="button"
					onclick={() => selectTaskType(item)}
					class="flex items-start gap-3 rounded-xl border-2 p-4 text-left transition {form.task_type === item.type ? 'border-blue-600 bg-blue-50/40 shadow-xs ring-2 ring-blue-500/20' : 'border-slate-200 bg-white hover:border-slate-300'}"
				>
					<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
						<Icon icon={item.icon} class="text-xl" />
					</span>
					<span class="block min-w-0">
						<span class="block text-xs font-black text-slate-900">{item.label}</span>
						<span class="mt-1 block text-[11px] text-slate-500 leading-relaxed">{item.description}</span>
						<span class="mt-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
							{item.type}
						</span>
					</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- 2단계: 실행 주기 및 시점 선택 (4대 모드) -->
	<div>
		<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
			<span class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-black text-white">2</span>
			실행 주기 및 시점 선택
		</h3>

		<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<label class="flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3.5 transition {scheduleMode === 'once_now' ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200 bg-white'}">
				<input type="radio" bind:group={scheduleMode} value="once_now" class="h-4 w-4 text-blue-600" />
				<div>
					<div class="text-xs font-black text-slate-900">⚡ 즉시 1회 실행</div>
					<span class="text-[10px] text-slate-400">큐 진입 즉시 처리</span>
				</div>
			</label>

			<label class="flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3.5 transition {scheduleMode === 'daily' ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200 bg-white'}">
				<input type="radio" bind:group={scheduleMode} value="daily" class="h-4 w-4 text-blue-600" />
				<div>
					<div class="text-xs font-black text-slate-900">⏰ Cron 정기 반복</div>
					<span class="text-[10px] text-slate-400">지정 시각 자동 순환</span>
				</div>
			</label>

			<label class="flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3.5 transition {scheduleMode === 'interval' ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200 bg-white'}">
				<input type="radio" bind:group={scheduleMode} value="interval" class="h-4 w-4 text-blue-600" />
				<div>
					<div class="text-xs font-black text-slate-900">🔁 초 단위 주기 반복</div>
					<span class="text-[10px] text-slate-400">일정 간격 연속 실행</span>
				</div>
			</label>

			<label class="flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3.5 transition {scheduleMode === 'specific_time' ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200 bg-white'}">
				<input type="radio" bind:group={scheduleMode} value="specific_time" class="h-4 w-4 text-blue-600" />
				<div>
					<div class="text-xs font-black text-slate-900">📅 특정 일시 예약</div>
					<span class="text-[10px] text-slate-400">미래 시점 1회 실행</span>
				</div>
			</label>
		</div>

		{#if scheduleMode === 'daily'}
			<div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
				<div>
					<label for="reg-cron" class="block text-xs font-black text-slate-700 mb-1">Cron 표현식 직접 입력 또는 프리셋 선택:</label>
					<input
						id="reg-cron"
						type="text"
						bind:value={form.cron_expression}
						placeholder="예: 0 3 * * *"
						class="w-full sm:w-80 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
					/>
				</div>
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{#each settings.cron_presets as preset (preset.cron + preset.label)}
						<button
							type="button"
							onclick={() => applyCronPreset(preset.cron)}
							class="flex flex-col rounded-lg border bg-white p-3 text-left transition hover:border-blue-500 {form.cron_expression === preset.cron ? 'border-blue-600 bg-blue-50/30' : 'border-slate-200'}"
						>
							<div class="text-xs font-bold text-slate-900">{preset.label}</div>
							<span class="text-[10px] text-slate-400 mt-0.5">{preset.desc} (<code>{preset.cron}</code>)</span>
						</button>
					{/each}
				</div>
			</div>
		{:else if scheduleMode === 'interval'}
			<div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center gap-3">
				<div>
					<label for="reg-interval" class="block text-xs font-black text-slate-700 mb-1">반복 주기 (초, 최소 10초):</label>
					<input
						id="reg-interval"
						type="number"
						min="10"
						max="86400"
						bind:value={form.repeat_interval}
						class="w-48 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800"
					/>
				</div>
				<div class="flex flex-wrap gap-1.5 pt-4">
					{#each [60, 300, 600, 1800, 3600] as sec (sec)}
						<button
							type="button"
							onclick={() => (form.repeat_interval = sec)}
							class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:border-blue-500"
						>
							{sec >= 3600 ? `${sec / 3600}시간` : `${sec / 60}분`} ({sec}초)
						</button>
					{/each}
				</div>
			</div>
		{:else if scheduleMode === 'specific_time'}
			<div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
				<label for="schedAtInput" class="block text-xs font-black text-slate-700 mb-1">예약 실행 일시:</label>
				<input
					type="datetime-local"
					id="schedAtInput"
					bind:value={form.scheduled_at}
					class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
				/>
			</div>
		{/if}
	</div>

	<!-- 3단계: 고급 엔지니어링 옵션 -->
	<div class="border-t border-slate-200 pt-4">
		<button
			type="button"
			onclick={() => (showAdvancedOptions = !showAdvancedOptions)}
			class="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"
		>
			<Icon icon={showAdvancedOptions ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} />
			<span>고급 엔지니어링 옵션 (우선순위, 제한시간, JSON Payload 등) {showAdvancedOptions ? '접기' : '펼치기'}</span>
		</button>

		{#if showAdvancedOptions}
			<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-xl bg-slate-50 p-5 border border-slate-200">
				<div>
					<label for="adv-prio" class="block text-xs font-bold text-slate-700 mb-1">우선순위 (1~10):</label>
					<input
						id="adv-prio"
						type="number"
						min="1"
						max="10"
						bind:value={form.priority}
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
					/>
				</div>
				<div>
					<label for="adv-retry" class="block text-xs font-bold text-slate-700 mb-1">최대 재시도 횟수:</label>
					<input
						id="adv-retry"
						type="number"
						min="0"
						max="10"
						bind:value={form.max_retries}
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
					/>
				</div>
				<div>
					<label for="adv-timeout" class="block text-xs font-bold text-slate-700 mb-1">제한시간 (초):</label>
					<input
						id="adv-timeout"
						type="number"
						min="10"
						max="3600"
						bind:value={form.timeout_sec}
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
					/>
				</div>
				<div class="sm:col-span-2">
					<label for="uniqKeyInput" class="block text-xs font-bold text-slate-700 mb-1">중복 방지 고유키 (Unique Key):</label>
					<input
						type="text"
						id="uniqKeyInput"
						bind:value={form.unique_key}
						placeholder="선택 사항: 동일 키 대기 중복 차단"
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-800"
					/>
				</div>
				<div>
					<label for="adv-tags" class="block text-xs font-bold text-slate-700 mb-1">태그 (쉼표 구분):</label>
					<input
						id="adv-tags"
						type="text"
						bind:value={form.tags_str}
						placeholder="manual, maintenance"
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
					/>
				</div>
				<div class="sm:col-span-3">
					<label for="payloadInput" class="block text-xs font-bold text-slate-700 mb-1">전달 매개변수 (JSON Payload):</label>
					<textarea
						id="payloadInput"
						bind:value={form.payload_str}
						rows="3"
						class="w-full rounded-xl border border-slate-300 bg-slate-900 p-3 font-mono text-xs text-emerald-400 focus:outline-none"
					></textarea>
				</div>
			</div>
		{/if}
	</div>

	<div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
		<button
			type="button"
			onclick={onCancel}
			class="rounded-xl border border-slate-300 px-5 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
		>
			취소
		</button>
		<button
			type="button"
			onclick={handleRegister}
			disabled={isSubmitting}
			class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-blue-700 active:scale-95 disabled:opacity-50"
		>
			<Icon icon="solar:check-circle-bold" class="text-base" />
			<span>{isSubmitting ? '등록 중...' : '워커에게 작업 지시하기'}</span>
		</button>
	</div>
</div>

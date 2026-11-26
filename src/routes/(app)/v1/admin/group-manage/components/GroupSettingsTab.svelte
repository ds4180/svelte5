<script lang="ts">
	/**
	 * ============================================================================
	 * [그룹·권한 관리 — 비즈니스 정책 설정 탭 (GroupSettingsTab.svelte)]
	 * ============================================================================
	 * - 보호 그룹 잠금 목록, 사용 중 그룹 삭제 차단/Cascade 전환, 사용자 부그룹 배정 한도,
	 *   주/부그룹 중복·유형 강제, 신규 그룹 생성 기본값, 페이지 쓰기 기본 랭크,
	 *   감사로그 기록 및 진입 기본 탭을 동적으로 제어합니다.
	 */
	import Icon from '@iconify/svelte';
	import { adminUpdateAuthGroupSettings } from '$lib/api/admin';
	import { toast } from '$lib/runes/toast.svelte';
	import {
		DEFAULT_GROUP_MANAGE_SETTINGS,
		normalizeGroupManageSettings,
		type GroupItem,
		type GroupManageSettings
	} from '$lib/services/groupAdminService';
	import { formatApiError } from '$lib/utils/error';

	interface Props {
		settings: GroupManageSettings;
		allGroups: GroupItem[];
		canWrite: boolean;
		onSaved: (updated: GroupManageSettings) => void;
	}

	let { settings, allGroups = [], canWrite = false, onSaved }: Props = $props();

	let draft = $state<GroupManageSettings>(
		normalizeGroupManageSettings(DEFAULT_GROUP_MANAGE_SETTINGS)
	);
	let newProtectedCode = $state('');
	let isSaving = $state(false);

	$effect(() => {
		draft = normalizeGroupManageSettings(settings);
	});

	function handleResetDefaults() {
		draft = normalizeGroupManageSettings(DEFAULT_GROUP_MANAGE_SETTINGS);
		toast.info('기본 권장 그룹 정책값을 불러왔습니다. [정책 설정 저장]을 눌러 반영하세요.');
	}

	function addProtectedCode(codeInput?: string) {
		const cleaned = (codeInput ?? newProtectedCode).trim();
		if (!cleaned) return;
		if (!draft.protected_group_codes.includes(cleaned)) {
			draft.protected_group_codes = [...draft.protected_group_codes, cleaned];
		}
		if (codeInput === undefined) newProtectedCode = '';
	}

	function removeProtectedCode(code: string) {
		draft.protected_group_codes = draft.protected_group_codes.filter((c) => c !== code);
	}

	async function handleSave() {
		if (!canWrite) return;
		isSaving = true;
		try {
			const res = await adminUpdateAuthGroupSettings<{
				settings: GroupManageSettings;
				message?: string;
			}>(draft);
			const normalized = normalizeGroupManageSettings(res?.settings ?? draft);
			onSaved(normalized);
			toast.success(res?.message || '그룹·권한 관리 정책 설정이 저장되었습니다.');
		} catch (err) {
			toast.error(formatApiError(err, '그룹 정책 설정 저장에 실패했습니다.'));
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- 상단 안내 배너 -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 sm:p-5">
		<div class="space-y-1">
			<div class="flex items-center gap-2 text-sm font-black text-indigo-900">
				<Icon icon="solar:settings-minimalistic-bold-duotone" class="text-xl text-indigo-600" />
				<span>조직 · 권한 그룹 거버넌스 통합 정책 설정</span>
			</div>
			<p class="text-xs text-slate-600 leading-relaxed">
				저장 즉시 그룹 삭제 보호, 사용자 주/부그룹 배정 검증, 신규 그룹 생성 기본값 및 감사로그 기록 규칙에 실시간 반영됩니다.
			</p>
		</div>
		{#if canWrite}
			<div class="flex items-center gap-2 shrink-0">
				<button
					type="button"
					onclick={handleResetDefaults}
					class="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
				>
					기본값 복원
				</button>
				<button
					type="button"
					onclick={handleSave}
					disabled={isSaving}
					class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
				>
					<Icon icon="solar:diskette-bold" class="text-sm" />
					<span>{isSaving ? '저장 중...' : '정책 설정 저장'}</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- 섹션 1: 그룹 삭제 보호 및 Cascade 안전 정책 -->
	<section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
			<div>
				<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
					<Icon icon="solar:shield-keyhole-bold-duotone" class="text-lg text-rose-600" />
					<span>1. 그룹 삭제 보호 잠금 · Cascade 정화 정책</span>
				</h3>
				<p class="mt-0.5 text-xs text-slate-500">
					핵심 시스템 그룹의 실수 삭제를 원천 차단하고, 사용 중인 그룹 삭제 시 동작 방식을 제어합니다.
				</p>
			</div>

			<label class="inline-flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 transition {draft.block_delete_in_use_group ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}">
				<input
					type="checkbox"
					bind:checked={draft.block_delete_in_use_group}
					disabled={!canWrite}
					class="h-4 w-4 rounded border-slate-300 text-amber-600"
				/>
				<div>
					<div class="text-xs font-black text-slate-800">사용 중인 그룹 삭제 차단</div>
					<div class="text-[10px] text-slate-500">해제 시 회원·인스턴스 자동 해제(Cascade) 허용</div>
				</div>
			</label>
		</div>

		<div class="space-y-3">
			<span class="block text-xs font-black text-slate-700">
				삭제 잠금 보호 그룹 코드 목록 ({draft.protected_group_codes.length}개)
			</span>
			<div class="flex flex-wrap gap-1.5">
				{#each draft.protected_group_codes as code (code)}
					<span class="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-xs font-bold text-amber-800">
						🔒 {code}
						{#if canWrite}
							<button
								type="button"
								onclick={() => removeProtectedCode(code)}
								class="text-amber-500 hover:text-rose-600"
								aria-label="{code} 보호 해제"
							>
								<Icon icon="ph:x-bold" class="text-[10px]" />
							</button>
						{/if}
					</span>
				{/each}
			</div>

			{#if canWrite}
				<div class="flex flex-wrap items-center gap-2">
					<input
						type="text"
						bind:value={newProtectedCode}
						onkeydown={(e) => e.key === 'Enter' && addProtectedCode()}
						placeholder="보호할 그룹 코드 직접 입력 (예: admin)"
						class="w-60 rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs font-bold text-slate-800"
					/>
					<button
						type="button"
						onclick={() => addProtectedCode()}
						class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
					>
						잠금 추가
					</button>
					{#if allGroups.length > 0}
						<select
							aria-label="등록된 그룹에서 빠른 선택"
							class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700"
							value=""
							onchange={(e) => {
								const v = e.currentTarget.value;
								if (v) {
									addProtectedCode(v);
									e.currentTarget.value = '';
								}
							}}
						>
							<option value="">+ 등록 그룹에서 빠른 추가</option>
							{#each allGroups.filter((g) => !draft.protected_group_codes.includes(g.code)) as g (g.code)}
								<option value={g.code}>{g.name} ({g.code})</option>
							{/each}
						</select>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	<!-- 섹션 2: 사용자 그룹 배정 제약 정책 -->
	<section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
		<div class="border-b border-slate-100 pb-4">
			<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
				<Icon icon="solar:users-group-two-rounded-bold-duotone" class="text-lg text-emerald-600" />
				<span>2. 사용자 주·부그룹 배정 제약 정책</span>
			</h3>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3 items-start">
			<div>
				<label for="grpMaxSec" class="block text-xs font-black text-slate-700 mb-1">
					1인당 최대 부그룹 배정 한도 (1~50개)
				</label>
				<input
					id="grpMaxSec"
					type="number"
					min="1"
					max="50"
					disabled={!canWrite}
					bind:value={draft.max_secondary_groups_per_user}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
				/>
			</div>

			<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 mt-4">
				<input
					type="checkbox"
					bind:checked={draft.prevent_duplicate_primary_secondary}
					disabled={!canWrite}
					class="h-4 w-4 rounded border-slate-300 text-emerald-600"
				/>
				<div>
					<div class="text-xs font-black text-slate-800">주·부그룹 동일 코드 중복 차단</div>
					<div class="text-[10px] text-slate-500">주그룹과 같은 코드의 부그룹 추가 방지</div>
				</div>
			</label>

			<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 mt-4">
				<input
					type="checkbox"
					bind:checked={draft.enforce_group_type_on_assign}
					disabled={!canWrite}
					class="h-4 w-4 rounded border-slate-300 text-emerald-600"
				/>
				<div>
					<div class="text-xs font-black text-slate-800">주/부그룹 유형 엄격 일치 강제</div>
					<div class="text-[10px] text-slate-500">PRIMARY↔주그룹, SECONDARY↔부그룹만 허용</div>
				</div>
			</label>
		</div>
	</section>

	<!-- 섹션 3: 신규 그룹 생성 및 권한 기본값 -->
	<section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
		<div class="border-b border-slate-100 pb-4">
			<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
				<Icon icon="solar:folder-with-files-bold-duotone" class="text-lg text-cyan-600" />
				<span>3. 신규 그룹 생성 · 페이지 권한 기본값</span>
			</h3>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-start">
			<div>
				<label for="grpDefType" class="block text-xs font-black text-slate-700 mb-1">신규 그룹 기본 분류</label>
				<select
					id="grpDefType"
					disabled={!canWrite}
					bind:value={draft.default_group_type}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800"
				>
					<option value="PRIMARY">PRIMARY (주그룹)</option>
					<option value="SECONDARY">SECONDARY (부그룹)</option>
				</select>
			</div>

			<div>
				<label for="grpDefCat" class="block text-xs font-black text-slate-700 mb-1">부그룹 기본 성격</label>
				<select
					id="grpDefCat"
					disabled={!canWrite}
					bind:value={draft.default_group_category}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800"
				>
					<option value="GENERAL">GENERAL (일반)</option>
					<option value="PRIVILEGE">PRIVILEGE (특권·Allow)</option>
					<option value="RESTRICTION">RESTRICTION (제재·Deny)</option>
				</select>
			</div>

			<div>
				<label for="grpPageRank" class="block text-xs font-black text-slate-700 mb-1">페이지 쓰기 기본 랭크 (0~9)</label>
				<input
					id="grpPageRank"
					type="number"
					min="0"
					max="9"
					disabled={!canWrite}
					bind:value={draft.default_page_write_rank}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800"
				/>
			</div>

			<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 mt-5">
				<input
					type="checkbox"
					bind:checked={draft.require_group_description}
					disabled={!canWrite}
					class="h-4 w-4 rounded border-slate-300 text-cyan-600"
				/>
				<span class="text-xs font-black text-slate-800">그룹 생성 시 설명 필수 입력</span>
			</label>
		</div>
	</section>

	<!-- 섹션 4: 감사로그 및 UI 진입 기본값 -->
	<section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 shadow-2xs">
		<div class="border-b border-slate-100 pb-4">
			<h3 class="text-sm font-black text-slate-900 flex items-center gap-2">
				<Icon icon="solar:widget-5-bold-duotone" class="text-lg text-indigo-600" />
				<span>4. 감사로그 기록 · 관제 화면 기본 탭</span>
			</h3>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 items-start">
			<div>
				<label for="grpDefTab" class="block text-xs font-black text-slate-700 mb-1">화면 진입 시 기본 활성 탭</label>
				<select
					id="grpDefTab"
					disabled={!canWrite}
					bind:value={draft.ui_default_main_tab}
					class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800"
				>
					<option value="group">1. 그룹 마스터</option>
					<option value="user">2. 사용자 권한</option>
					<option value="instance">3. 업무 인스턴스</option>
					<option value="system-app">4. 시스템 앱</option>
				</select>
			</div>

			<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 mt-4">
				<input
					type="checkbox"
					bind:checked={draft.audit_group_changes}
					disabled={!canWrite}
					class="h-4 w-4 rounded border-slate-300 text-indigo-600"
				/>
				<div>
					<div class="text-xs font-black text-slate-800">그룹·권한 변경 시 전사 감사로그 자동 기록</div>
					<div class="text-[10px] text-slate-500">생성·수정·삭제·회원 배정·인스턴스 권한 변경 이력 보존</div>
				</div>
			</label>
		</div>
	</section>

	{#if canWrite}
		<div class="flex items-center justify-end gap-3 pt-2">
			<button
				type="button"
				onclick={handleResetDefaults}
				class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
			>
				기본값 복원
			</button>
			<button
				type="button"
				onclick={handleSave}
				disabled={isSaving}
				class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-black text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
			>
				<Icon icon="solar:diskette-bold" class="text-base" />
				<span>{isSaving ? '저장 중...' : '정책 설정 저장'}</span>
			</button>
		</div>
	{/if}
</div>

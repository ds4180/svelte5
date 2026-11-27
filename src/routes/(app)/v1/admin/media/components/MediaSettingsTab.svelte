<script lang="ts">
	/**
	 * ============================================================================
	 * [미디어·파일 관리 — 통합 비즈니스 정책 설정 탭 (MediaSettingsTab.svelte)]
	 * ============================================================================
	 * - 업로드 용량·확장자, WebP 품질·해상도, 배포(Publish) 원본 생략,
	 *   60/30일 수명주기 및 GC 기본 항목, 계층별 접근 최소 랭크, ZIP 한도,
	 *   탐색기 기본 뷰·탭 라벨까지 모든 비즈니스 규칙을 제어합니다.
	 */
	import Icon from '@iconify/svelte';
	import { adminUpdateMediaSettings } from '$lib/api/admin';
	import { toast } from '$lib/runes/toast.svelte';
	import {
		DEFAULT_MEDIA_SETTINGS,
		getGcTaskDefinitions,
		normalizeMediaSettings,
		type MediaSettings
	} from '$lib/services/mediaAdminService';

	interface Props {
		settings: MediaSettings;
		onSaved?: (nextSettings: MediaSettings) => void;
	}

	let { settings, onSaved }: Props = $props();

	let draft = $state<MediaSettings>(normalizeMediaSettings(DEFAULT_MEDIA_SETTINGS));
	let newExtInput = $state('');
	let saving = $state(false);

	const QUICK_EXTENSION_PRESETS = [
		'.jpg',
		'.jpeg',
		'.png',
		'.gif',
		'.webp',
		'.svg',
		'.pdf',
		'.docx',
		'.xlsx',
		'.pptx',
		'.hwp',
		'.hwpx',
		'.txt',
		'.csv',
		'.zip',
		'.mp4'
	];

	$effect(() => {
		draft = JSON.parse(JSON.stringify(normalizeMediaSettings(settings)));
	});

	const gcDefs = $derived(getGcTaskDefinitions(draft));

	function addExtension(raw: string) {
		const tokens = raw
			.split(/[\s,;]+/)
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean);
		if (tokens.length === 0) return;

		const next = new Set(draft.allowed_extensions.map((e) => e.toLowerCase()));
		for (const t of tokens) {
			const normalized = t.startsWith('.') ? t : `.${t}`;
			if (/^\.[a-z0-9]+$/.test(normalized)) {
				next.add(normalized);
			}
		}
		draft.allowed_extensions = Array.from(next);
		newExtInput = '';
	}

	function removeExtension(ext: string) {
		draft.allowed_extensions = draft.allowed_extensions.filter((e) => e !== ext);
	}

	function togglePresetExtension(ext: string) {
		if (draft.allowed_extensions.includes(ext)) {
			removeExtension(ext);
		} else {
			draft.allowed_extensions = [...draft.allowed_extensions, ext];
		}
	}

	function toggleDefaultGcIndex(idx: number) {
		if (draft.default_gc_indices.includes(idx)) {
			if (draft.default_gc_indices.length === 1) {
				toast.warning('최소 1개 이상의 기본 GC 작업 항목이 선택되어야 합니다.');
				return;
			}
			draft.default_gc_indices = draft.default_gc_indices.filter((i) => i !== idx);
		} else {
			draft.default_gc_indices = [...draft.default_gc_indices, idx].sort((a, b) => a - b);
		}
	}

	async function handleSave() {
		if (saving) return;
		saving = true;
		try {
			const res = await adminUpdateMediaSettings(draft);
			const saved = normalizeMediaSettings(res?.settings || draft);
			toast.success('미디어 자산·스토리지 정책이 저장되었습니다.');
			onSaved?.(saved);
		} catch (e) {
			console.error('❌ [MediaSettingsTab] 설정 저장 실패:', e);
		} finally {
			saving = false;
		}
	}

	function handleResetDefaults() {
		draft = JSON.parse(JSON.stringify(DEFAULT_MEDIA_SETTINGS));
		toast.info('초기 기본값으로 되돌렸습니다. [정책 설정 저장]을 눌러 반영하세요.');
	}
</script>

<div class="space-y-6">
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
		<!-- 1. 업로드 용량 · 확장자 검증 정책 -->
		<section class="space-y-5 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-6">
			<div class="border-b border-slate-100 pb-4">
				<span class="rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-black text-white uppercase">
					Upload & Validation
				</span>
				<h3 class="mt-1.5 text-lg font-black text-slate-900">업로드 용량 · 확장자 검증 정책</h3>
				<p class="text-xs font-medium text-slate-500">
					사내 모든 파일 업로드 시 서버가 즉시 검증하는 파일 크기 및 허용 포맷 규칙입니다.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label for="md-max-mb" class="mb-1 block text-xs font-black text-slate-700">
						단일 파일 최대 크기 (MB)
					</label>
					<input
						id="md-max-mb"
						type="number"
						min="1"
						max="500"
						bind:value={draft.max_file_size_mb}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900"
					/>
					<p class="mt-1 text-[11px] font-medium text-slate-400">Nginx 한도(100MB) 이하 권장</p>
				</div>

				<div>
					<label for="md-def-tier" class="mb-1 block text-xs font-black text-slate-700">
						일반 사원 미지정 업로드 기본 Tier
					</label>
					<select
						id="md-def-tier"
						bind:value={draft.default_upload_tier_for_user}
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-900"
					>
						<option value="PUBLIC">PUBLIC (공개 서비스)</option>
						<option value="PROTECTED">PROTECTED (사내 보안)</option>
						<option value="PRIVATE">PRIVATE (개인 보관함)</option>
					</select>
				</div>
			</div>

			<label class="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
				<div>
					<div class="text-xs font-black text-slate-800">허용 확장자 화이트리스트 강제 검사</div>
					<div class="text-[11px] font-medium text-slate-500">
						활성화 시 아래 목록에 없는 확장자(.exe, .sh 등) 업로드를 서버에서 즉시 차단합니다.
					</div>
				</div>
				<input
					type="checkbox"
					bind:checked={draft.enforce_extension_whitelist}
					class="toggle toggle-error toggle-sm"
				/>
			</label>

			<div class="space-y-2.5">
				<div class="flex items-center justify-between">
					<span class="text-xs font-black text-slate-700">
						허용 확장자 목록 ({draft.allowed_extensions.length}개)
					</span>
					<span class="text-[10px] font-bold text-slate-400">클릭하여 제거 또는 직접 추가</span>
				</div>

				<div class="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 min-h-[52px]">
					{#each draft.allowed_extensions as ext (ext)}
						<span class="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-mono font-black text-slate-800 shadow-xs">
							{ext}
							<button
								type="button"
								onclick={() => removeExtension(ext)}
								class="text-slate-400 hover:text-rose-600 font-black"
								title="{ext} 제거"
							>
								×
							</button>
						</span>
					{/each}
				</div>

				<div class="flex gap-2">
					<input
						type="text"
						bind:value={newExtInput}
						placeholder="추가할 확장자 입력 (예: .mp4, .hwpx)"
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								addExtension(newExtInput);
							}
						}}
						class="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
					/>
					<button
						type="button"
						onclick={() => addExtension(newExtInput)}
						class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
					>
						추가
					</button>
				</div>

				<div class="flex flex-wrap items-center gap-1 pt-1">
					<span class="text-[10px] font-black text-slate-400 mr-1">빠른 토글:</span>
					{#each QUICK_EXTENSION_PRESETS as preset (preset)}
						{@const active = draft.allowed_extensions.includes(preset)}
						<button
							type="button"
							onclick={() => togglePresetExtension(preset)}
							class="rounded-md px-2 py-0.5 text-[10px] font-mono font-bold border transition-all {active
								? 'border-rose-300 bg-rose-50 text-rose-700'
								: 'border-slate-200 bg-white text-slate-400 hover:text-slate-700'}"
						>
							{preset}
						</button>
					{/each}
				</div>
			</div>
		</section>

		<!-- 2. 이미지 썸네일 · 서비스 배포(Publish) 엔진 정책 -->
		<section class="space-y-5 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-6">
			<div class="border-b border-slate-100 pb-4">
				<span class="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-black text-white uppercase">
					Image & Publish Engine
				</span>
				<h3 class="mt-1.5 text-lg font-black text-slate-900">이미지 변환 · 서비스 배포 정책</h3>
				<p class="text-xs font-medium text-slate-500">
					WebP 3종 썸네일 생성 해상도·화질 및 게시글/페이지 배포(Publish) 시 스토리지 절감 방식을 조절합니다.
				</p>
			</div>

			<div>
				<div class="mb-1 flex items-center justify-between text-xs font-black text-slate-700">
					<label for="md-webp-q">WebP 썸네일 압축 품질</label>
					<span class="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-indigo-700">{draft.webp_quality}%</span>
				</div>
				<input
					id="md-webp-q"
					type="range"
					min="40"
					max="100"
					step="1"
					bind:value={draft.webp_quality}
					class="range range-xs range-primary w-full"
				/>
				<div class="mt-1 flex justify-between text-[10px] font-bold text-slate-400">
					<span>40% (초경량)</span>
					<span>85% (표준 권장)</span>
					<span>100% (무손실급)</span>
				</div>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
				<div>
					<label for="md-sm-px" class="mb-1 block text-[11px] font-black text-slate-700">
						SM 목록용 (px)
					</label>
					<input
						id="md-sm-px"
						type="number"
						min="120"
						max="600"
						step="10"
						bind:value={draft.thumb_sm_max_px}
						class="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-sm font-mono font-black text-slate-900"
					/>
				</div>
				<div>
					<label for="md-md-px" class="mb-1 block text-[11px] font-black text-slate-700">
						MD 본문용 (px)
					</label>
					<input
						id="md-md-px"
						type="number"
						min="400"
						max="1600"
						step="50"
						bind:value={draft.thumb_md_max_px}
						class="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-sm font-mono font-black text-slate-900"
					/>
				</div>
				<div>
					<label for="md-lg-px" class="mb-1 block text-[11px] font-black text-slate-700">
						LG 상세·대체용 (px)
					</label>
					<input
						id="md-lg-px"
						type="number"
						min="1000"
						max="3840"
						step="80"
						bind:value={draft.thumb_lg_max_px}
						class="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-sm font-mono font-black text-slate-900"
					/>
				</div>
			</div>

			<label class="flex cursor-pointer items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
				<div class="pr-3">
					<div class="text-xs font-black text-slate-900">
						서비스 배포(Publish) 시 이미지 원본 복사 생략 (스토리지 90% 절감)
					</div>
					<div class="mt-0.5 text-[11px] font-medium text-slate-500 leading-relaxed">
						ON: 내 파일함에서 게시판·페이지 첨부 시 경량 WebP 썸네일 3종(SM/MD/LG)만 복제합니다.<br />
						OFF: 배포된 게시물에도 대용량 원본 이미지 파일을 함께 물리 복사합니다.
					</div>
				</div>
				<input
					type="checkbox"
					bind:checked={draft.publish_strip_image_original}
					class="toggle toggle-primary toggle-sm shrink-0"
				/>
			</label>
		</section>

		<!-- 3. 수명주기 · 보관 기한 · 가비지 컬렉션(GC) 정책 -->
		<section class="space-y-5 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-6">
			<div class="border-b border-slate-100 pb-4">
				<span class="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-black text-white uppercase">
					Lifecycle & Retention GC
				</span>
				<h3 class="mt-1.5 text-lg font-black text-slate-900">수명주기 · 보관 · GC 정책</h3>
				<p class="text-xs font-medium text-slate-500">
					원본 이미지 시한부 격리 기간과 휴지통(`.DEL_*`) 영구 파기 유예 일수를 설정합니다.
				</p>
			</div>

			<label class="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
				<div>
					<div class="text-xs font-black text-slate-800">이미지 원본 시한부 자동 격리 사용</div>
					<div class="text-[11px] font-medium text-slate-500">
						끄면(OFF) 모든 업로드 이미지 원본 파일을 기한 만료 없이 영구 보존합니다.
					</div>
				</div>
				<input
					type="checkbox"
					bind:checked={draft.enable_original_auto_expiry}
					class="toggle toggle-warning toggle-sm"
				/>
			</label>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class={!draft.enable_original_auto_expiry ? 'opacity-50 pointer-events-none' : ''}>
					<label for="md-orig-days" class="mb-1 block text-xs font-black text-slate-700">
						원본 이미지 다운로드 보관 일수
					</label>
					<input
						id="md-orig-days"
						type="number"
						min="1"
						max="3650"
						bind:value={draft.original_keep_days}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900"
					/>
					<p class="mt-1 text-[11px] font-medium text-slate-400">경과 시 .DEL_ORIG_ 소프트 격리</p>
				</div>

				<div>
					<label for="md-del-days" class="mb-1 block text-xs font-black text-slate-700">
						삭제·격리 항목 영구 파기 유예 (일)
					</label>
					<input
						id="md-del-days"
						type="number"
						min="1"
						max="365"
						bind:value={draft.isolation_retention_days}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900"
					/>
					<p class="mt-1 text-[11px] font-medium text-slate-400">
						{draft.enable_original_auto_expiry
							? `원본 최종 물리 파기: 업로드 ${draft.original_keep_days + draft.isolation_retention_days}일 후`
							: `삭제 파일 물리 파기: 격리 ${draft.isolation_retention_days}일 후`}
					</p>
				</div>
			</div>

			<div class="space-y-2">
				<span class="block text-xs font-black text-slate-700">GC 모달 기본 선택 항목</span>
				<div class="space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
					{#each gcDefs as item (item.index)}
						<label class="flex cursor-pointer items-center gap-2.5 text-xs font-bold text-slate-700">
							<input
								type="checkbox"
								checked={draft.default_gc_indices.includes(item.index)}
								onchange={() => toggleDefaultGcIndex(item.index)}
								class="checkbox checkbox-xs checkbox-primary rounded"
							/>
							<span>[{item.index}] {item.label}</span>
						</label>
					{/each}
				</div>
			</div>
		</section>

		<!-- 4. 계층별 접근 권한 · 탐색기 기본 UI · 탭 라벨 정책 -->
		<section class="space-y-5 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-6">
			<div class="border-b border-slate-100 pb-4">
				<span class="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black text-white uppercase">
					Governance & Explorer UI
				</span>
				<h3 class="mt-1.5 text-lg font-black text-slate-900">접근 랭크 · 다운로드 · 탐색기 설정</h3>
				<p class="text-xs font-medium text-slate-500">
					공용폴더·보안 계층 최소 직급(Rank), ZIP 다운로드 한도 및 탐색기 기본 UI를 설정합니다.
				</p>
			</div>

			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				<div>
					<label for="md-rk-off-r" class="mb-1 block text-[11px] font-black text-slate-700">
						공용폴더 열람 Rank
					</label>
					<input
						id="md-rk-off-r"
						type="number"
						min="1"
						max="9"
						bind:value={draft.shared_office_min_rank}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900"
					/>
				</div>
				<div>
					<label for="md-rk-off-w" class="mb-1 block text-[11px] font-black text-slate-700">
						공용폴더 쓰기 Rank
					</label>
					<input
						id="md-rk-off-w"
						type="number"
						min="1"
						max="9"
						bind:value={draft.shared_office_write_min_rank}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900"
					/>
				</div>
				<div>
					<label for="md-rk-prot" class="mb-1 block text-[11px] font-black text-slate-700">
						PROTECTED 열람 Rank
					</label>
					<input
						id="md-rk-prot"
						type="number"
						min="1"
						max="9"
						bind:value={draft.protected_min_rank}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900"
					/>
				</div>
				<div>
					<label for="md-rk-sys" class="mb-1 block text-[11px] font-black text-slate-700">
						SYSTEM 서빙 Rank
					</label>
					<input
						id="md-rk-sys"
						type="number"
						min="1"
						max="9"
						bind:value={draft.system_serve_min_rank}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900"
					/>
				</div>
				<div class="col-span-2 sm:col-span-2">
					<label for="md-zip-max" class="mb-1 block text-[11px] font-black text-slate-700">
						1회 ZIP 다운로드 최대 파일 수
					</label>
					<input
						id="md-zip-max"
						type="number"
						min="1"
						max="500"
						bind:value={draft.zip_download_max_files}
						class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900"
					/>
				</div>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<label for="md-view-mode" class="mb-1 block text-xs font-black text-slate-700">
						탐색기 기본 보기 모드
					</label>
					<select
						id="md-view-mode"
						bind:value={draft.default_view_mode}
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-900"
					>
						<option value="grid">그리드 카드 뷰 (Grid)</option>
						<option value="list">상세 테이블 뷰 (List)</option>
					</select>
				</div>

				<label class="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 mt-auto h-[38px]">
					<span class="text-xs font-black text-slate-700">기본 하위 전체 보기</span>
					<input
						type="checkbox"
						bind:checked={draft.default_recursive_view}
						class="toggle toggle-success toggle-sm"
					/>
				</label>
			</div>

			<div class="space-y-2 border-t border-slate-100 pt-3">
				<span class="block text-xs font-black text-slate-700">탐색기 탭 표시 명칭</span>
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
					<input
						type="text"
						bind:value={draft.tab_labels.SHARED}
						placeholder="SHARED 탭 명칭"
						class="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800"
					/>
					<input
						type="text"
						bind:value={draft.tab_labels.PERSONAL}
						placeholder="PERSONAL 탭 명칭"
						class="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800"
					/>
					<input
						type="text"
						bind:value={draft.tab_labels.PUBLIC}
						placeholder="PUBLIC 탭 명칭"
						class="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800"
					/>
					<input
						type="text"
						bind:value={draft.tab_labels.PROTECTED}
						placeholder="PROTECTED 탭 명칭"
						class="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800"
					/>
					<input
						type="text"
						bind:value={draft.tab_labels.SYSTEM}
						placeholder="SYSTEM 탭 명칭"
						class="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800"
					/>
					<input
						type="text"
						bind:value={draft.tab_labels.PRIVATE}
						placeholder="PRIVATE 탭 명칭"
						class="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800"
					/>
				</div>
			</div>
		</section>
	</div>

	<!-- 하단 액션 바 -->
	<div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-3xl border-2 border-slate-200 bg-white p-4 sm:px-6 shadow-sm">
		<div class="flex items-center gap-2 text-xs font-bold text-slate-500">
			<Icon icon="ph:info-bold" class="text-base text-rose-600 shrink-0" />
			<span>저장 즉시 업로드 검증, 썸네일 변환, 배포 엔진, 보안 서빙 및 GC 스케줄러에 실시간 반영됩니다.</span>
		</div>
		<div class="flex items-center justify-end gap-2.5 shrink-0">
			<button
				type="button"
				onclick={handleResetDefaults}
				class="rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 hover:border-slate-400 transition-all"
			>
				기본값 복원
			</button>
			<button
				type="button"
				onclick={handleSave}
				disabled={saving}
				class="flex items-center gap-2 rounded-2xl bg-rose-600 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all disabled:opacity-50"
			>
				<Icon icon="ph:floppy-disk-bold" class="text-base" />
				<span>{saving ? '저장 중...' : '정책 설정 저장'}</span>
			</button>
		</div>
	</div>
</div>

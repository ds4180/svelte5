/**
 * ============================================================================
 * [미디어 관제탑 프론트엔드 비즈니스·정책 서비스 (src/lib/services/mediaAdminService.ts)]
 * ============================================================================
 * - /v1/admin/media의 동적 정책 기본값·정규화, 탭 빌더, 검색 필터링,
 *   단일 파일 및 ZIP 스트림 다운로드 헬퍼를 UI 컴포넌트로부터 분리합니다.
 */

import { getSecureMediaUrl, type MediaAssetLike } from '$lib/config/media';
import { getLocalFileTimestamp } from '$lib/utils';

export interface MediaTabLabels {
	SHARED: string;
	PERSONAL: string;
	PUBLIC: string;
	PROTECTED: string;
	SYSTEM: string;
	PRIVATE: string;
}

export interface MediaSettings {
	max_file_size_mb: number;
	enforce_extension_whitelist: boolean;
	allowed_extensions: string[];
	default_upload_tier_for_user: 'PUBLIC' | 'PROTECTED' | 'PRIVATE' | string;

	webp_quality: number;
	thumb_sm_max_px: number;
	thumb_md_max_px: number;
	thumb_lg_max_px: number;
	publish_strip_image_original: boolean;

	enable_original_auto_expiry: boolean;
	original_keep_days: number;
	isolation_retention_days: number;
	default_gc_indices: number[];

	shared_office_min_rank: number;
	shared_office_write_min_rank: number;
	protected_min_rank: number;
	system_serve_min_rank: number;
	zip_download_max_files: number;

	default_view_mode: 'grid' | 'list';
	default_recursive_view: boolean;
	tab_labels: MediaTabLabels;
}

export interface MediaPermissions {
	can_admin_read: boolean;
	can_admin_write: boolean;
}

export interface MediaTabItem {
	id: string;
	label: string;
	tier: string;
	basePath: string;
	isSettings?: boolean;
}

export const DEFAULT_MEDIA_TAB_LABELS: MediaTabLabels = {
	SHARED: '공용폴더 (OFFICE)',
	PERSONAL: '내 파일함 (USERS)',
	PUBLIC: '공개 자산 (PUBLIC)',
	PROTECTED: '사내 보안 (PROTECTED)',
	SYSTEM: '시스템 코어 (SYSTEM)',
	PRIVATE: '전체 유저함 (PRIVATE)'
};

export const DEFAULT_MEDIA_SETTINGS: MediaSettings = {
	max_file_size_mb: 100,
	enforce_extension_whitelist: true,
	allowed_extensions: [
		'.jpg',
		'.jpeg',
		'.png',
		'.gif',
		'.webp',
		'.pdf',
		'.docx',
		'.xlsx',
		'.zip',
		'.hwp',
		'.txt',
		'.csv'
	],
	default_upload_tier_for_user: 'PUBLIC',

	webp_quality: 85,
	thumb_sm_max_px: 300,
	thumb_md_max_px: 900,
	thumb_lg_max_px: 1920,
	publish_strip_image_original: true,

	enable_original_auto_expiry: true,
	original_keep_days: 60,
	isolation_retention_days: 30,
	default_gc_indices: [1, 2, 3, 4, 5, 6],

	shared_office_min_rank: 2,
	shared_office_write_min_rank: 4,
	protected_min_rank: 2,
	system_serve_min_rank: 2,
	zip_download_max_files: 100,

	default_view_mode: 'grid',
	default_recursive_view: true,
	tab_labels: { ...DEFAULT_MEDIA_TAB_LABELS }
};

export const getGcTaskDefinitions = (settings: MediaSettings) => [
	{
		index: 1,
		code: 'ORPHAN_FILES',
		label: 'DB 기록 없는 고립 파일 격리 (.DEL_GC_ 이동)'
	},
	{
		index: 2,
		code: 'DANGLING_RECORDS',
		label: '원본·썸네일 모두 유실된 DB 유령 레코드 정리'
	},
	{
		index: 3,
		code: 'ORPHAN_THUMBS',
		label: '매칭 자산 없는 고립 썸네일 삭제 (정상 썸네일 영구 보존)'
	},
	{
		index: 4,
		code: 'RETENTION_CLEANUP',
		label: `${settings.isolation_retention_days}일 경과 격리 파일·폴더 및 DB 레코드 영구 삭제`
	},
	{
		index: 5,
		code: 'EMPTY_FOLDERS',
		label: '시스템 내 비어 있는 빈 디렉터리 재귀 정리'
	},
	{
		index: 6,
		code: 'ORIGINAL_EXPIRY_GC',
		label: settings.enable_original_auto_expiry
			? `${settings.original_keep_days}일 경과 원본 이미지 소프트 격리 (총 ${settings.original_keep_days + settings.isolation_retention_days}일 후 영구 파기)`
			: '원본 이미지 시한부 격리 (현재 설정에서 비활성화됨 — 영구 보존)'
	}
];

export function normalizeMediaSettings(raw?: Partial<MediaSettings> | null): MediaSettings {
	const src = raw || {};
	return {
		...DEFAULT_MEDIA_SETTINGS,
		...src,
		allowed_extensions: Array.isArray(src.allowed_extensions)
			? [...src.allowed_extensions]
			: [...DEFAULT_MEDIA_SETTINGS.allowed_extensions],
		default_gc_indices: Array.isArray(src.default_gc_indices)
			? [...src.default_gc_indices]
			: [...DEFAULT_MEDIA_SETTINGS.default_gc_indices],
		default_view_mode: src.default_view_mode === 'list' ? 'list' : 'grid',
		tab_labels: {
			...DEFAULT_MEDIA_TAB_LABELS,
			...(src.tab_labels || {})
		}
	};
}

export function buildMediaExplorerTabs(params: {
	userId: number | string;
	canAdminRead: boolean;
	canAdminWrite: boolean;
	settings: MediaSettings;
}): MediaTabItem[] {
	const { userId, canAdminRead, canAdminWrite, settings } = params;
	const labels = settings.tab_labels || DEFAULT_MEDIA_TAB_LABELS;

	const tabs: MediaTabItem[] = [
		{ id: 'SHARED', label: labels.SHARED, tier: 'SYSTEM', basePath: 'GLOBAL/OFFICE' },
		{ id: 'PERSONAL', label: labels.PERSONAL, tier: 'PRIVATE', basePath: `USERS/${userId}` },
		{ id: 'PUBLIC', label: labels.PUBLIC, tier: 'PUBLIC', basePath: '' },
		{ id: 'PROTECTED', label: labels.PROTECTED, tier: 'PROTECTED', basePath: '' }
	];

	if (canAdminRead) {
		tabs.push(
			{ id: 'SYSTEM', label: labels.SYSTEM, tier: 'SYSTEM', basePath: '' },
			{ id: 'PRIVATE', label: labels.PRIVATE, tier: 'PRIVATE', basePath: '' }
		);
	}

	if (canAdminWrite) {
		tabs.push({
			id: 'SETTINGS',
			label: '설정',
			tier: '',
			basePath: '',
			isSettings: true
		});
	}

	return tabs;
}

export function filterMediaExplorerItems<TFolder extends { name?: string; path?: string }, TFile extends MediaAssetLike>(
	folders: TFolder[],
	files: TFile[],
	query: string
): { filteredFolders: TFolder[]; filteredFiles: TFile[] } {
	const q = (query || '').trim().toLowerCase();
	if (!q) {
		return { filteredFolders: folders, filteredFiles: files };
	}
	return {
		filteredFolders: folders.filter(
			(f) => (f.name || '').toLowerCase().includes(q) || (f.path || '').toLowerCase().includes(q)
		),
		filteredFiles: files.filter(
			(a) =>
				(a.original_name || '').toLowerCase().includes(q) ||
				(a.file_path || '').toLowerCase().includes(q) ||
				(a.app_id || '').toLowerCase().includes(q)
		)
	};
}

export function getFileRelativeDir(filePath: string, tier: string, currentSubPath: string): string {
	const prefix = `${tier}/${currentSubPath}`.replace(/\/$/, '') + '/';
	if ((filePath || '').startsWith(prefix)) {
		const relative = filePath.substring(prefix.length);
		const parts = relative.split('/');
		if (parts.length > 1) return parts.slice(0, -1).join('/') + '/';
	}
	return './';
}

export async function downloadMediaAssetBlob(
	serverUrl: string,
	asset: MediaAssetLike,
	size: string | null = null
): Promise<string> {
	const targetUrl = getSecureMediaUrl(serverUrl, asset, size);
	const response = await fetch(targetUrl, { credentials: 'include' });
	if (!response.ok) {
		throw new Error('파일 다운로드에 실패했습니다.');
	}
	const blob = await response.blob();
	const url = window.URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	const origName = String(asset.original_name || `asset_${asset.id}`);
	if (size) {
		const dotIdx = origName.lastIndexOf('.');
		const base = dotIdx > 0 ? origName.substring(0, dotIdx) : origName;
		a.download = `${base}_${size}.webp`;
	} else {
		a.download = origName;
	}
	document.body.appendChild(a);
	a.click();
	a.remove();
	window.URL.revokeObjectURL(url);
	return a.download;
}

export async function downloadMediaZipBlob(payload: {
	asset_ids: number[];
	folder_paths: string[];
	tier: string;
}): Promise<string> {
	const response = await fetch('/api/media/admin/zip-download', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify(payload)
	});
	if (!response.ok) {
		const errBody = await response.json().catch(() => null);
		throw new Error(errBody?.detail || 'ZIP 생성 응답에 실패했습니다.');
	}
	const blob = await response.blob();
	const url = window.URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `media_export_${getLocalFileTimestamp()}.zip`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	window.URL.revokeObjectURL(url);
	return a.download;
}

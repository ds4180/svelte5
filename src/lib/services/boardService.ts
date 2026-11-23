/**
 * ============================================================================
 * [게시판 비즈니스 서비스 모듈 (src/lib/services/boardService.ts)]
 * ============================================================================
 * 💡 역할:
 * - BoardEngine UI 컴포넌트에서 경로 파싱, 권한 판별, 유효성 검증,
 *   에디터 미디어 배포 및 게시글 저장 비즈니스 로직을 분리합니다.
 */

import * as api from '$lib/api/board';
import { publishEditorContentAssets } from '$lib/services/mediaService';
import type { ServicePermission } from '$lib/utils/servicePermission';

export type BoardViewMode = 'list' | 'view' | 'write' | 'edit';

export interface ParsedBoardRoute {
	boardSlug: string;
	mode: BoardViewMode;
	postId: string | null;
}

export interface BoardPostForm {
	title: string;
	content: string;
	content_json: any;
	extra_data: Record<string, any>;
	status: string;
}

/**
 * URL 슬러그 문자열을 게시판 슬러그·뷰 모드·게시글 ID로 파싱합니다.
 */
export function parseBoardRoute(slug: string): ParsedBoardRoute {
	const parts = (slug || '').split('/').filter((p) => p !== '');
	const boardSlug = parts[0] || '';

	if (parts.length <= 1) {
		return { boardSlug, mode: 'list', postId: null };
	}
	if (parts[1] === 'write') {
		return { boardSlug, mode: 'write', postId: null };
	}
	return {
		boardSlug,
		mode: parts[2] === 'edit' ? 'edit' : 'view',
		postId: parts[1]
	};
}

/**
 * 사용자가 해당 게시판의 관리자 권한을 보유하고 있는지 판별합니다.
 */
export function isUserBoardAdmin(user: any, board: any, boardAdminRank = 4): boolean {
	if (!user) return false;
	if (Number(user.rank_level ?? 0) >= boardAdminRank) return true;

	const userGroups = new Set(
		[user.primary_group, ...(Array.isArray(user.secondary_groups) ? user.secondary_groups : [])]
			.map((g) => String(g || '').trim())
			.filter(Boolean)
	);
	if (userGroups.size === 0) return false;

	const rawAdmin = board?.options?.admin_groups;
	const adminList = Array.isArray(rawAdmin)
		? rawAdmin
		: typeof rawAdmin === 'string'
			? rawAdmin.split(',')
			: [];
	const allowAdmin =
		board?.allow_groups &&
		typeof board.allow_groups === 'object' &&
		!Array.isArray(board.allow_groups)
			? Array.isArray(board.allow_groups.admin)
				? board.allow_groups.admin
				: []
			: [];

	return [...adminList, ...allowAdmin].some((g) => userGroups.has(String(g || '').trim()));
}

/**
 * 글쓰기/수정 경로 진입 시 사전 잠금 안내가 필요한지 계산합니다.
 */
export function computeEditorLockPermission(
	user: any,
	mode: BoardViewMode,
	canWrite: boolean,
	canModifyPost: boolean,
	post: any
): ServicePermission | null {
	if (!user) {
		return {
			can_read: true,
			can_write: false,
			reason: 'LOGIN_REQUIRED',
			message:
				mode === 'edit'
					? '로그인 후 게시글을 수정할 수 있습니다.'
					: '로그인 후 게시글을 작성할 수 있습니다.'
		};
	}
	if (mode === 'write' && !canWrite) {
		return {
			can_read: true,
			can_write: false,
			reason: 'FORBIDDEN',
			message: '이 게시판에 게시글을 작성할 권한이 없습니다.'
		};
	}
	if (mode === 'edit' && post && !canModifyPost) {
		return {
			can_read: true,
			can_write: false,
			reason: 'FORBIDDEN',
			message: '이 게시글을 수정할 권한이 없습니다.'
		};
	}
	return null;
}

/**
 * 게시글 작성/수정 폼의 제목과 본문 유효성을 검사합니다.
 */
export function validateBoardPostForm(
	form: BoardPostForm
): { ok: true } | { ok: false; message: string } {
	if (!form.title || !form.title.trim()) {
		return { ok: false, message: '제목을 입력해주세요.' };
	}

	const tempDiv = document.createElement('div');
	tempDiv.innerHTML = form.content || '';
	const textContent = tempDiv.textContent || tempDiv.innerText || '';

	const hasRichBlock =
		(form.content || '').includes('<img') ||
		(form.content || '').includes('data-tiptap-') ||
		(form.content || '').includes('<table') ||
		(form.content || '').includes('<iframe');

	if (!textContent.trim() && !hasRichBlock) {
		return { ok: false, message: '내용을 입력해주세요.' };
	}
	return { ok: true };
}

/**
 * 에디터 임시 미디어를 서비스 티어에 배포한 뒤 게시글을 생성하거나 수정합니다.
 */
export async function saveBoardPost(params: {
	mode: 'write' | 'edit';
	boardSlug: string;
	postId: string | null;
	board: any;
	editForm: BoardPostForm;
	serverUrl: string;
}): Promise<{ savedId: string | number | null; content: string; content_json: any }> {
	const { mode, boardSlug, postId, board, editForm, serverUrl } = params;

	const publishedMedia = await publishEditorContentAssets({
		content: editForm.content,
		content_json: editForm.content_json,
		app_id: 'board',
		target_id: postId ? String(postId) : null,
		access_level: Number(board?.min_read_rank ?? 0) === 0 ? 'PUBLIC' : 'PROTECTED',
		sub_path: boardSlug ? `BOARDS/${boardSlug}` : 'BOARDS',
		serverUrl
	});

	const payload = {
		...editForm,
		content: publishedMedia.content,
		content_json: publishedMedia.content_json,
		media_ids: publishedMedia.publishedAssetIds || []
	};

	let savedId: string | number | null = postId;
	if (mode === 'write') {
		const created = await api.createPost(boardSlug, payload);
		savedId = created?.id ?? created?.post?.id ?? null;
	} else {
		await api.updatePost(postId as string | number, payload);
	}

	return {
		savedId,
		content: publishedMedia.content,
		content_json: publishedMedia.content_json
	};
}

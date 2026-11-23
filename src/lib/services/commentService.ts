/**
 * ============================================================================
 * [댓글 미디어·비즈니스 서비스 모듈 (src/lib/services/commentService.ts)]
 * ============================================================================
 * 💡 역할:
 * - CommentFileUploadEngine UI 컴포넌트에서 1단계 임시 업로드, 개인 파일함 병합,
 *   임시 자산 격리, 2단계 물리 배포 및 댓글 생성/수정 로직을 분리합니다.
 */

import * as commentApi from '$lib/api/comment';
import { uploadFiles, publishAssets, deleteAsset } from '$lib/services/mediaService';

/**
 * 1단계: 댓글 첨부용 파일을 로그인 사용자의 개인 보관함(COMMENT_TEMP)으로 임시 업로드합니다.
 */
export async function uploadCommentTempFiles(
	files: File[],
	userId?: number | string | null
): Promise<any[]> {
	if (!files || files.length === 0) return [];
	const userSubPath = userId ? `USERS/${userId}/COMMENT_TEMP` : '';
	const res = await uploadFiles(files, {
		app_id: 'personal_vault',
		access_level: 'PRIVATE',
		sub_path: userSubPath
	});
	return Array.isArray(res?.assets) ? res.assets : Array.isArray(res) ? res : [];
}

/**
 * 내 파일함에서 선택한 자산을 중복 없이 병합합니다. (_fromPersonalVault 태그 부여)
 */
export function mergePickedPersonalAssets(
	currentAssets: any[],
	pickedAssets: any[]
): {
	nextAssets: any[];
	addedCount: number;
} {
	if (!Array.isArray(pickedAssets) || pickedAssets.length === 0) {
		return { nextAssets: currentAssets, addedCount: 0 };
	}
	const tagged = pickedAssets.map((a) => ({ ...a, _fromPersonalVault: true }));
	const existingIds = new Set(currentAssets.map((a) => a.id));
	const uniqueNew = tagged.filter((a) => !existingIds.has(a.id));
	return {
		nextAssets: [...currentAssets, ...uniqueNew],
		addedCount: tagged.length
	};
}

/**
 * 개인 파일함 선택분이 아닌 임시 업로드 자산만 서버에서 격리(삭제)합니다.
 */
export async function cleanupTempAssets(assets: any[]): Promise<void> {
	const tempOnly = (assets || []).filter((a) => a && !a._fromPersonalVault);
	if (tempOnly.length === 0) return;
	await Promise.allSettled(tempOnly.map((a) => deleteAsset(a.id)));
}

/**
 * 2단계: 임시/개인 보관함 자산을 게시판 서비스 티어에 물리 복사 배포하고 ID 목록을 반환합니다.
 */
export async function publishCommentAssets(
	assets: any[],
	targetTier: 'PUBLIC' | 'PROTECTED',
	commentSubPath: string
): Promise<number[]> {
	if (!assets || assets.length === 0) return [];
	const publishedList = await publishAssets({
		asset_ids: assets.map((a) => a.id),
		access_level: targetTier,
		app_id: 'comment',
		sub_path: commentSubPath
	});
	return (Array.isArray(publishedList) ? publishedList : [])
		.map((a) => Number(a?.id))
		.filter((id) => Number.isFinite(id) && id > 0);
}

/**
 * 첨부 배포 후 새 댓글을 등록합니다.
 */
export async function submitNewComment(params: {
	postId: number | string;
	content: string;
	pendingAssets: any[];
	targetTier: 'PUBLIC' | 'PROTECTED';
	commentSubPath: string;
	parentId?: number | null;
}): Promise<void> {
	const publishedIds = await publishCommentAssets(
		params.pendingAssets,
		params.targetTier,
		params.commentSubPath
	);
	await commentApi.createComment(params.postId, {
		content: params.content.trim() || '(첨부파일)',
		parent_id: params.parentId ?? null,
		media_ids: publishedIds
	});
}

/**
 * 신규 첨부 배포 및 삭제 대상 ID를 포함해 댓글을 수정합니다.
 */
export async function submitEditedComment(params: {
	commentId: number | string;
	content: string;
	editPendingAssets: any[];
	removeMediaIds: number[];
	targetTier: 'PUBLIC' | 'PROTECTED';
	commentSubPath: string;
}): Promise<void> {
	const publishedIds = await publishCommentAssets(
		params.editPendingAssets,
		params.targetTier,
		params.commentSubPath
	);
	await commentApi.updateComment(params.commentId, {
		content: params.content.trim() || '(첨부파일)',
		media_ids: publishedIds,
		remove_media_ids: params.removeMediaIds
	});
}

/**
 * 원댓글 + 2단 대댓글 전체 개수를 합산합니다.
 */
export function countTotalComments(comments: any[]): number {
	return (comments || []).reduce(
		(sum, c) => sum + 1 + (Array.isArray(c?.sub_comments) ? c.sub_comments.length : 0),
		0
	);
}

/**
 * 댓글 작성자 표시 이름을 반환합니다.
 */
export function getCommentDisplayName(comment: any): string {
	return comment?.user?.real_name || comment?.user?.username || '익명';
}

/**
 * 2단계 고정 답글 대상 정보를 생성합니다. (2단 답글에 답글 시 @대상자 멘션 프리필)
 */
export function buildReplyTarget(
	rootComment: any,
	targetComment: any = null
): { rootId: number; targetName: string; initialContent: string } {
	const target = targetComment || rootComment;
	const targetName = getCommentDisplayName(target);
	return {
		rootId: Number(rootComment.id),
		targetName,
		initialContent: targetComment ? `@${targetName} ` : ''
	};
}

/**
 * 파일 첨부 없는 경량 대댓글을 등록합니다.
 */
export async function submitReplyComment(params: {
	postId: number | string;
	parentId: number;
	content: string;
}): Promise<void> {
	await commentApi.createComment(params.postId, {
		content: params.content.trim(),
		parent_id: params.parentId,
		media_ids: []
	});
}

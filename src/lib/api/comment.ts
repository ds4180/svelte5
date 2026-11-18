/**
 * ============================================================================
 * [댓글 공통 API 모듈 (src/lib/api/comment.ts)]
 * ============================================================================
 * 💡 역할: 게시글 댓글 조회, 작성, 수정, 삭제를 위한 Type-Safe 통신 함수를 제공합니다.
 */

import { fastApi } from './index';

export interface CommentItem {
	id: number;
	post_id: number;
	content: string;
	author_id?: number | string;
	author_name?: string;
	author_rank?: number;
	created_at?: string;
	updated_at?: string;
	attachments?: Array<{
		id: number;
		original_name: string;
		mime_type: string;
		file_size?: number;
		access_level?: string;
		meta_info?: Record<string, any>;
	}>;
	[key: string]: any;
}

export interface CommentCreatePayload {
	content: string;
	parent_id?: number | null;
	media_ids?: number[];
}

export interface CommentUpdatePayload {
	content: string;
	media_ids?: number[];
	remove_media_ids?: number[];
}

/**
 * 특정 게시물의 댓글 목록 조회
 */
export const getComments = (postId: number | string) =>
	fastApi<CommentItem[]>('GET', `/api/v1/comment/${postId}`);

/**
 * 댓글 작성
 */
export const createComment = (postId: number | string, data: CommentCreatePayload) =>
	fastApi<CommentItem, CommentCreatePayload>('POST', `/api/v1/comment/${postId}`, data);

/**
 * 댓글 수정
 */
export const updateComment = (commentId: number | string, data: CommentUpdatePayload) =>
	fastApi<CommentItem, CommentUpdatePayload>('PUT', `/api/v1/comment/${commentId}`, data);

/**
 * 댓글 삭제
 */
export const deleteComment = (commentId: number | string) =>
	fastApi<{ success: boolean; message?: string }>('DELETE', `/api/v1/comment/${commentId}`);

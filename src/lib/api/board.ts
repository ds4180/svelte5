/**
 * ============================================================================
 * [게시판(Board) 엔진 전용 API 모듈 (src/lib/api/board.ts)]
 * ============================================================================
 * 💡 역할:
 * 범용 게시판(BoardEngine)의 게시글 목록/상세/생성/수정/삭제 및 댓글 API를 제공합니다.
 */

import { fastApi } from './index';

export interface BoardPostQueryParams {
	page?: number;
	size?: number;
	keyword?: string;
	[key: string]: any;
}

export const getBoardPosts = <T = any>(slug: string, params: BoardPostQueryParams = {}) =>
	fastApi<T>('GET', `/api/v1/boards/${slug}/posts`, params);

export const getBoardConfig = <T = any>(slug: string) =>
	fastApi<T>('GET', `/api/v1/boards/${slug}/config`);

export const getPostDetail = <T = any>(postId: number | string) =>
	fastApi<T>('GET', `/api/v1/posts/${postId}`);

export const createPost = <T = any>(slug: string, data: Record<string, any>) =>
	fastApi<T>('POST', `/api/v1/boards/${slug}/posts`, data);

export const updatePost = <T = any>(postId: number | string, data: Record<string, any>) =>
	fastApi<T>('PUT', `/api/v1/posts/${postId}`, data);

export const deletePost = <T = any>(postId: number | string) =>
	fastApi<T>('DELETE', `/api/v1/posts/${postId}`);

// 댓글 API 통합 re-export
export { getComments, createComment, updateComment, deleteComment } from './comment';

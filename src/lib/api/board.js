import { fastApi } from './index';

/**
 * 게시판 관련 API 호출 모듈 (표준 v2.0 반영)
 */

// --- Board ---
export const getBoardPosts = (slug, page, size, keyword) =>
	fastApi('GET', `/api/v1/board/${slug}/posts`, { page, size, keyword });
export const getBoardConfig = (slug) => fastApi('GET', `/api/v1/board/${slug}`);
export const getPostDetail = (postId) => fastApi('GET', `/api/v1/board/post/${postId}`);
export const createPost = (slug, data) => fastApi('POST', `/api/v1/board/create/${slug}`, data);
export const updatePost = (postId, data) => fastApi('PUT', `/api/v1/board/update/${postId}`, data);
export const deletePost = (postId) => fastApi('DELETE', `/api/v1/board/delete/${postId}`);

// --- Comment (Lego Service - $lib/api/comment 단일 위임) ---
export { getComments, createComment, updateComment, deleteComment } from './comment';

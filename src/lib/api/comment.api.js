import { fastApi } from './index';

/**
 * @file comment.api.js
 * @description 댓글(Comment) 관련 API 모음
 */

/**
 * 특정 게시물의 댓글 목록 조회
 * @param {number} postId
 * @returns {Promise<any[]>}
 */
export const getComments = (postId) => fastApi('GET', `/api/v1/posts/${postId}/comments`);

/**
 * 댓글 작성
 * @param {number} postId
 * @param {{ content: string }} data
 * @returns {Promise<any>}
 */
export const createComment = (postId, data) =>
	fastApi('POST', `/api/v1/posts/${postId}/comments`, data);

/**
 * 댓글 수정
 * @param {number} commentId
 * @param {{ content: string }} data
 * @returns {Promise<any>}
 */
export const updateComment = (commentId, data) =>
	fastApi('PUT', `/api/v1/comments/${commentId}`, data);

/**
 * 댓글 삭제
 * @param {number} commentId
 * @returns {Promise<any>}
 */
export const deleteComment = (commentId) => fastApi('DELETE', `/api/v1/comments/${commentId}`);

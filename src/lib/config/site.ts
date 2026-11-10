/**
 * @file src/lib/config/site.ts
 * @description 브라우저 탭 및 전역 사이트 타이틀 단일 진실 공급원 (SSOT)
 */
import { config } from '$lib/api/config.js';

// 전역 사이트 기본 설정 (SSR 호환 순수 객체)
export const siteConfig = {
	siteName: config.siteName || 'jeju.live Core',
	description: config.siteDescription || ''
};

/**
 * 페이지별 탭 타이틀 생성 헬퍼 (단일 진실 공급원)
 * @param pageTitle 페이지별 타이틀
 * @returns {string} 완성된 브라우저 탭 타이틀 (예: '게시판 인스턴스 관리 | jeju.live Core')
 */
export function getSiteTitle(pageTitle?: string): string {
	const base = siteConfig.siteName || 'jeju.live Core';
	if (!pageTitle) return base;
	return `${pageTitle} | ${base}`;
}

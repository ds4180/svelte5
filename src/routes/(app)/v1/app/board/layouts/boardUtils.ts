/**
 * HTML 본문에서 첫 번째 이미지 src URL을 추출합니다.
 */
export function extractFirstImage(html?: string | null): string | null {
	if (!html || typeof html !== 'string') return null;
	const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
	return match?.[1] || null;
}

/**
 * HTML 태그를 제거하고 요약용 평문 텍스트를 반환합니다.
 */
export function stripHtml(html?: string | null): string {
	if (!html || typeof html !== 'string') return '';
	return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

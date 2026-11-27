/**
 * ============================================================================
 * [TipTap / 게시판 / 페이지 HTML XSS 살균 유틸 (src/lib/utils/sanitizeHtml.ts)]
 * ============================================================================
 * - TipTap의 합법적인 서식(table, style, data-tiptap-chart, data-*, img, a, 유튜브 iframe 등)은 보존하면서,
 * - <script>, <object>, <embed>, <base>, <meta>, 모든 on* 인라인 이벤트 핸들러,
 *   javascript:/vbscript:/data:text/html 프로토콜 URL을 제거합니다.
 */

const DANGEROUS_TAGS = new Set([
	'script',
	'object',
	'embed',
	'applet',
	'base',
	'meta',
	'link',
	'noscript',
	'template'
]);

const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'poster']);
const DANGEROUS_URI_RE = /^\s*(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/i;

function sanitizeIframeSrc(rawSrc: string): boolean {
	const trimmed = rawSrc.trim();
	if (!trimmed) return false;
	if (DANGEROUS_URI_RE.test(trimmed)) return false;
	// 상대 경로 또는 https:// (YouTube, Vimeo 등 신뢰 임베드)만 허용
	return trimmed.startsWith('/') || /^https:\/\//i.test(trimmed);
}

/**
 * 브라우저 DOMParser 기반 HTML 살균 (SSR/Node 테스트 환경에서는 정규식 폴백 지원)
 */
export function sanitizeHtml(rawHtml: string | null | undefined): string {
	if (typeof rawHtml !== 'string' || !rawHtml) return '';

	if (typeof DOMParser !== 'undefined') {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(rawHtml, 'text/html');

			const walk = (root: ParentNode) => {
				const children = Array.from(root.children);
				for (const el of children) {
					const tag = el.tagName.toLowerCase();
					if (DANGEROUS_TAGS.has(tag)) {
						el.remove();
						continue;
					}

					if (tag === 'iframe') {
						const src = el.getAttribute('src') || '';
						if (!sanitizeIframeSrc(src)) {
							el.remove();
							continue;
						}
					}

					for (const attr of Array.from(el.attributes)) {
						const name = attr.name.toLowerCase();
						const val = attr.value || '';
						if (name.startsWith('on')) {
							el.removeAttribute(attr.name);
							continue;
						}
						if (URL_ATTRS.has(name) && DANGEROUS_URI_RE.test(val)) {
							el.removeAttribute(attr.name);
							continue;
						}
						if (name === 'style' && /expression\s*\(|javascript\s*:/i.test(val)) {
							el.removeAttribute(attr.name);
						}
					}

					walk(el);
				}
			};

			walk(doc.body);
			return doc.body.innerHTML;
		} catch {
			// 폴백으로 진행
		}
	}

	// SSR / 비브라우저 폴백: 위험 태그 및 이벤트 핸들러 제거
	return rawHtml
		.replace(/<\s*(script|object|embed|applet|base|meta|link)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
		.replace(/<\s*(script|object|embed|applet|base|meta|link)\b[^>]*\/?>/gi, '')
		.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
		.replace(/\s+(href|src|action|formaction)\s*=\s*(["'])\s*(?:javascript|vbscript|data\s*:\s*text\/html):[^"']*\2/gi, '');
}

import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml', () => {
	it('removes script tags, inline event handlers, and javascript URLs', () => {
		const dirty =
			'<p>안녕</p><script>alert(1)</script><img src="/ok.png" onerror="alert(2)" /><a href="javascript:alert(3)">클릭</a>';
		const clean = sanitizeHtml(dirty);

		expect(clean).toContain('<p>안녕</p>');
		expect(clean).not.toContain('<script');
		expect(clean).not.toContain('onerror');
		expect(clean).not.toContain('javascript:');
	});

	it('preserves legitimate TipTap HTML, tables, styles, and chart data attributes', () => {
		const valid =
			'<div data-tiptap-chart="true" data-chart-type="bar" data-title="운행현황"></div><table style="width:100%"><tr><td>배차</td></tr></table>';
		const clean = sanitizeHtml(valid);

		expect(clean).toContain('data-tiptap-chart="true"');
		expect(clean).toContain('data-chart-type="bar"');
		expect(clean).toContain('<table');
		expect(clean).toContain('<td>배차</td>');
	});
});

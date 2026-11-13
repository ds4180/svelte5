import { describe, expect, it } from 'vitest';
import { formatApiError, normalizeErrorMessage } from './error';

describe('error formatting utilities (SSOT)', () => {
	it('returns trimmed strings and filters out stringified [object Object]', () => {
		expect(normalizeErrorMessage('  권한이 없습니다.  ')).toBe('권한이 없습니다.');
		expect(normalizeErrorMessage('[object Object]')).toBe('');
		expect(formatApiError('[object Object]', '기본 오류')).toBe('기본 오류');
	});

	it('extracts FastAPI 422 validation error arrays into readable messages', () => {
		const payload = {
			detail: [
				{ loc: ['body', 'type'], msg: 'Input should be a valid string', type: 'string_type' },
				{ loc: ['body', 'dates'], msg: 'List should have at least 1 item', type: 'too_short' }
			]
		};
		expect(formatApiError(payload, '실패')).toBe(
			'Input should be a valid string, List should have at least 1 item'
		);
	});

	it('handles non-array object detail and falls back when detail is empty or null', () => {
		expect(formatApiError({ detail: { message: '정원이 마감되었습니다.' } }, '실패')).toBe(
			'정원이 마감되었습니다.'
		);
		expect(formatApiError({ detail: '', message: '실제 오류 메시지' }, '실패')).toBe(
			'실제 오류 메시지'
		);
		expect(formatApiError({ detail: null, error: { message: '중첩 오류' } }, '실패')).toBe(
			'중첩 오류'
		);
	});

	it('recovers real detail even when wrapped inside Error("[object Object]")', () => {
		const err = Object.assign(new Error('[object Object]'), {
			detail: { msg: '상세 검증 실패' }
		});
		expect(formatApiError(err, '실패')).toBe('상세 검증 실패');
	});

	it('handles circular references and empty payloads safely', () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		expect(formatApiError(circular, '안전 폴백')).toBe('안전 폴백');
		expect(formatApiError(null, '안전 폴백')).toBe('안전 폴백');
		expect(formatApiError({}, '안전 폴백')).toBe('안전 폴백');
	});
});

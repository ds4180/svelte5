import { describe, expect, it, vi } from 'vitest';
import {
	extractSessionCookieInstruction,
	syncSessionCookieFromResponse,
	requireAuthUser,
	resolveSafeRedirect,
	buildBackendForwardHeaders
} from './sessionCookie';

describe('sessionCookie server helpers', () => {
	it('parses sliding session_id and dynamic Max-Age from Set-Cookie header', () => {
		const res = new Response(null, {
			headers: {
				'set-cookie': 'session_id=jti-123-abc; HttpOnly; Max-Age=259200; Path=/; SameSite=lax'
			}
		});
		expect(extractSessionCookieInstruction(res)).toEqual({
			action: 'set',
			value: 'jti-123-abc',
			maxAge: 259200
		});
	});

	it('returns delete instruction when backend expires session_id cookie', () => {
		const res = new Response(null, {
			headers: {
				'set-cookie': 'session_id=""; Max-Age=0; Path=/; SameSite=lax'
			}
		});
		expect(extractSessionCookieInstruction(res)).toEqual({ action: 'delete' });

		const cookies = { set: vi.fn(), delete: vi.fn() } as any;
		syncSessionCookieFromResponse(cookies, res);
		expect(cookies.delete).toHaveBeenCalledWith('session_id', expect.objectContaining({ path: '/' }));
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('redirects unauthenticated locals to /login with encoded return path', () => {
		expect(() => requireAuthUser({ user: null }, new URL('http://localhost/v1/pages?tab=1'))).toThrowError(
			expect.objectContaining({
				status: 302,
				location: '/login?redirect=%2Fv1%2Fpages%3Ftab%3D1'
			})
		);
	});

	it('rejects open redirects and login/logout loops', () => {
		expect(resolveSafeRedirect('/v1/pages/schedule')).toBe('/v1/pages/schedule');
		expect(resolveSafeRedirect('https://evil.example/phish')).toBe('/');
		expect(resolveSafeRedirect('//evil.example/phish')).toBe('/');
		expect(resolveSafeRedirect('/logout')).toBe('/');
		expect(resolveSafeRedirect('/login?redirect=/v1')).toBe('/');
	});

	it('forwards User-Agent, Cookie, and client IP headers to backend', () => {
		const req = new Request('http://localhost/login', {
			headers: {
				'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
				cookie: 'session_id=old-jti-uuid',
				'x-forwarded-for': '203.0.113.77'
			}
		});
		const headers = buildBackendForwardHeaders(req, '172.18.0.2', {
			'Content-Type': 'application/x-www-form-urlencoded'
		});
		expect(headers['user-agent']).toContain('iPhone');
		expect(headers['cookie']).toBe('session_id=old-jti-uuid');
		expect(headers['x-forwarded-for']).toBe('203.0.113.77');
		expect(headers['x-real-ip']).toBe('203.0.113.77');
		expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
	});
});

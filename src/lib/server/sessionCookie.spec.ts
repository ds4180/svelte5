import { describe, expect, it, vi } from 'vitest';
import {
	extractSessionCookieInstruction,
	syncSessionCookieFromResponse,
	requireAuthUser,
	resolveSafeRedirect
} from './sessionCookie.js';

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
});

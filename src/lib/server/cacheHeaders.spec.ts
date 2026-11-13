import { describe, it, expect } from 'vitest';
import { applyDynamicNoStoreHeaders } from './cacheHeaders';

const EXPECTED_CACHE_CONTROL = 'private, no-store, no-cache, must-revalidate';

describe('applyDynamicNoStoreHeaders', () => {
	it('applies no-store headers to SSR HTML responses', () => {
		const response = new Response('<html></html>', {
			status: 200,
			headers: { 'content-type': 'text/html; charset=utf-8' }
		});

		applyDynamicNoStoreHeaders(response, '/v1/custom/dayoff', false);

		expect(response.headers.get('Cache-Control')).toBe(EXPECTED_CACHE_CONTROL);
		expect(response.headers.get('Pragma')).toBe('no-cache');
	});

	it('applies no-store headers to SvelteKit __data.json and _app/version.json', () => {
		const dataRes = new Response('{}', {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
		applyDynamicNoStoreHeaders(dataRes, '/v1/pages/sgv4/__data.json', false);
		expect(dataRes.headers.get('Cache-Control')).toBe(EXPECTED_CACHE_CONTROL);
		expect(dataRes.headers.get('Pragma')).toBe('no-cache');

		const versionRes = new Response('{"version":"abc"}', {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
		applyDynamicNoStoreHeaders(versionRes, '/_app/version.json', true);
		expect(versionRes.headers.get('Cache-Control')).toBe(EXPECTED_CACHE_CONTROL);
		expect(versionRes.headers.get('Pragma')).toBe('no-cache');
	});

	it('applies no-store headers to non-static redirect responses (e.g. / -> /v1)', () => {
		const redirectRes = new Response(null, {
			status: 302,
			headers: { Location: '/v1' }
		});

		applyDynamicNoStoreHeaders(redirectRes, '/', false);

		expect(redirectRes.headers.get('Cache-Control')).toBe(EXPECTED_CACHE_CONTROL);
		expect(redirectRes.headers.get('Pragma')).toBe('no-cache');
	});

	it('does not overwrite cache headers on /_app/immutable/* assets or static assets', () => {
		const immutableRes = new Response('console.log(1)', {
			status: 200,
			headers: {
				'content-type': 'text/javascript',
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});

		applyDynamicNoStoreHeaders(immutableRes, '/_app/immutable/entry/app.123.js', true);
		expect(immutableRes.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
		expect(immutableRes.headers.get('Pragma')).toBeNull();

		const staticRedirect = new Response(null, { status: 304 });
		applyDynamicNoStoreHeaders(staticRedirect, '/favicon.ico', true);
		expect(staticRedirect.headers.get('Cache-Control')).toBeNull();
	});

	it('never overrides /_app/immutable/* even if content-type were text/html', () => {
		const res = new Response('', {
			status: 200,
			headers: {
				'content-type': 'text/html',
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});

		applyDynamicNoStoreHeaders(res, '/_app/immutable/chunks/test.html', true);
		expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
	});

	it('safely ignores immutable headers without throwing', () => {
		const immutableResponse = Response.redirect('https://example.com/v1', 302);

		expect(() => applyDynamicNoStoreHeaders(immutableResponse, '/', false)).not.toThrow();
	});
});

/**
 * Applies `no-store` cache headers on SSR HTML, SvelteKit data payloads,
 * `version.json`, and dynamic redirects to prevent HTML <-> JS chunk version skew.
 */
export function applyDynamicNoStoreHeaders(
	response: Response,
	pathname: string,
	isStaticAsset: boolean
): void {
	const contentType = response.headers.get('content-type') || '';
	const isImmutableAsset = pathname.startsWith('/_app/immutable/');
	const isDynamicRedirect = response.status >= 300 && response.status < 400 && !isStaticAsset;

	if (
		!isImmutableAsset &&
		(contentType.includes('text/html') ||
			pathname.endsWith('/__data.json') ||
			pathname === '/_app/version.json' ||
			isDynamicRedirect)
	) {
		try {
			response.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
			response.headers.set('Pragma', 'no-cache');
		} catch {
			// Ignore immutable Response headers if an adapter returns a frozen header map
		}
	}
}

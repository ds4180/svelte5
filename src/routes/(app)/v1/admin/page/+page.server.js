import { error } from '@sveltejs/kit';
import { requireAuthUser } from '$lib/server/sessionCookie.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, locals, url }) {
    requireAuthUser(locals, url);
    try {
        const res = await fetch('/api/v1/page/admin/list');
        if (!res.ok) {
            throw error(res.status, '페이지 목록을 불러오지 못했습니다.');
        }
        const pages = await res.json();
        return { pages };
    } catch (e) {
        console.error('[Admin Page SSR] Error:', e);
        return { pages: [] };
    }
}

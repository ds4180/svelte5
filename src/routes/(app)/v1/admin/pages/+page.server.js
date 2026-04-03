import fs from 'fs';
import path from 'path';

/** @type {import('./$types').PageServerLoad} */
export async function load() {
    // 📁 스캔 대상 정적 페이지 루트 경로
    const PAGES_DIR = path.resolve('src/routes/(app)/v1/pages');
    
    let pages = [];

    try {
        if (fs.existsSync(PAGES_DIR)) {
            // 폴더 내 모든 항목 읽기
            const entries = fs.readdirSync(PAGES_DIR, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const slug = entry.name;
                    const pageFilePath = path.join(PAGES_DIR, slug, '+page.svelte');

                    // +page.svelte 파일이 존재하는 폴더만 유효한 페이지로 간주
                    if (fs.existsSync(pageFilePath)) {
                        const stats = fs.statSync(pageFilePath);
                        pages.push({
                            slug: slug,
                            url: `/v1/pages/${slug}`,
                            path: `src/routes/(app)/v1/pages/${slug}/+page.svelte`,
                            last_modified: stats.mtime
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error('Failed to scan pages directory:', error);
    }

    return {
        pages: pages.sort((a, b) => b.last_modified - a.last_modified) // 최신 수정순 정렬
    };
}
import fs from 'fs';
import path from 'path';
import type { PageServerLoad } from './$types';

interface StaticPageItem {
	slug: string;
	url: string;
	last_modified: Date;
}

export const load: PageServerLoad = async () => {
	// 📁 순수 파일 시스템 정적 페이지 루트 디렉터리 스캔
	const PAGES_DIR = path.resolve('src/routes/(app)/v1/pages');
	const pages: StaticPageItem[] = [];

	try {
		if (fs.existsSync(PAGES_DIR)) {
			const entries = fs.readdirSync(PAGES_DIR, { withFileTypes: true });

			for (const entry of entries) {
				if (entry.isDirectory() && !entry.name.startsWith('[') && !entry.name.startsWith('.')) {
					const slug = entry.name;
					const pageFilePath = path.join(PAGES_DIR, slug, '+page.svelte');

					if (fs.existsSync(pageFilePath)) {
						const stats = fs.statSync(pageFilePath);
						pages.push({
							slug: slug,
							url: `/v1/pages/${slug}`,
							last_modified: stats.mtime
						});
					}
				}
			}
		}
	} catch (error) {
		console.error('Failed to scan static pages directory:', error);
	}

	return {
		pages: pages.sort((a, b) => a.slug.localeCompare(b.slug))
	};
};

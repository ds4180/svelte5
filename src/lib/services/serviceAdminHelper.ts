/**
 * ============================================================================
 * [서비스·게시판 관리자 비즈니스 헬퍼 (src/lib/services/serviceAdminHelper.ts)]
 * ============================================================================
 * 💡 역할:
 * - `/v1/admin/services`와 `/v1/admin/board` 페이지 컴포넌트에서
 *   번들 행(Row) 직렬화, 권한 설정 파싱/병합, 동적 옵션 변환 비즈니스 로직을 분리합니다.
 */

import type { ServiceReadPolicy, ServiceWritePolicy } from '$lib/utils/servicePermission';

export interface BundleLayoutRow {
	id: string;
	display: 'block' | 'inline' | 'grid-2';
	wrap: boolean;
	align: 'start' | 'between' | 'end';
	app_ids: number[];
}

export interface ServiceAppPermissionFormState {
	perm_read_policy: ServiceReadPolicy;
	perm_write_policy: ServiceWritePolicy;
	perm_min_read_rank: number;
	perm_min_write_rank: number;
	perm_allow_groups_str: string;
	perm_deny_groups_str: string;
}

/**
 * 레거시 정수 배열([1, 2]) 또는 확장 객체 배열([{ app_id, row, display, wrap, align }])을
 * 편집기용 행(Row / div 컨테이너) 배열로 정규화합니다.
 */
export function parseBundleToRows(rawEntries: any[]): BundleLayoutRow[] {
	const rows: BundleLayoutRow[] = [];
	const rowMap = new Map<number, number>();

	(rawEntries || []).forEach((entry, idx) => {
		if (typeof entry === 'number') {
			rows.push({
				id: `r-${idx}-${entry}`,
				display: 'block',
				wrap: true,
				align: 'start',
				app_ids: [entry]
			});
		} else if (entry && typeof entry === 'object' && entry.app_id != null) {
			const appId = Number(entry.app_id);
			const rowNum = typeof entry.row === 'number' ? entry.row : idx;
			const display: BundleLayoutRow['display'] =
				entry.display === 'inline' || entry.display === 'grid-2' ? entry.display : 'block';
			const wrap = entry.wrap !== false;
			const align: BundleLayoutRow['align'] =
				entry.align === 'between' || entry.align === 'end' ? entry.align : 'start';

			if (rowMap.has(rowNum)) {
				const existingIdx = rowMap.get(rowNum)!;
				if (!rows[existingIdx].app_ids.includes(appId)) {
					rows[existingIdx].app_ids.push(appId);
				}
			} else {
				const newIdx = rows.length;
				rowMap.set(rowNum, newIdx);
				rows.push({
					id: `r-${rowNum}-${idx}`,
					display,
					wrap,
					align,
					app_ids: [appId]
				});
			}
		}
	});

	return rows;
}

/**
 * 행(Row) 배열을 백엔드 저장용 service_app_ids 배열로 직렬화합니다.
 */
export function serializeRowsToBundle(rows: BundleLayoutRow[]): Array<{
	app_id: number;
	row: number;
	display: string;
	wrap: boolean;
	align: string;
}> {
	const out: Array<{
		app_id: number;
		row: number;
		display: string;
		wrap: boolean;
		align: string;
	}> = [];
	let logicalRowIdx = 0;

	(rows || []).forEach((row) => {
		const ids = Array.isArray(row?.app_ids) ? row.app_ids : [];
		if (ids.length === 0) return;
		ids.forEach((appId) => {
			out.push({
				app_id: Number(appId),
				row: logicalRowIdx,
				display: String(row.display || 'block'),
				wrap: row.wrap !== false,
				align: String(row.align || 'start')
			});
		});
		logicalRowIdx += 1;
	});

	return out;
}

export function getBundleDisplayLabel(display: string): string {
	if (display === 'inline') return '인라인(가로)';
	if (display === 'grid-2') return '2분할(Grid)';
	return '단독 블록';
}

/**
 * ServiceApp.config에서 관리자 폼용 권한 상태 객체를 추출합니다.
 */
export function extractServiceAppPermissionForm(config: any): ServiceAppPermissionFormState {
	const permCfg = config?.permissions || {};
	return {
		perm_read_policy: permCfg.read_policy || 'inherit',
		perm_write_policy: permCfg.write_policy || 'inherit_read',
		perm_min_read_rank: Number(permCfg.min_read_rank ?? 0),
		perm_min_write_rank: Number(permCfg.min_write_rank ?? 1),
		perm_allow_groups_str: Array.isArray(permCfg.allow_groups)
			? permCfg.allow_groups.join(', ')
			: '',
		perm_deny_groups_str: Array.isArray(permCfg.deny_groups) ? permCfg.deny_groups.join(', ') : ''
	};
}

/**
 * 관리자 폼의 권한 상태를 ServiceApp.config.permissions에 병합합니다. (기본값이면 키 제거)
 */
export function mergeServiceAppPermissionConfig(
	baseConfig: Record<string, any>,
	form: ServiceAppPermissionFormState
): Record<string, any> {
	const next = { ...(baseConfig || {}) };
	const readPol = form.perm_read_policy || 'inherit';
	const writePol = form.perm_write_policy || 'inherit_read';

	if (readPol === 'inherit' && writePol === 'inherit_read') {
		delete next.permissions;
		return next;
	}

	const parseGroups = (s: string) =>
		String(s || '')
			.split(',')
			.map((g) => g.trim())
			.filter(Boolean);

	next.permissions = {
		read_policy: readPol,
		write_policy: writePol,
		...(readPol === 'custom' || writePol === 'custom'
			? {
					min_read_rank: Number(form.perm_min_read_rank ?? 0),
					min_write_rank: Number(form.perm_min_write_rank ?? 1),
					allow_groups: parseGroups(form.perm_allow_groups_str),
					deny_groups: parseGroups(form.perm_deny_groups_str)
				}
			: {})
	};
	return next;
}

/**
 * 게시판 인스턴스(BoardConfig.options.service_permissions)를 불변으로 갱신합니다.
 */
export function updateBoardServicePermissionOption(
	options: Record<string, any>,
	serviceId: string,
	field: 'read_policy' | 'write_policy',
	value: string
): Record<string, any> {
	const opts = { ...(options || {}) };
	const svcPerms =
		opts.service_permissions && typeof opts.service_permissions === 'object'
			? { ...opts.service_permissions }
			: {};
	const cur =
		svcPerms[serviceId] && typeof svcPerms[serviceId] === 'object'
			? { ...svcPerms[serviceId] }
			: { read_policy: 'inherit', write_policy: 'inherit_read' };

	cur[field] = value;

	if (
		(cur.read_policy || 'inherit') === 'inherit' &&
		(cur.write_policy || 'inherit_read') === 'inherit_read'
	) {
		delete svcPerms[serviceId];
	} else {
		svcPerms[serviceId] = cur;
	}

	if (Object.keys(svcPerms).length === 0) {
		delete opts.service_permissions;
	} else {
		opts.service_permissions = svcPerms;
	}

	return opts;
}

/**
 * 서비스 앱 목록을 레지스트리(대분류)별로 그룹화하고 검색어로 필터링합니다.
 */
export function groupServiceAppsByRegistry(
	serviceApps: any[],
	serviceEngines: any[],
	serviceRegistries: any[],
	query = ''
): Array<{ registryId: string; registryName: string; apps: any[] }> {
	const q = query.trim().toLowerCase();
	const engineMap = new Map(serviceEngines.map((e) => [e.id, e]));
	const regMap = new Map(serviceRegistries.map((r) => [r.id, r]));
	const groups: Record<string, { registryId: string; registryName: string; apps: any[] }> = {};

	for (const app of serviceApps) {
		const eng = engineMap.get(app.engine_id);
		const regId = eng?.registry_id || 'etc';
		const reg = regMap.get(regId);
		const regName = reg?.name || regId;

		if (q) {
			const haystack = `${app.name} ${app.engine_id} ${regName} ${regId}`.toLowerCase();
			if (!haystack.includes(q)) continue;
		}

		if (!groups[regId]) {
			groups[regId] = { registryId: regId, registryName: regName, apps: [] };
		}
		groups[regId].apps.push({ ...app, _plugin: eng?.frontend_plugin || '' });
	}

	return Object.values(groups).sort((a, b) => a.registryName.localeCompare(b.registryName, 'ko'));
}

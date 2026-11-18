import type { MenuItem, MenuOption } from '$lib/runes/nav.svelte';

/**
 * 게시판 인스턴스의 `options` JSON 객체를 우측 다이나믹 폼(DynamicSidebar) 컨트롤 항목으로 변환합니다.
 * 단순 원시값({ allow_comment: true, grid_cols: 3 })과
 * 구조화 스키마({ grid_cols: { label: '열 수', type: 'slider', min: 1, max: 6, value: 3 } })를 모두 지원합니다.
 */
export function buildOptionMenuItems(
	optionsObj: Record<string, any> | null | undefined,
	onUpdateKey: (key: string, nextValue: any) => void | Promise<void>
): MenuItem[] {
	if (!optionsObj || typeof optionsObj !== 'object' || Array.isArray(optionsObj)) {
		return [];
	}

	const items: MenuItem[] = [];

	for (const [key, rawVal] of Object.entries(optionsObj)) {
		if (rawVal === undefined) continue;

		const isStructured =
			rawVal !== null &&
			typeof rawVal === 'object' &&
			!Array.isArray(rawVal) &&
			('value' in rawVal || 'type' in rawVal);

		if (isStructured) {
			if (
				rawVal.dynamic_form === false ||
				rawVal.show_in_dynamic_form === false ||
				rawVal.visible === false
			) {
				continue;
			}

			const val = rawVal.value;
			const rawOptions: MenuOption[] | undefined = Array.isArray(rawVal.options)
				? rawVal.options.map((o: any) =>
						typeof o === 'object' && o !== null && 'value' in o
							? { label: String(o.label ?? o.value), value: o.value }
							: { label: String(o), value: o }
					)
				: undefined;

			let type: MenuItem['type'] = rawVal.type;
			if (!type) {
				if (rawOptions && rawOptions.length > 0) type = 'select';
				else if (typeof val === 'boolean') type = 'toggle';
				else if (typeof val === 'number') type = 'slider';
				else type = 'text';
			}

			items.push({
				id: `opt-${key}`,
				type,
				title: String(rawVal.label || rawVal.title || key),
				description: rawVal.description ? String(rawVal.description) : undefined,
				icon: rawVal.icon || (type === 'toggle' ? 'ph:toggle-right-bold' : type === 'slider' ? 'ph:faders-bold' : 'ph:sliders-horizontal-bold'),
				value: val ?? (type === 'toggle' ? false : type === 'slider' ? (rawVal.min ?? 0) : ''),
				min: typeof rawVal.min === 'number' ? rawVal.min : 0,
				max: typeof rawVal.max === 'number' ? rawVal.max : Math.max(100, Number(val || 0) * 2),
				step: typeof rawVal.step === 'number' ? rawVal.step : 1,
				unit: rawVal.unit ? String(rawVal.unit) : undefined,
				options: rawOptions,
				onChange: (nextVal: any) => onUpdateKey(key, { ...rawVal, value: nextVal }),
				onClick:
					type === 'button'
						? () => onUpdateKey(key, { ...rawVal, value: rawVal.value ?? true })
						: undefined
			});
			continue;
		}

		if (typeof rawVal === 'boolean') {
			items.push({
				id: `opt-${key}`,
				type: 'toggle',
				title: key,
				icon: 'ph:toggle-right-bold',
				value: rawVal,
				onChange: (nextVal: any) => onUpdateKey(key, Boolean(nextVal))
			});
		} else if (typeof rawVal === 'number') {
			items.push({
				id: `opt-${key}`,
				type: 'slider',
				title: key,
				icon: 'ph:faders-bold',
				min: 0,
				max: Math.max(100, Math.ceil(rawVal * 2) || 100),
				step: 1,
				value: rawVal,
				onChange: (nextVal: any) => onUpdateKey(key, Number(nextVal))
			});
		} else if (typeof rawVal === 'string') {
			items.push({
				id: `opt-${key}`,
				type: 'text',
				title: key,
				icon: 'ph:textbox-bold',
				value: rawVal,
				onChange: (nextVal: any) => onUpdateKey(key, String(nextVal))
			});
		}
	}

	return items;
}

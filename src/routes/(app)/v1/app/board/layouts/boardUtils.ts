/**
 * HTML 본문에서 첫 번째 이미지 src URL을 추출합니다.
 */
export function extractFirstImage(html?: string | null): string | null {
	if (!html || typeof html !== 'string') return null;
	const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
	return match?.[1] || null;
}

/**
 * HTML 태그를 제거하고 요약용 평문 텍스트를 반환합니다.
 */
export function stripHtml(html?: string | null): string {
	if (!html || typeof html !== 'string') return '';
	return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export const DEFAULT_POST_CATEGORIES = ['공지', '긴급', '필독', '안전', '정비', '일반'] as const;
export const POST_CATEGORIES = ['전체', ...DEFAULT_POST_CATEGORIES] as const;

export function getBoardCategories(boardOptions?: Record<string, any> | null): string[] {
	const raw = boardOptions?.categories;
	if (Array.isArray(raw)) {
		const list = raw.map((c) => String(c || '').trim()).filter(Boolean);
		if (list.length > 0) return list;
	} else if (typeof raw === 'string' && raw.trim()) {
		const list = raw
			.split(',')
			.map((c) => c.trim())
			.filter(Boolean);
		if (list.length > 0) return list;
	}
	return [...DEFAULT_POST_CATEGORIES];
}

export const CATEGORY_BADGE_CLASS: Record<string, string> = {
	공지: 'bg-blue-100 text-blue-700',
	긴급: 'bg-rose-100 text-rose-700',
	필독: 'bg-purple-100 text-purple-700',
	안전: 'bg-amber-100 text-amber-800',
	정비: 'bg-emerald-100 text-emerald-700',
	일반: 'bg-slate-100 text-slate-600'
};

export const BG_TONE_CARD_CLASS: Record<string, string> = {
	none: 'border-slate-200 bg-white',
	rose: 'border-rose-300 bg-rose-50/70',
	amber: 'border-amber-300 bg-amber-50/70',
	blue: 'border-blue-300 bg-blue-50/70',
	emerald: 'border-emerald-300 bg-emerald-50/70',
	slate: 'border-slate-300 bg-slate-100/80'
};

export const TITLE_COLOR_CLASS: Record<string, string> = {
	default: 'text-slate-900',
	rose: 'text-rose-700',
	amber: 'text-amber-700',
	blue: 'text-blue-700',
	emerald: 'text-emerald-700',
	purple: 'text-purple-700'
};

export function getPostMetaPresentation(post: any, boardOptions?: Record<string, any>) {
	const extra = post?.extra_data && typeof post.extra_data === 'object' ? post.extra_data : {};
	const todayStr = new Date().toISOString().slice(0, 10);
	const pinUntil = String(extra.pin_until || '').trim();
	const rawUsePin = boardOptions?.use_pin;
	const usePinEnabled =
		rawUsePin === undefined
			? true
			: rawUsePin && typeof rawUsePin === 'object' && 'value' in rawUsePin
				? Boolean(rawUsePin.value)
				: Boolean(rawUsePin);
	const isPinned =
		usePinEnabled && Boolean(extra.is_pinned) && (!pinUntil || pinUntil.slice(0, 10) >= todayStr);

	const bgTone = String(extra.bg_tone || 'none');
	const cardToneClass =
		BG_TONE_CARD_CLASS[bgTone] ||
		(isPinned ? 'border-amber-300 bg-amber-50/40' : BG_TONE_CARD_CLASS.none);

	const titleColor = String(extra.title_color || 'default');
	const titleColorClass = TITLE_COLOR_CLASS[titleColor] || TITLE_COLOR_CLASS.default;
	const titleWeightClass = extra.title_bold ? 'font-black' : isPinned ? 'font-black' : 'font-bold';

	const newMode = String(extra.new_mode || 'auto');
	const newHours = Number(boardOptions?.new_hours ?? 24);
	const createdRaw = post?.create_date || post?.created_at;
	const createdMs = createdRaw ? new Date(createdRaw).getTime() : 0;
	const isAutoNew = createdMs > 0 && Date.now() - createdMs < newHours * 3600 * 1000;
	const isNew = newMode === 'force' ? true : newMode === 'hide' ? false : isAutoNew;

	const category = String(extra.category || '').trim();
	const categoryClass = CATEGORY_BADGE_CLASS[category] || 'bg-indigo-100 text-indigo-700';

	return {
		extra,
		isPinned,
		pinUntil,
		category,
		categoryClass,
		cardToneClass,
		titleColorClass,
		titleWeightClass,
		isNew,
		icon: String(extra.icon || '').trim(),
		summaryLine: String(extra.summary_line || '').trim(),
		isSecret: Boolean(extra.is_secret),
		allowComment: extra.allow_comment !== false,
		requireReadReceipt: Boolean(extra.require_read_receipt),
		hideAuthor: Boolean(extra.hide_author),
		routeNo: String(extra.route_no || '').trim(),
		vehicleNo: String(extra.vehicle_no || '').trim(),
		effectiveDate: String(extra.effective_date || '').trim(),
		ctaUrl: String(extra.cta_url || '').trim(),
		ctaLabel: String(extra.cta_label || '').trim() || '관련 페이지 바로가기'
	};
}

export const POST_META_CATALOG = [
	{ key: 'category', label: '카테고리 / 말머리', adminOnly: false },
	{ key: 'is_pinned', label: '상단 고정 (공지)', adminOnly: true },
	{ key: 'pin_until', label: '상단 고정 만료일', adminOnly: true },
	{ key: 'bg_tone', label: '목록 배경 색조', adminOnly: true },
	{ key: 'title_bold', label: '제목 굵게 강조', adminOnly: true },
	{ key: 'title_color', label: '제목 글자 색상', adminOnly: true },
	{ key: 'new_mode', label: 'NEW 배지 표시', adminOnly: true },
	{ key: 'icon', label: '제목 앞 아이콘', adminOnly: true },
	{ key: 'require_read_receipt', label: '필독 확인 강조', adminOnly: true },
	{ key: 'publish_at', label: '예약 게시 시작일', adminOnly: true },
	{ key: 'expire_at', label: '게시 자동 종료일', adminOnly: true },
	{ key: 'target_groups', label: '열람 대상 그룹', adminOnly: true },
	{ key: 'push_on_create', label: '등록 시 즉시 웹푸시', adminOnly: true },
	{ key: 'cta_label', label: '바로가기 버튼 문구', adminOnly: true },
	{ key: 'cta_url', label: '바로가기 링크 URL', adminOnly: true },
	{ key: 'summary_line', label: '목록 한줄 요약', adminOnly: false },
	{ key: 'effective_date', label: '시행일 / 적용일', adminOnly: false },
	{ key: 'route_no', label: '관련 노선', adminOnly: false },
	{ key: 'vehicle_no', label: '관련 차량번호', adminOnly: false },
	{ key: 'is_secret', label: '비밀글 설정', adminOnly: false },
	{ key: 'hide_author', label: '작성자 비공개', adminOnly: false },
	{ key: 'allow_comment', label: '댓글 허용', adminOnly: false }
] as const;

export const ALL_POST_META_KEYS = POST_META_CATALOG.map((m) => m.key);

export function buildPostMetaMenuItems(
	extraData: Record<string, any> | undefined,
	isAdmin: boolean,
	onChange: (key: string, value: any) => void,
	allowedKeys?: string[] | null,
	categories?: string[] | null
) {
	const extra = extraData && typeof extraData === 'object' ? extraData : {};
	const catList = Array.isArray(categories) && categories.length > 0 ? categories : [...DEFAULT_POST_CATEGORIES];
	const items: any[] = [
		{
			id: 'meta-category',
			metaKey: 'category',
			type: 'select',
			title: '카테고리 / 말머리',
			icon: 'ph:tag-bold',
			value: extra.category || '',
			options: [{ value: '', label: '없음' }, ...catList.map((c) => ({ value: c, label: c }))],
			onChange: (v: string) => onChange('category', v)
		}
	];

	if (isAdmin) {
		items.push(
			{
				id: 'meta-pinned',
				metaKey: 'is_pinned',
				type: 'toggle',
				title: '상단 고정 (공지)',
				description: '목록 최상단에 우선 노출',
				icon: 'ph:push-pin-bold',
				value: Boolean(extra.is_pinned),
				onChange: (v: boolean) => onChange('is_pinned', v)
			},
			{
				id: 'meta-pin-until',
				metaKey: 'pin_until',
				type: 'text',
				inputType: 'date',
				title: '상단 고정 만료일',
				description: '지정일 이후 자동 해제',
				icon: 'ph:calendar-x-bold',
				value: extra.pin_until || '',
				onChange: (v: string) => onChange('pin_until', v)
			},
			{
				id: 'meta-bg-tone',
				metaKey: 'bg_tone',
				type: 'select',
				title: '목록 배경 색조',
				icon: 'ph:paint-bucket-bold',
				value: extra.bg_tone || 'none',
				options: [
					{ value: 'none', label: '기본' },
					{ value: 'rose', label: '긴급(빨강)' },
					{ value: 'amber', label: '주의(노랑)' },
					{ value: 'blue', label: '안내(파랑)' },
					{ value: 'emerald', label: '완료(초록)' },
					{ value: 'slate', label: '차분(회색)' }
				],
				onChange: (v: string) => onChange('bg_tone', v)
			},
			{
				id: 'meta-title-bold',
				metaKey: 'title_bold',
				type: 'toggle',
				title: '제목 굵게 강조',
				description: '목록/상세 제목 굵은 글씨',
				icon: 'ph:text-b-bold',
				value: Boolean(extra.title_bold),
				onChange: (v: boolean) => onChange('title_bold', v)
			},
			{
				id: 'meta-title-color',
				metaKey: 'title_color',
				type: 'select',
				title: '제목 글자 색상',
				icon: 'ph:palette-bold',
				value: extra.title_color || 'default',
				options: [
					{ value: 'default', label: '기본' },
					{ value: 'rose', label: '빨강' },
					{ value: 'amber', label: '주황' },
					{ value: 'blue', label: '파랑' },
					{ value: 'emerald', label: '초록' },
					{ value: 'purple', label: '보라' }
				],
				onChange: (v: string) => onChange('title_color', v)
			},
			{
				id: 'meta-new-mode',
				metaKey: 'new_mode',
				type: 'select',
				title: 'NEW 배지 표시',
				icon: 'ph:sparkle-bold',
				value: extra.new_mode || 'auto',
				options: [
					{ value: 'auto', label: '자동(24h)' },
					{ value: 'force', label: '강제 NEW' },
					{ value: 'hide', label: '숨김' }
				],
				onChange: (v: string) => onChange('new_mode', v)
			},
			{
				id: 'meta-icon',
				metaKey: 'icon',
				type: 'select',
				title: '제목 앞 아이콘',
				icon: 'ph:smiley-bold',
				value: extra.icon || '',
				options: [
					{ value: '', label: '없음' },
					{ value: '🚨', label: '🚨 긴급' },
					{ value: '📢', label: '📢 공지' },
					{ value: '📌', label: '📌 고정' },
					{ value: '🚌', label: '🚌 운행' },
					{ value: '🔧', label: '🔧 정비' }
				],
				onChange: (v: string) => onChange('icon', v)
			},
			{
				id: 'meta-read-receipt',
				metaKey: 'require_read_receipt',
				type: 'toggle',
				title: '필독 확인 강조',
				description: '미열람 시 필독 배지 강조',
				icon: 'ph:eye-bold',
				value: Boolean(extra.require_read_receipt),
				onChange: (v: boolean) => onChange('require_read_receipt', v)
			},
			{
				id: 'meta-publish-at',
				metaKey: 'publish_at',
				type: 'text',
				inputType: 'date',
				title: '예약 게시 시작일',
				description: '지정일 전까지 일반 비공개',
				icon: 'ph:clock-bold',
				value: extra.publish_at || '',
				onChange: (v: string) => onChange('publish_at', v)
			},
			{
				id: 'meta-expire-at',
				metaKey: 'expire_at',
				type: 'text',
				inputType: 'date',
				title: '게시 자동 종료일',
				description: '종료일 이후 목록 자동 숨김',
				icon: 'ph:hourglass-high-bold',
				value: extra.expire_at || '',
				onChange: (v: string) => onChange('expire_at', v)
			},
			{
				id: 'meta-target-groups',
				metaKey: 'target_groups',
				type: 'text',
				title: '열람 대상 그룹',
				description: '쉼표로 구분 (비우면 전체)',
				placeholder: '예: 운수팀, 정비팀',
				icon: 'ph:users-three-bold',
				value: Array.isArray(extra.target_groups)
					? extra.target_groups.join(', ')
					: extra.target_groups || '',
				onChange: (v: string) =>
					onChange(
						'target_groups',
						v
							.split(',')
							.map((s) => s.trim())
							.filter(Boolean)
					)
			},
			{
				id: 'meta-push-create',
				metaKey: 'push_on_create',
				type: 'toggle',
				title: '등록 시 즉시 웹푸시',
				description: '저장 시 열람 대상자에게 알림',
				icon: 'ph:bell-ringing-bold',
				value: Boolean(extra.push_on_create),
				onChange: (v: boolean) => onChange('push_on_create', v)
			},
			{
				id: 'meta-cta-label',
				metaKey: 'cta_label',
				type: 'text',
				title: '바로가기 버튼 문구',
				placeholder: '예: 설문 참여하기',
				icon: 'ph:cursor-click-bold',
				value: extra.cta_label || '',
				onChange: (v: string) => onChange('cta_label', v)
			},
			{
				id: 'meta-cta-url',
				metaKey: 'cta_url',
				type: 'text',
				title: '바로가기 링크 URL',
				placeholder: '예: /v1/custom/survey',
				icon: 'ph:link-bold',
				value: extra.cta_url || '',
				onChange: (v: string) => onChange('cta_url', v)
			}
		);
	}

	items.push(
		{
			id: 'meta-summary',
			metaKey: 'summary_line',
			type: 'text',
			title: '목록 한줄 요약',
			placeholder: '목록에 노출할 핵심 요약',
			icon: 'ph:text-align-left-bold',
			value: extra.summary_line || '',
			onChange: (v: string) => onChange('summary_line', v)
		},
		{
			id: 'meta-effective-date',
			metaKey: 'effective_date',
			type: 'text',
			inputType: 'date',
			title: '시행일 / 적용일',
			icon: 'ph:calendar-check-bold',
			value: extra.effective_date || '',
			onChange: (v: string) => onChange('effective_date', v)
		},
		{
			id: 'meta-route-no',
			metaKey: 'route_no',
			type: 'text',
			title: '관련 노선',
			placeholder: '예: 121번',
			icon: 'ph:map-pin-line-bold',
			value: extra.route_no || '',
			onChange: (v: string) => onChange('route_no', v)
		},
		{
			id: 'meta-vehicle-no',
			metaKey: 'vehicle_no',
			type: 'text',
			title: '관련 차량번호',
			placeholder: '예: 제주70자1234',
			icon: 'ph:bus-bold',
			value: extra.vehicle_no || '',
			onChange: (v: string) => onChange('vehicle_no', v)
		},
		{
			id: 'meta-secret',
			metaKey: 'is_secret',
			type: 'toggle',
			title: '비밀글 설정',
			description: '작성자·관리자만 열람 가능',
			icon: 'ph:lock-bold',
			value: Boolean(extra.is_secret),
			onChange: (v: boolean) => onChange('is_secret', v)
		},
		{
			id: 'meta-hide-author',
			metaKey: 'hide_author',
			type: 'toggle',
			title: '작성자 비공개',
			description: '목록/상세 작성자명 숨김',
			icon: 'ph:user-circle-minus-bold',
			value: Boolean(extra.hide_author),
			onChange: (v: boolean) => onChange('hide_author', v)
		},
		{
			id: 'meta-allow-comment',
			metaKey: 'allow_comment',
			type: 'toggle',
			title: '댓글 허용',
			description: '해제 시 댓글 작성 잠금',
			icon: 'ph:chat-circle-dots-bold',
			value: extra.allow_comment !== false,
			onChange: (v: boolean) => onChange('allow_comment', v)
		}
	);

	if (Array.isArray(allowedKeys)) {
		const orderMap = new Map<string, number>();
		allowedKeys.forEach((k, idx) => orderMap.set(String(k), idx));
		return items
			.filter((it) => orderMap.has(it.metaKey))
			.sort((a, b) => (orderMap.get(a.metaKey) ?? 0) - (orderMap.get(b.metaKey) ?? 0));
	}

	return items;
}

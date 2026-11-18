import { fastApi } from './index';

export interface ReadUserItem {
	user_id: number;
	username: string;
	real_name?: string | null;
	display_name: string;
	first_read_at?: string;
	last_read_at?: string;
	read_count?: number;
}

export interface ReadReceiptSummary {
	post_id: number;
	read_count: number;
	unread_count: number;
	readers: ReadUserItem[];
	unread_users: ReadUserItem[];
	my_read: ReadUserItem | null;
}

export const getReadReceipts = (postId: number | string) =>
	fastApi<ReadReceiptSummary>('GET', `/api/v1/read-receipt/${postId}`);

export const markPostRead = (postId: number | string, deviceCategory?: string) =>
	fastApi<ReadReceiptSummary, { device_category?: string }>(
		'POST',
		`/api/v1/read-receipt/${postId}`,
		deviceCategory ? { device_category: deviceCategory } : {}
	);

import { fastApi } from './index';

export interface ReactionSummary {
	post_id: number;
	counts: Record<string, number>;
	my_reaction: string | null;
	total: number;
}

export const getReactions = (postId: number | string) =>
	fastApi<ReactionSummary>('GET', `/api/v1/reaction/${postId}`);

export const toggleReaction = (postId: number | string, reactionType: string) =>
	fastApi<ReactionSummary, { reaction_type: string }>('POST', `/api/v1/reaction/${postId}`, {
		reaction_type: reactionType
	});

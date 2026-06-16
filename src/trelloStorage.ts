import { PLUGIN_DATA_KEY } from './config';
import { normalizeLinks } from './linkedCards';
import type { LinkedCard, TrelloIframe } from './types';

export async function getLinks(t: TrelloIframe): Promise<LinkedCard[]> {
  return normalizeLinks(await t.get('card', 'shared', PLUGIN_DATA_KEY, []));
}

export async function setLinks(t: TrelloIframe, links: LinkedCard[]): Promise<void> {
  await t.set('card', 'shared', PLUGIN_DATA_KEY, links);
}

export async function getCurrentCardIdentity(t: TrelloIframe): Promise<{ id: string; shortLink: string; url: string }> {
  const card = await t.card('id', 'shortLink', 'url');
  return {
    id: String(card.id),
    shortLink: String(card.shortLink),
    url: String(card.url),
  };
}

export async function getCurrentContext(t: TrelloIframe): Promise<{
  memberId?: string;
  boardId?: string;
  cardId?: string;
}> {
  const context = t.getContext();
  return {
    memberId: context.member,
    boardId: context.board,
    cardId: context.card,
  };
}

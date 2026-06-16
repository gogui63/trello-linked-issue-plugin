import { BACKEND_BASE_URL } from './config';
import type { LinkedCard, ResolvedLinkedCard, TrelloCardSummary } from './types';

function requireBackendUrl(): string {
  if (!BACKEND_BASE_URL) {
    throw new Error('missing-backend-url');
  }
  return BACKEND_BASE_URL.replace(/\/$/, '');
}

async function backendFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${requireBackendUrl()}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('unauthorized');
    if (response.status === 403) throw new Error('forbidden');
    if (response.status === 404) throw new Error('not-found');
    throw new Error('network');
  }

  return response.json() as Promise<T>;
}

export function getAuthorizationUrl(returnUrl: string): string {
  const url = new URL(`${requireBackendUrl()}/auth/trello/start`);
  url.searchParams.set('returnUrl', returnUrl);
  return url.toString();
}

export async function isBackendAuthorized(memberId?: string): Promise<boolean> {
  if (!BACKEND_BASE_URL) return false;
  const params = memberId ? `?memberId=${encodeURIComponent(memberId)}` : '';
  const status = await backendFetch<{ authorized: boolean }>(`/api/auth/status${params}`);
  return status.authorized;
}

export async function findCardByShortLink(shortLink: string): Promise<TrelloCardSummary> {
  return backendFetch<TrelloCardSummary>(`/api/cards/${encodeURIComponent(shortLink)}`);
}

export async function resolveLinkedCards(links: LinkedCard[]): Promise<ResolvedLinkedCard[]> {
  if (links.length === 0) return [];
  return backendFetch<ResolvedLinkedCard[]>('/api/cards/resolve-linked', {
    method: 'POST',
    body: JSON.stringify({ links }),
  });
}

export async function writeReciprocalLink(targetCardId: string, link: LinkedCard): Promise<boolean> {
  try {
    await backendFetch<{ ok: true }>('/api/links/reciprocal', {
      method: 'POST',
      body: JSON.stringify({ targetCardId, link }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function removeReciprocalLink(targetCardId: string, sourceCardId: string): Promise<void> {
  await backendFetch<{ ok: true }>('/api/links/reciprocal', {
    method: 'DELETE',
    body: JSON.stringify({ targetCardId, sourceCardId }),
  });
}

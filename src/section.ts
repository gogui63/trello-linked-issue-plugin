import { APP_AUTHOR, APP_NAME } from './config';
import { fetchReciprocalLinks, resolveLinkedCards, writeReciprocalLink } from './backendClient';
import { clear, formatDate, qs } from './dom';
import { createReciprocalLink, getRelationGroup, getRelationLabel } from './linkedCards';
import { getCurrentCardIdentity, getCurrentContext, getLinks, setLinks } from './trelloStorage';
import type { LinkedCard, ResolvedLinkedCard } from './types';
import './styles.css';

const t = window.TrelloPowerUp.iframe({
  appName: APP_NAME,
  appAuthor: APP_AUTHOR,
});

function statusText(item: ResolvedLinkedCard): string {
  if (item.error === 'unauthorized') return 'Autorisation requise';
  if (item.error === 'forbidden') return 'Accès refusé';
  if (item.error === 'not-found') return 'Carte introuvable';
  if (item.error) return 'État indisponible';
  if (item.card?.closed) return 'Archivée';
  if (item.card?.due) {
    return item.card.dueComplete ? `Échéance terminée ${formatDate(item.card.due)}` : `Échéance ${formatDate(item.card.due)}`;
  }
  return item.listName || 'Carte active';
}

function createCardRow(item: ResolvedLinkedCard): HTMLElement {
  const row = document.createElement('article');
  row.className = `linked-row ${item.error ? 'is-error' : ''}`;

  const relation = document.createElement('span');
  relation.className = 'relation-chip';
  relation.textContent = getRelationLabel(item.link.relation);

  const content = document.createElement('div');
  content.className = 'linked-main';

  const title = document.createElement('a');
  title.className = 'linked-title';
  title.href = item.card?.url || item.link.url;
  title.target = '_blank';
  title.rel = 'noreferrer';
  title.textContent = item.card?.name || item.link.shortLink;

  const meta = document.createElement('div');
  meta.className = 'linked-meta';
  meta.textContent = [item.boardName, statusText(item)].filter(Boolean).join(' - ');

  const labels = document.createElement('div');
  labels.className = 'label-strip';
  (item.card?.labels || []).slice(0, 4).forEach((label) => {
    const badge = document.createElement('span');
    badge.className = `label-dot label-${label.color || 'none'}`;
    badge.title = label.name || label.color || 'label';
    labels.appendChild(badge);
  });

  content.append(title, meta, labels);
  row.append(relation, content);
  return row;
}

// Render token: annule les renders concurrents (Trello peut invoquer t.render plusieurs fois
// en parallèle, et le lazy-sync via t.set() en déclenche un supplémentaire).
let renderToken = 0;

t.render(async () => {
  const myToken = ++renderToken;

  const status = qs<HTMLDivElement>('#section-status');
  const groups = qs<HTMLDivElement>('#linked-groups');
  status.textContent = 'Chargement des cartes liées...';
  groups.hidden = true;
  clear(groups);

  const { cardId } = await getCurrentContext(t);

  const [localLinks, dbLinksResult] = await Promise.all([
    getLinks(t),
    cardId ? fetchReciprocalLinks(cardId) : Promise.resolve<LinkedCard[]>([]),
  ]);

  if (myToken !== renderToken) return;

  // dbLinksResult === null means the backend was unreachable; don't mutate local state in that case.
  const backendReachable = dbLinksResult !== null;
  const dbLinks = dbLinksResult ?? [];

  // Received-reciprocal links (reciprocal === true) are fully owned by the DB: always replace them
  // with the current DB version. This handles both stale cleanup (source removed the link) and
  // relation corrections (DB now has isBlockedBy but local still has the old wrong relation).
  // Direct outbound links the user added (reciprocal !== true) are always kept and take precedence
  // over any DB entry for the same card.
  const directLocalLinks = backendReachable
    ? localLinks.filter((l) => l.reciprocal !== true)
    : localLinks;

  const directLocalIds = new Set(directLocalLinks.map((l) => l.id));
  const newFromDb = dbLinks.filter((l) => !directLocalIds.has(l.id));
  const mergedLinks = [...directLocalLinks, ...newFromDb];

  // Lazy-sync : écrit dans pluginData pour que les badges voient les liens réciproques.
  // Only write if something actually changed (and backend was reachable so the merge is trustworthy).
  if (backendReachable && (newFromDb.length > 0 || directLocalLinks.length !== localLinks.length)) {
    setLinks(t, mergedLinks).catch(() => undefined);
  }

  // Retry failed reciprocal writes: links this card added outward that couldn't be stored in the DB.
  const failedOutboundLinks = localLinks.filter((l) => l.reciprocal === false);
  if (backendReachable && failedOutboundLinks.length > 0) {
    const currentCard = await getCurrentCardIdentity(t);
    if (myToken !== renderToken) return;
    const retryResults = await Promise.all(
      failedOutboundLinks.map(async (link) => {
        const reciprocal = createReciprocalLink(link, currentCard);
        const ok = await writeReciprocalLink(link.id, reciprocal);
        return ok ? link.id : null;
      }),
    );
    const retriedIds = new Set(retryResults.filter((id): id is string => id !== null));
    if (retriedIds.size > 0) {
      const updatedLinks = localLinks.map((l) =>
        retriedIds.has(l.id) ? ({ ...l, reciprocal: undefined } as LinkedCard) : l,
      );
      setLinks(t, updatedLinks).catch(() => undefined);
    }
  }

  if (mergedLinks.length === 0) {
    status.textContent = 'Aucune carte liée pour le moment.';
    await t.sizeTo('#linked-section');
    return;
  }

  let resolved: ResolvedLinkedCard[];
  try {
    resolved = await resolveLinkedCards(mergedLinks);
  } catch (error) {
    if (myToken !== renderToken) return;
    status.textContent =
      error instanceof Error && error.message === 'missing-backend-url'
        ? 'Backend non configuré. Impossible de rafraîchir les cartes liées.'
        : 'Impossible de rafraîchir les cartes liées depuis le backend.';
    await t.sizeTo('#linked-section');
    return;
  }

  if (myToken !== renderToken) return;

  const byGroup = new Map<string, ResolvedLinkedCard[]>();
  resolved.forEach((item) => {
    const group = getRelationGroup(item.link.relation);
    byGroup.set(group, [...(byGroup.get(group) || []), item]);
  });

  for (const [groupName, items] of byGroup) {
    const group = document.createElement('section');
    group.className = 'relation-group';
    const heading = document.createElement('h3');
    heading.textContent = groupName;
    group.appendChild(heading);
    items.forEach((item) => group.appendChild(createCardRow(item)));
    groups.appendChild(group);
  }

  status.textContent = '';
  groups.hidden = false;
  await t.sizeTo('#linked-section');
});

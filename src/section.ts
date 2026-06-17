import { APP_AUTHOR, APP_NAME } from './config';
import { fetchReciprocalLinks, resolveLinkedCards } from './backendClient';
import { clear, formatDate, qs } from './dom';
import { getRelationGroup, getRelationLabel } from './linkedCards';
import { getCurrentContext, getLinks, setLinks } from './trelloStorage';
import type { ResolvedLinkedCard } from './types';
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

t.render(async () => {
  const status = qs<HTMLDivElement>('#section-status');
  const groups = qs<HTMLDivElement>('#linked-groups');
  status.textContent = 'Chargement des cartes liées...';
  groups.hidden = true;
  clear(groups);

  const { cardId } = await getCurrentContext(t);

  const [localLinks, dbLinks] = await Promise.all([
    getLinks(t),
    cardId ? fetchReciprocalLinks(cardId) : Promise.resolve([]),
  ]);

  // Supprime les liens réciproques locaux absents du backend (lien supprimé par la carte source)
  const dbLinkIds = new Set(dbLinks.map((l) => l.id));
  const cleanedLocal = localLinks.filter((l) => !(l.reciprocal === true && !dbLinkIds.has(l.id)));

  // Fusionne avec les liens du backend absents localement
  const cleanedIds = new Set(cleanedLocal.map((l) => l.id));
  const newFromDb = dbLinks.filter((l) => !cleanedIds.has(l.id));
  const mergedLinks = [...cleanedLocal, ...newFromDb];

  // Lazy-sync : écrit dans pluginData pour que les badges voient les liens réciproques
  if (newFromDb.length > 0 || cleanedLocal.length !== localLinks.length) {
    setLinks(t, mergedLinks).catch(() => undefined);
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
    status.textContent =
      error instanceof Error && error.message === 'missing-backend-url'
        ? 'Backend non configuré. Impossible de rafraîchir les cartes liées.'
        : 'Impossible de rafraîchir les cartes liées depuis le backend.';
    await t.sizeTo('#linked-section');
    return;
  }
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

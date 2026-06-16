import { APP_AUTHOR, APP_NAME } from './config';
import { resolveLinkedCards } from './backendClient';
import { clear, formatDate, qs } from './dom';
import { getRelationGroup, getRelationLabel } from './linkedCards';
import { getLinks } from './trelloStorage';
import type { ResolvedLinkedCard } from './types';
import './styles.css';

const t = window.TrelloPowerUp.iframe({
  appName: APP_NAME,
  appAuthor: APP_AUTHOR,
});

function statusText(item: ResolvedLinkedCard): string {
  if (item.error === 'unauthorized') return 'Autorisation requise';
  if (item.error === 'forbidden') return 'Acces refuse';
  if (item.error === 'not-found') return 'Carte introuvable';
  if (item.error) return 'Etat indisponible';
  if (item.card?.closed) return 'Archivee';
  if (item.card?.due) {
    return item.card.dueComplete ? `Echeance terminee ${formatDate(item.card.due)}` : `Echeance ${formatDate(item.card.due)}`;
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
  status.textContent = 'Chargement des cartes liees...';
  groups.hidden = true;
  clear(groups);

  const links = await getLinks(t);
  if (links.length === 0) {
    status.textContent = 'Aucune carte liee pour le moment.';
    await t.sizeTo('#linked-section');
    return;
  }

  let resolved: ResolvedLinkedCard[];
  try {
    resolved = await resolveLinkedCards(links);
  } catch (error) {
    status.textContent =
      error instanceof Error && error.message === 'missing-backend-url'
        ? 'Backend non configure. Impossible de rafraichir les cartes liees.'
        : 'Impossible de rafraichir les cartes liees depuis le backend.';
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

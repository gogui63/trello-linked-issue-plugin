import { APP_AUTHOR, APP_NAME } from './config';
import {
  findCardByShortLink,
  removeReciprocalLink,
  writeReciprocalLink,
} from './backendClient';
import { clear, qs } from './dom';
import {
  RELATIONS,
  addOrReplaceLink,
  createReciprocalLink,
  getRelationLabel,
  parseCardIdentifier,
  pluginDataSize,
  removeLink,
} from './linkedCards';
import {
  getCurrentCardIdentity,
  getLinks,
  setLinks,
} from './trelloStorage';
import type { LinkedCard, RelationKey } from './types';
import './styles.css';

const t = window.TrelloPowerUp.iframe({
  appName: APP_NAME,
  appAuthor: APP_AUTHOR,
});

function renderRelations(): void {
  const select = qs<HTMLSelectElement>('#relation');
  clear(select);
  RELATIONS.forEach((relation) => {
    const option = document.createElement('option');
    option.value = relation.key;
    option.textContent = relation.label;
    select.appendChild(option);
  });
}

async function renderExistingLinks(): Promise<void> {
  const container = qs<HTMLDivElement>('#existing-links');
  clear(container);
  const links = await getLinks(t);
  if (links.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state compact';
    empty.textContent = 'Aucun lien existant.';
    container.appendChild(empty);
    await t.sizeTo('#popup-content');
    return;
  }

  links.forEach((link) => {
    const row = document.createElement('div');
    row.className = 'existing-row';

    const text = document.createElement('div');
    text.innerHTML = `<strong>${getRelationLabel(link.relation)}</strong><br><span>${link.shortLink}</span>`;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger subtle';
    remove.textContent = 'Supprimer';
    remove.addEventListener('click', async () => {
      const currentLinks = await getLinks(t);
      await setLinks(t, removeLink(currentLinks, link.id));
      await tryRemoveReciprocal(link);
      await renderExistingLinks();
    });

    row.append(text, remove);
    container.appendChild(row);
  });
  await t.sizeTo('#popup-content');
}

async function tryWriteReciprocal(targetId: string, reciprocal: LinkedCard): Promise<boolean> {
  return writeReciprocalLink(targetId, reciprocal);
}

async function tryRemoveReciprocal(link: LinkedCard): Promise<void> {
  try {
    const currentCard = await getCurrentCardIdentity(t);
    await removeReciprocalLink(link.id, currentCard.id);
  } catch {
    // The local link is still removed when the reciprocal card cannot be updated.
  }
}

async function addLink(): Promise<void> {
  const message = qs<HTMLParagraphElement>('#form-message');
  const input = qs<HTMLInputElement>('#card-url');
  const relationSelect = qs<HTMLSelectElement>('#relation');
  message.textContent = '';

  const parsed = parseCardIdentifier(input.value);
  if (!parsed) {
    message.textContent = 'Saisissez une URL Trello valide ou un identifiant court.';
    return;
  }

  const currentCard = await getCurrentCardIdentity(t);
  const targetCard = await findCardByShortLink(parsed.shortLink);
  if (targetCard.id === currentCard.id) {
    message.textContent = 'Une carte ne peut pas etre liee a elle-meme.';
    return;
  }

  const member = await t.member('fullName').catch(() => ({ fullName: undefined }));
  const link: LinkedCard = {
    id: targetCard.id,
    shortLink: targetCard.shortLink || parsed.shortLink,
    url: targetCard.url || targetCard.shortUrl || parsed.url || `https://trello.com/c/${parsed.shortLink}`,
    relation: relationSelect.value as RelationKey,
    createdAt: new Date().toISOString(),
    createdBy: typeof member.fullName === 'string' ? member.fullName : undefined,
  };

  const currentLinks = await getLinks(t);
  const nextLinks = addOrReplaceLink(currentLinks, link);
  if (pluginDataSize(nextLinks) > 3900) {
    message.textContent = 'Trop de liens sur cette carte pour le stockage Trello.';
    return;
  }

  const reciprocal = createReciprocalLink(link, currentCard);
  const reciprocalWritten = await tryWriteReciprocal(targetCard.id, reciprocal);
  await setLinks(t, addOrReplaceLink(currentLinks, { ...link, reciprocal: reciprocalWritten }));

  input.value = '';
  message.textContent = reciprocalWritten
    ? 'Lien ajoute sur les deux cartes.'
    : 'Lien ajoute ici. Le lien reciproque n’a pas pu etre ecrit.';
  await renderExistingLinks();
}

t.render(async () => {
  renderRelations();
  qs<HTMLButtonElement>('#add-link').addEventListener('click', () => {
    addLink().catch((error) => {
      const msg = error instanceof Error ? error.message : '';
      qs<HTMLParagraphElement>('#form-message').textContent =
        msg === 'not-found'
          ? "Carte introuvable. Verifiez l'identifiant saisi."
          : msg === 'missing-backend-url'
          ? 'Backend non configure dans ce plugin.'
          : msg === 'network'
          ? 'Backend inaccessible. Reessayez plus tard.'
          : "Impossible d'ajouter ce lien.";
    });
  });
  await renderExistingLinks();
});

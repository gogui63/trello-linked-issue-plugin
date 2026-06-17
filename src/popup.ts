import { APP_AUTHOR, APP_NAME } from './config';
import {
  findCardByShortLink,
  removeReciprocalLink,
  searchCards,
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
import type { LinkedCard, RelationKey, TrelloCardSummary } from './types';
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
    // Le lien local est tout de même supprimé si la carte cible est inaccessible.
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
    message.textContent = 'Une carte ne peut pas être liée à elle-même.';
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
  // Don't mark the link as reciprocal:true — that flag is reserved for links received FROM other cards
  // via lazy-sync in section.ts. Only flag failed writes (reciprocal:false) for later retry.
  const storedLink: LinkedCard = reciprocalWritten ? link : { ...link, reciprocal: false };
  await setLinks(t, addOrReplaceLink(currentLinks, storedLink));

  input.value = '';
  message.textContent = reciprocalWritten
    ? 'Lien ajouté sur les deux cartes.'
    : "Lien ajouté ici. Le lien réciproque n'a pas pu être écrit.";
  await renderExistingLinks();
}

function setupAutocomplete(input: HTMLInputElement, suggestionsEl: HTMLDivElement): void {
  function hideSuggestions(): void {
    suggestionsEl.hidden = true;
    clear(suggestionsEl);
  }

  function showSuggestions(cards: TrelloCardSummary[]): void {
    clear(suggestionsEl);
    if (cards.length === 0) {
      hideSuggestions();
      return;
    }
    cards.forEach((card) => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      const name = document.createElement('div');
      name.className = 'suggestion-name';
      name.textContent = card.name;
      const meta = document.createElement('div');
      meta.className = 'suggestion-meta';
      meta.textContent = card.shortLink ?? '';
      item.append(name, meta);
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // empêche blur de se déclencher avant le clic
        input.value = card.shortLink ?? '';
        hideSuggestions();
      });
      suggestionsEl.appendChild(item);
    });
    suggestionsEl.hidden = false;
    t.sizeTo('#popup-content').catch(() => undefined);
  }

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  input.addEventListener('input', () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const value = input.value.trim();
    if (!value || value.includes('trello.com/c/') || value.length < 2) {
      hideSuggestions();
      return;
    }
    searchTimeout = setTimeout(() => {
      searchCards(value)
        .then(showSuggestions)
        .catch(hideSuggestions);
    }, 300);
  });

  input.addEventListener('blur', () => {
    setTimeout(hideSuggestions, 150);
  });
}

t.render(async () => {
  renderRelations();

  const input = qs<HTMLInputElement>('#card-url');
  const suggestionsEl = qs<HTMLDivElement>('#card-suggestions');
  setupAutocomplete(input, suggestionsEl);

  qs<HTMLButtonElement>('#add-link').addEventListener('click', () => {
    addLink().catch((error) => {
      const msg = error instanceof Error ? error.message : '';
      qs<HTMLParagraphElement>('#form-message').textContent =
        msg === 'not-found'
          ? "Carte introuvable. Vérifiez l'identifiant saisi."
          : msg === 'missing-backend-url'
          ? 'Backend non configuré dans ce plugin.'
          : msg === 'network'
          ? 'Backend inaccessible. Réessayez plus tard.'
          : "Impossible d'ajouter ce lien.";
    });
  });
  await renderExistingLinks();
});

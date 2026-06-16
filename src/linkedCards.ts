import type { BadgeSummary, LinkedCard, RelationKey } from './types';

export const RELATIONS: Array<{
  key: RelationKey;
  label: string;
  inverse: RelationKey;
  group: string;
}> = [
  { key: 'blocks', label: 'bloqué', inverse: 'isBlockedBy', group: 'Blocage' },
  { key: 'isBlockedBy', label: 'est bloquée par', inverse: 'blocks', group: 'Blocage' },
  { key: 'parentOf', label: 'parent de', inverse: 'childOf', group: 'Hiérarchie' },
  { key: 'childOf', label: 'enfant de', inverse: 'parentOf', group: 'Hiérarchie' },
  { key: 'duplicates', label: 'dupliqué', inverse: 'duplicatedBy', group: 'Doublons' },
  { key: 'duplicatedBy', label: 'est dupliquée par', inverse: 'duplicates', group: 'Doublons' },
  { key: 'clones', label: 'cloné', inverse: 'clonedBy', group: 'Clones' },
  { key: 'clonedBy', label: 'est clonée par', inverse: 'clones', group: 'Clones' },
  { key: 'relatesTo', label: 'liée à', inverse: 'relatesTo', group: 'Relation' },
];

const relationByKey = new Map(RELATIONS.map((relation) => [relation.key, relation]));

export function getRelationLabel(key: RelationKey): string {
  return relationByKey.get(key)?.label ?? key;
}

export function getRelationGroup(key: RelationKey): string {
  return relationByKey.get(key)?.group ?? 'Autres';
}

export function getInverseRelation(key: RelationKey): RelationKey {
  return relationByKey.get(key)?.inverse ?? 'relatesTo';
}

export function normalizeLinks(value: unknown): LinkedCard[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is LinkedCard => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }
    const link = entry as Partial<LinkedCard>;
    return Boolean(
      typeof link.id === 'string' &&
        typeof link.shortLink === 'string' &&
        typeof link.url === 'string' &&
        typeof link.relation === 'string' &&
        relationByKey.has(link.relation as RelationKey),
    );
  });
}

export function parseCardIdentifier(input: string): { shortLink: string; url?: string } | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  const urlMatch = value.match(/trello\.com\/c\/([A-Za-z0-9]+)/);
  if (urlMatch?.[1]) {
    return { shortLink: urlMatch[1], url: value };
  }

  if (/^[A-Za-z0-9]{6,12}$/.test(value)) {
    return { shortLink: value };
  }

  return null;
}

export function addOrReplaceLink(links: LinkedCard[], nextLink: LinkedCard): LinkedCard[] {
  const filtered = links.filter((link) => link.id !== nextLink.id && link.shortLink !== nextLink.shortLink);
  return [...filtered, nextLink];
}

export function removeLink(links: LinkedCard[], cardIdOrShortLink: string): LinkedCard[] {
  return links.filter((link) => link.id !== cardIdOrShortLink && link.shortLink !== cardIdOrShortLink);
}

export function createReciprocalLink(source: LinkedCard, sourceCard: { id: string; shortLink: string; url: string }): LinkedCard {
  return {
    id: sourceCard.id,
    shortLink: sourceCard.shortLink,
    url: sourceCard.url,
    relation: getInverseRelation(source.relation),
    createdAt: source.createdAt,
    createdBy: source.createdBy,
    reciprocal: true,
  };
}

export function summarizeBadges(links: LinkedCard[]): BadgeSummary {
  return links.reduce(
    (summary, link) => {
      summary.total += 1;
      if (link.relation === 'isBlockedBy') {
        summary.blockers += 1;
      }
      if (link.relation === 'blocks') {
        summary.blocking += 1;
      }
      return summary;
    },
    { total: 0, blockers: 0, blocking: 0 },
  );
}

export function pluginDataSize(links: LinkedCard[]): number {
  return JSON.stringify(links).length;
}

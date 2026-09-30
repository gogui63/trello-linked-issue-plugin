import { describe, expect, it } from 'vitest';
import {
  addOrReplaceLink,
  computeProgress,
  createReciprocalLink,
  getInverseRelation,
  isDoneCard,
  normalizeLinks,
  parseCardIdentifier,
  pluginDataSize,
  removeLink,
  summarizeBadges,
} from '../src/linkedCards';
import type { LinkedCard, ResolvedLinkedCard } from '../src/types';

const baseLink: LinkedCard = {
  id: 'card-1',
  shortLink: 'abc123',
  url: 'https://trello.com/c/abc123/card',
  relation: 'blocks',
  createdAt: '2026-06-16T10:00:00.000Z',
  createdBy: 'Gautier',
};

describe('linked card relations', () => {
  it('maps inverse relations', () => {
    expect(getInverseRelation('blocks')).toBe('isBlockedBy');
    expect(getInverseRelation('isBlockedBy')).toBe('blocks');
    expect(getInverseRelation('parentOf')).toBe('childOf');
    expect(getInverseRelation('relatesTo')).toBe('relatesTo');
  });

  it('creates reciprocal links from the source relation', () => {
    const reciprocal = createReciprocalLink(baseLink, {
      id: 'source-1',
      shortLink: 'src123',
      url: 'https://trello.com/c/src123/source',
    });

    expect(reciprocal.id).toBe('source-1');
    expect(reciprocal.relation).toBe('isBlockedBy');
    expect(reciprocal.reciprocal).toBe(true);
  });
});

describe('card identifier parsing', () => {
  it('extracts shortLink from a Trello card URL', () => {
    expect(parseCardIdentifier('https://trello.com/c/aB12cdEf/42-title')).toEqual({
      shortLink: 'aB12cdEf',
      url: 'https://trello.com/c/aB12cdEf/42-title',
    });
  });

  it('accepts a shortLink without URL', () => {
    expect(parseCardIdentifier('aB12cd')).toEqual({ shortLink: 'aB12cd' });
  });

  it('rejects invalid input', () => {
    expect(parseCardIdentifier('not a trello card')).toBeNull();
  });
});

describe('pluginData link collection', () => {
  it('normalizes valid links and ignores invalid data', () => {
    expect(normalizeLinks([baseLink, { id: 'bad' }, null])).toEqual([baseLink]);
  });

  it('adds links without duplicates by id or shortLink', () => {
    const next = { ...baseLink, relation: 'relatesTo' as const };
    expect(addOrReplaceLink([baseLink], next)).toEqual([next]);
  });

  it('removes links by id or shortLink', () => {
    expect(removeLink([baseLink], 'abc123')).toEqual([]);
    expect(removeLink([baseLink], 'card-1')).toEqual([]);
  });

  it('summarizes badge counts', () => {
    expect(summarizeBadges([baseLink, { ...baseLink, id: '2', shortLink: 'def456', relation: 'isBlockedBy' }])).toEqual({
      total: 2,
      blockers: 1,
      blocking: 1,
    });
  });

  it('computes compact storage size', () => {
    expect(pluginDataSize([baseLink])).toBeGreaterThan(50);
  });
});

describe('progress', () => {
  const child = (relation: LinkedCard['relation'], listName?: string, error?: ResolvedLinkedCard['error']): ResolvedLinkedCard => ({
    link: { ...baseLink, relation },
    listName,
    error,
  });

  it('detects done lists case-insensitively', () => {
    expect(isDoneCard(child('parentOf', ' done '), ['DONE'])).toBe(true);
    expect(isDoneCard(child('parentOf', 'Terminé'), ['DONE', 'terminé'])).toBe(true);
    expect(isDoneCard(child('parentOf', 'Doing'), ['DONE'])).toBe(false);
    expect(isDoneCard(child('parentOf'), ['DONE'])).toBe(false);
    expect(isDoneCard(child('parentOf', 'DONE', 'not-found'), ['DONE'])).toBe(false);
  });

  it('returns null without children', () => {
    expect(computeProgress([child('blocks', 'DONE')], ['DONE'])).toBeNull();
  });

  it('computes percent over parentOf children only', () => {
    const items = [
      child('parentOf', 'DONE'),
      child('parentOf', 'Doing'),
      child('parentOf', 'Todo'),
      child('blocks', 'DONE'),
      child('parentOf', undefined, 'not-found'),
    ];
    expect(computeProgress(items, ['DONE'])).toEqual({ done: 1, total: 3, percent: 33 });
  });
});

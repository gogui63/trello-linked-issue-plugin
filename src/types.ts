export type RelationKey =
  | 'blocks'
  | 'isBlockedBy'
  | 'parentOf'
  | 'childOf'
  | 'duplicates'
  | 'duplicatedBy'
  | 'clones'
  | 'clonedBy'
  | 'relatesTo';

export type LinkedCard = {
  id: string;
  shortLink: string;
  url: string;
  relation: RelationKey;
  createdAt: string;
  createdBy?: string;
  reciprocal?: boolean;
};

export type TrelloCardSummary = {
  id: string;
  name: string;
  shortLink?: string;
  shortUrl?: string;
  url?: string;
  idBoard?: string;
  idList?: string;
  labels?: Array<{ id: string; name?: string; color?: string }>;
  due?: string | null;
  dueComplete?: boolean;
  closed?: boolean;
  dateLastActivity?: string;
};

export type ResolvedLinkedCard = {
  link: LinkedCard;
  card?: TrelloCardSummary;
  boardName?: string;
  listName?: string;
  error?: 'unauthorized' | 'not-found' | 'forbidden' | 'network' | 'unknown';
};

export type BadgeSummary = {
  total: number;
  blockers: number;
  blocking: number;
};

export type TrelloPowerUpApi = {
  initialize: (capabilities: Record<string, unknown>, options?: Record<string, unknown>) => void;
  iframe: (options?: Record<string, unknown>) => TrelloIframe;
  restApiError?: Record<string, unknown>;
};

export type TrelloIframe = {
  get: (scope: string, visibility: string, key?: string, defaultValue?: unknown) => Promise<unknown>;
  set: (scope: string, visibility: string, keyOrObject: string | Record<string, unknown>, value?: unknown) => Promise<void>;
  remove: (scope: string, visibility: string, key: string | string[]) => Promise<void>;
  card: (...fields: string[]) => Promise<Record<string, unknown>>;
  board: (...fields: string[]) => Promise<Record<string, unknown>>;
  member: (...fields: string[]) => Promise<Record<string, unknown>>;
  getContext: () => {
    card?: string;
    board?: string;
    member?: string;
    permissions?: { board?: 'read' | 'write'; card?: 'read' | 'write' };
  };
  popup: (options: Record<string, unknown>) => Promise<void>;
  closePopup: () => Promise<void>;
  sizeTo: (selector: string) => Promise<void>;
  render: (callback: () => Promise<void> | void) => void;
  signUrl: (url: string) => string;
};

declare global {
  interface Window {
    TrelloPowerUp: TrelloPowerUpApi;
  }
}

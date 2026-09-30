export const APP_NAME = 'Linked Cards';
export const APP_AUTHOR = 'Welyb';

export const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL || '';

export const DONE_COLUMNS_NAMES: string[] = (import.meta.env.VITE_DONE_COLUMNS_NAMES || 'DONE,EN PRODUCTION')
  .split(',')
  .map((name: string) => name.trim())
  .filter(Boolean);

export const PLUGIN_DATA_KEY = 'linkedCards';
export const ICON_URL = './icon.svg';

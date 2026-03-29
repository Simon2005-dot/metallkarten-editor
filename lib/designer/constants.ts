import type { CardFinishKey, FontFamilyKey } from './types';

export const DEFAULT_TEXT_COLOR = '#000000';
export const DEFAULT_FONT_FAMILY: FontFamilyKey = 'arial';

export const SNAP_THRESHOLD = 6;
export const GRID_SIZE = 4;

export const NFC_ICON_SRC = '/icons/nfc-tap-here.png';

export const FONT_OPTIONS: Record<FontFamilyKey, string> = {
  arial: 'Arial, Helvetica, sans-serif',
  helvetica: 'Helvetica, Arial, sans-serif',
  times: '"Times New Roman", Times, serif',
  georgia: 'Georgia, serif',
  verdana: 'Verdana, Geneva, sans-serif',
  tahoma: 'Tahoma, Geneva, sans-serif',
  trebuchet: '"Trebuchet MS", sans-serif',
  courier: '"Courier New", Courier, monospace',
};

export const FONT_LABELS: Record<FontFamilyKey, string> = {
  arial: 'Arial',
  helvetica: 'Helvetica',
  times: 'Times New Roman',
  georgia: 'Georgia',
  verdana: 'Verdana',
  tahoma: 'Tahoma',
  trebuchet: 'Trebuchet MS',
  courier: 'Courier New',
};


import type { DesignerProduct, Field } from '@/lib/designer/types';
import { DEFAULT_TEXT_COLOR, DEFAULT_FONT_FAMILY, NFC_ICON_SRC } from '@/lib/designer/constants';

const CHIP_SIZE_MM = 25;
const PX_PER_MM = 12;
const STAGE_SIZE = CHIP_SIZE_MM * PX_PER_MM;

const chipFrontFields: Field[] = [
  {
    id: 'chip-icon',
    type: 'logo',
    label: 'NFC Symbol',
    src: NFC_ICON_SRC,
    originalSrc: NFC_ICON_SRC,
    exportSrc: NFC_ICON_SRC,
    x: STAGE_SIZE / 2 - 42,
    y: STAGE_SIZE / 2 - 42,
    width: 84,
    height: 84,
    filename: 'nfc-tap-here.png',
    removedBackground: false,
    vectorStatus: 'idle',
  },
  {
    id: 'chip-title',
    type: 'multiline',
    label: 'Titel',
    text: 'NFC',
    x: STAGE_SIZE / 2,
    y: 38,
    fontSize: 18,
    fontWeight: 700,
    align: 'center',
    color: DEFAULT_TEXT_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
  },
];

const chipBackFields: Field[] = [
  {
    id: 'chip-back-text',
    type: 'multiline',
    label: 'Rückseite Text',
    text: 'Einkaufschip',
    x: STAGE_SIZE / 2,
    y: STAGE_SIZE - 58,
    fontSize: 14,
    fontWeight: 600,
    align: 'center',
    color: DEFAULT_TEXT_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
  },
];

export const nfcChipProduct: DesignerProduct = {
  id: 'nfc-chip',
  name: 'NFC Einkaufschip',
  widthMm: CHIP_SIZE_MM,
  heightMm: CHIP_SIZE_MM,
  pxPerMm: PX_PER_MM,
  safeMarginMm: 2,
  shape: 'circle',
  hole: {
    x: 42,
    y: 42,
    radius: 18,
  },
  backgrounds: {
    black: '/card-backgrounds/black.png',
    silver: '/card-backgrounds/silver.png',
    gold: '/card-backgrounds/gold.png',
  },
  frameStyles: {
    black: {
      border: '#3f3f46',
      gridLine: 'rgba(255,255,255,0.08)',
      safeArea: 'rgba(255,255,255,0.35)',
    },
    silver: {
      border: '#9ca3af',
      gridLine: 'rgba(0,0,0,0.08)',
      safeArea: 'rgba(31,41,55,0.35)',
    },
    gold: {
      border: '#b8860b',
      gridLine: 'rgba(0,0,0,0.08)',
      safeArea: 'rgba(43,30,5,0.35)',
    },
  },
  cardLabels: {
    black: 'Schwarz',
    silver: 'Silber',
    gold: 'Gold',
  },
  frontDefaultFields: chipFrontFields,
  backDefaultFields: chipBackFields,
};
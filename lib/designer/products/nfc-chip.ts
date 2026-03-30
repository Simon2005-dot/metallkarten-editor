import type { DesignerProduct, TextField, QrField } from '@/lib/designer/types';
import { DEFAULT_FONT_FAMILY, DEFAULT_TEXT_COLOR } from '@/lib/designer/constants';

const widthMm = 56.77;
const heightMm = 23;
const pxPerMm = 12;

const stageW = Math.round(widthMm * pxPerMm);
const stageH = Math.round(heightMm * pxPerMm);

const frontDefaultFields: Array<TextField | QrField> = [
  {
    id: 'chip-title',
    type: 'multiline',
    label: 'Titel',
    text: 'NFC Chip',
    x: 130,
    y: 78,
    fontSize: 24,
    fontWeight: 700,
    align: 'left',
    color: DEFAULT_TEXT_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
  },
];

const backDefaultFields: Array<TextField | QrField> = [];

function buildChipPath(stageW: number, stageH: number) {
  const h = stageH;
  const w = stageW;

  const leftBulgeR = h * 0.28;     // kleiner linker Kopf
  const rightBulgeR = h * 0.48;    // größerer rechter Kopf
  const bodyTop = h * 0.12;
  const bodyBottom = h * 0.88;
  const bodyLeft = leftBulgeR * 0.9;
  const bodyRight = w - rightBulgeR * 0.95;

  const leftCx = leftBulgeR;
  const leftCy = h / 2;

  const rightCx = w - rightBulgeR;
  const rightCy = h / 2;

  return `
    M ${bodyLeft} ${bodyTop}
    L ${bodyRight} ${bodyTop}
    A ${rightBulgeR} ${rightBulgeR} 0 0 1 ${bodyRight} ${bodyBottom}
    L ${bodyLeft} ${bodyBottom}
    A ${leftBulgeR} ${leftBulgeR} 0 0 1 ${bodyLeft} ${bodyTop}
    Z
  `;
}

function buildChipSafePath(stageW: number, stageH: number, inset: number) {
  const h = stageH;
  const w = stageW;

  const leftBulgeR = h * 0.28 - inset * 0.35;
  const rightBulgeR = h * 0.48 - inset * 0.35;
  const bodyTop = h * 0.12 + inset;
  const bodyBottom = h * 0.88 - inset;
  const bodyLeft = leftBulgeR * 0.9 + inset * 0.3;
  const bodyRight = w - rightBulgeR * 0.95 - inset * 0.3;

  return `
    M ${bodyLeft} ${bodyTop}
    L ${bodyRight} ${bodyTop}
    A ${rightBulgeR} ${rightBulgeR} 0 0 1 ${bodyRight} ${bodyBottom}
    L ${bodyLeft} ${bodyBottom}
    A ${leftBulgeR} ${leftBulgeR} 0 0 1 ${bodyLeft} ${bodyTop}
    Z
  `;
}

export const nfcChipProduct: DesignerProduct = {
  id: 'nfc-chip',
  name: 'NFC Einkaufswagenchip',
  widthMm,
  heightMm,
  pxPerMm,
  safeMarginMm: 1.5,
  shape: 'custom',

  hole: {
    x: 4.4,
    y: 11.5,
    radius: 2.1,
  },

  clipPathSvg: (stageW, stageH) => buildChipPath(stageW, stageH),

  safeAreaSvg: (stageW, stageH, inset) => buildChipSafePath(stageW, stageH, inset),

  backgrounds: {
    black: '/products/nfc-chip/black.png',
    silver: '/products/nfc-chip/silver.png',
    gold: '/products/nfc-chip/gold.png',
  },

  preview: {
    black: {
      fallbackColor: '#f3f4f6',
      backgroundImage: '/backgrounds/Ek-weiss.png',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    },
    silver: {
      fallbackColor: '#f3f4f6',
      backgroundImage: '/backgrounds/Ek-weiss.png',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    },
    gold: {
      fallbackColor: '#f3f4f6',
      backgroundImage: '/backgrounds/Ek-weiss.png',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    },
  },

  frameStyles: {
    black: {
      border: '#3f3f46',
      gridLine: 'rgba(255,255,255,0.08)',
      safeArea: '#60a5fa',
    },
    silver: {
      border: '#9ca3af',
      gridLine: 'rgba(0,0,0,0.08)',
      safeArea: '#2563eb',
    },
    gold: {
      border: '#a16207',
      gridLine: 'rgba(0,0,0,0.08)',
      safeArea: '#2563eb',
    },
  },

  cardLabels: {
    black: 'NFC Chip Schwarz',
    silver: 'NFC Chip Silber',
    gold: 'NFC Chip Gold',
  },

  frontDefaultFields,
  backDefaultFields,
};
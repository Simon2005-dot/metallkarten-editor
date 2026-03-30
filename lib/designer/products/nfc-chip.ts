import type { DesignerProduct, TextField, QrField } from '@/lib/designer/types';
import { DEFAULT_FONT_FAMILY, DEFAULT_TEXT_COLOR } from '@/lib/designer/constants';

const widthMm = 56.77;
const heightMm = 23;
const pxPerMm = 10;

const stageW = Math.round(widthMm * pxPerMm);
const stageH = Math.round(heightMm * pxPerMm);

const frontDefaultFields: Array<TextField | QrField> = [
  {
    id: 'chip-title',
    type: 'multiline',
    label: 'Titel',
    text: 'NFC Chip',
    x: 150,
    y: 82,
    fontSize: 22,
    fontWeight: 700,
    align: 'left',
    color: DEFAULT_TEXT_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
  },
];

const backDefaultFields: Array<TextField | QrField> = [];

function buildChipOuterPath(w: number, h: number) {
  const cy = h / 2;

  return `
    M 34 ${cy}
    C 40 38, 72 18, 120 18
    L ${w - 120} 18
    C ${w - 70} 18, ${w - 26} 44, ${w - 18} ${cy}
    C ${w - 26} ${h - 44}, ${w - 70} ${h - 18}, ${w - 120} ${h - 18}
    L 140 ${h - 18}
    C 96 ${h - 18}, 62 ${h - 34}, 42 ${h - 52}
    C 28 ${h - 64}, 26 ${h - 74}, 34 ${cy}
    Z
  `;
}

function buildChipSafePath(w: number, h: number) {
  const cy = h / 2;

  return `
    M 56 ${cy}
    C 64 54, 92 36, 136 36
    L ${w - 136} 36
    C ${w - 92} 36, ${w - 54} 58, ${w - 46} ${cy}
    C ${w - 54} ${h - 58}, ${w - 92} ${h - 36}, ${w - 136} ${h - 36}
    L 156 ${h - 36}
    C 118 ${h - 36}, 88 ${h - 48}, 68 ${h - 64}
    C 56 ${h - 74}, 50 ${h - 82}, 56 ${cy}
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
    x: 5.2,
    y: 11.5,
    radius: 2.1,
  },

  clipPathSvg: () => buildChipOuterPath(stageW, stageH),

  safeAreaSvg: () => buildChipSafePath(stageW, stageH),

  backgrounds: {
    black: '/products/nfc-chip/black.png',
    silver: '/products/nfc-chip/silver.png',
    gold: '/products/nfc-chip/gold.png',
  },

  preview: {
    black: {
      fallbackColor: '#f3f4f6',
      backgroundImage: '/backgrounds/Ek-weiss.png',
      backgroundSize: '100% 100%',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    },
    silver: {
      fallbackColor: '#f3f4f6',
      backgroundImage: '/backgrounds/Ek-weiss.png',
      backgroundSize: '100% 100%',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    },
    gold: {
      fallbackColor: '#f3f4f6',
      backgroundImage: '/backgrounds/Ek-weiss.png',
      backgroundSize: '100% 100%',
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
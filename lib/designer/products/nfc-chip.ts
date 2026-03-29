import type { DesignerProduct, TextField, QrField } from '@/lib/designer/types';
import { DEFAULT_FONT_FAMILY, DEFAULT_TEXT_COLOR } from '@/lib/designer/constants';

const widthMm = 23;
const heightMm = 56.77;
const pxPerMm = 8;

const frontDefaultFields: Array<TextField | QrField> = [
  {
    id: 'chip-title',
    type: 'multiline',
    label: 'Titel',
    text: 'NFC Chip',
    x: 28,
    y: 20,
    fontSize: 14,
    fontWeight: 700,
    align: 'center',
    color: DEFAULT_TEXT_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
  },
];

const backDefaultFields: Array<TextField | QrField> = [];

export const nfcChipProduct: DesignerProduct = {
  id: 'nfc-chip',
  name: 'NFC Einkaufswagenchip',
  widthMm,
  heightMm,
  pxPerMm,
  safeMarginMm: 1.5,
  shape: 'custom',

  hole: {
    x: 11.5,
    y: 49.5,
    radius: 2,
  },

  clipPathSvg: (stageW, stageH) => {
    const w = stageW;
    const h = stageH;
    const centerX = w / 2;
    const topRadius = w / 2;
    const shoulderY = topRadius + 22;
    const bottomRadius = w * 0.35;
    const outerLeft = 0;
    const outerRight = w;

    const slotOuterWidth = w * 0.52;
    const slotInnerWidth = w * 0.34;
    const slotTopY = h * 0.56;
    const slotBottomY = h * 0.88;

    const slotLeft = centerX - slotOuterWidth / 2;
    const slotRight = centerX + slotOuterWidth / 2;
    const innerSlotLeft = centerX - slotInnerWidth / 2;
    const innerSlotRight = centerX + slotInnerWidth / 2;

    return `
      M ${outerLeft} ${shoulderY}
      L ${outerLeft} ${h - bottomRadius}
      A ${bottomRadius} ${bottomRadius} 0 0 0 ${outerRight} ${h - bottomRadius}
      L ${outerRight} ${shoulderY}
      A ${topRadius} ${topRadius} 0 0 0 ${outerLeft} ${shoulderY}
      Z

      M ${slotLeft} ${slotTopY}
      L ${slotLeft} ${slotBottomY}
      A ${bottomRadius * 0.9} ${bottomRadius * 0.9} 0 0 0 ${slotRight} ${slotBottomY}
      L ${slotRight} ${slotTopY}
      L ${innerSlotRight} ${slotTopY}
      L ${innerSlotRight} ${slotBottomY - 8}
      A ${bottomRadius * 0.55} ${bottomRadius * 0.55} 0 0 1 ${innerSlotLeft} ${slotBottomY - 8}
      L ${innerSlotLeft} ${slotTopY}
      Z
    `;
  },

  backgrounds: {
    black: '/products/nfc-chip/black.png',
    silver: '/products/nfc-chip/silver.png',
    gold: '/products/nfc-chip/gold.png',
  },

  preview: {
    black: {
      fallbackColor: '#1f2937',
      backgroundImage: '/products/nfc-chip/black.png',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    },
    silver: {
      fallbackColor: '#d1d5db',
      backgroundImage: '/products/nfc-chip/silver.png',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    },
    gold: {
      fallbackColor: '#d4af37',
      backgroundImage: '/products/nfc-chip/gold.png',
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
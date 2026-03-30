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
    x: 110,
    y: 78,
    fontSize: 24,
    fontWeight: 700,
    align: 'left',
    color: DEFAULT_TEXT_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
  },
];

const backDefaultFields: Array<TextField | QrField> = [];

function buildChipPath(w: number, h: number) {
  const cy = h / 2;

  // Linke kleinere Rundung
  const leftR = h * 0.24;
  const leftCx = leftR + 6;

  // Rechte größere Rundung
  const rightR = h * 0.47;
  const rightCx = w - rightR - 6;

  // Gerade Mittelzone
  const topY = h * 0.10;
  const bottomY = h * 0.90;

  // Übergangspunkte links/rechts
  const startX = leftCx - leftR * 0.95;
  const bodyLeft = leftCx + leftR * 0.75;
  const bodyRight = rightCx - rightR * 0.82;
  const endX = rightCx + rightR * 0.98;

  // Schulterpunkte für weichere Übergänge
  const topLeftShoulderX = bodyLeft - 22;
  const topRightShoulderX = bodyRight + 16;
  const bottomRightShoulderX = bodyRight + 18;
  const bottomLeftShoulderX = bodyLeft - 20;

  return `
    M ${startX} ${cy}

    C ${startX + 8} ${topY + 12},
      ${topLeftShoulderX - 8} ${topY},
      ${bodyLeft} ${topY}

    L ${bodyRight} ${topY}

    C ${topRightShoulderX} ${topY},
      ${endX} ${cy - rightR * 0.55},
      ${endX} ${cy}

    C ${endX} ${cy + rightR * 0.55},
      ${bottomRightShoulderX} ${bottomY},
      ${bodyRight} ${bottomY}

    L ${bodyLeft} ${bottomY}

    C ${bottomLeftShoulderX} ${bottomY},
      ${startX + 8} ${cy + leftR * 0.9},
      ${startX} ${cy}

    Z
  `;
}

function buildChipSafePath(w: number, h: number, inset: number) {
  const cy = h / 2;

  const leftR = h * 0.24 - inset * 0.35;
  const leftCx = leftR + 6 + inset * 0.4;

  const rightR = h * 0.47 - inset * 0.4;
  const rightCx = w - rightR - 6 - inset * 0.4;

  const topY = h * 0.10 + inset;
  const bottomY = h * 0.90 - inset;

  const startX = leftCx - leftR * 0.88;
  const bodyLeft = leftCx + leftR * 0.78 + inset * 0.2;
  const bodyRight = rightCx - rightR * 0.80 - inset * 0.2;
  const endX = rightCx + rightR * 0.92;

  const topLeftShoulderX = bodyLeft - 18;
  const topRightShoulderX = bodyRight + 12;
  const bottomRightShoulderX = bodyRight + 14;
  const bottomLeftShoulderX = bodyLeft - 16;

  return `
    M ${startX} ${cy}

    C ${startX + 7} ${topY + 10},
      ${topLeftShoulderX - 6} ${topY},
      ${bodyLeft} ${topY}

    L ${bodyRight} ${topY}

    C ${topRightShoulderX} ${topY},
      ${endX} ${cy - rightR * 0.50},
      ${endX} ${cy}

    C ${endX} ${cy + rightR * 0.50},
      ${bottomRightShoulderX} ${bottomY},
      ${bodyRight} ${bottomY}

    L ${bodyLeft} ${bottomY}

    C ${bottomLeftShoulderX} ${bottomY},
      ${startX + 7} ${cy + leftR * 0.82},
      ${startX} ${cy}

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
    radius: 2.0,
  },

  clipPathSvg: (stageW, stageH) => buildChipPath(stageW, stageH),

  safeAreaSvg: (stageW, stageH, inset) =>
    buildChipSafePath(stageW, stageH, inset),

  backgrounds: {
    black: '/products/nfc-chip/black.png',
    silver: '/products/nfc-chip/silver.png',
    gold: '/products/nfc-chip/gold.png',
  },

  preview: {
    black: {
      fallbackColor: '#f3f4f6',
      backgroundImage: '/backgrounds/Ek-weiss.png',
      backgroundSize: 'contain',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    },
    silver: {
      fallbackColor: '#f3f4f6',
      backgroundImage: '/backgrounds/Ek-weiss.png',
      backgroundSize: 'contain',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    },
    gold: {
      fallbackColor: '#f3f4f6',
      backgroundImage: '/backgrounds/Ek-weiss.png',
      backgroundSize: 'contain',
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
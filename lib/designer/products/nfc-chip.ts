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
    x: 170,
    y: 86,
    fontSize: 22,
    fontWeight: 700,
    align: 'left',
    color: DEFAULT_TEXT_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
  },
];

const backDefaultFields: Array<TextField | QrField> = [];

function buildFullImageClipPath(w: number, h: number) {
  // Ganze Bühne als ClipPath, weil das Produktbild selbst die echte Form zeigt.
  // Dadurch wird nichts mehr künstlich "schief" nachgebaut.
  return `
    M 0 0
    L ${w} 0
    L ${w} ${h}
    L 0 ${h}
    Z
  `;
}

function buildSimpleSafeAreaPath(w: number, h: number) {
  // Vereinfachter Sicherheitsbereich:
  // - Startet rechts vom Loch
  // - Läuft mittig rechteckig
  // - Hat rechts einen runden Abschluss

  const top = 30;
  const bottom = h - 30;
  const left = 72; // rechts vom Loch
  const radius = (bottom - top) / 2;
  const rightArcCenterX = w - 34;
  const rightJoinX = rightArcCenterX - radius;
  const cy = h / 2;

  return `
    M ${left} ${top}
    L ${rightJoinX} ${top}
    A ${radius} ${radius} 0 0 1 ${rightJoinX} ${bottom}
    L ${left} ${bottom}
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

  // Lochposition in mm
  hole: {
    x: 5.2,
    y: 11.5,
    radius: 2.1,
  },

  // Ganze Bildfläche benutzen
  clipPathSvg: (stageW, stageH) => buildFullImageClipPath(stageW, stageH),

  // Vereinfachter Sicherheitsbereich
  safeAreaSvg: (stageW, stageH) => buildSimpleSafeAreaPath(stageW, stageH),

  backgrounds: {
    black: '/backgrounds/Ek-weiss.png',
    silver: '/backgrounds/Ek-weiss.png',
    gold: '/backgrounds/Ek-weiss.png',
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
      border: 'rgba(0,0,0,0.12)',
      gridLine: 'rgba(0,0,0,0.06)',
      safeArea: '#60a5fa',
    },
    silver: {
      border: 'rgba(0,0,0,0.12)',
      gridLine: 'rgba(0,0,0,0.06)',
      safeArea: '#2563eb',
    },
    gold: {
      border: 'rgba(0,0,0,0.12)',
      gridLine: 'rgba(0,0,0,0.06)',
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
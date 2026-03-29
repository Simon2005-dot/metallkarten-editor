import type { CardFinishKey, Field } from '@/lib/designer/types';
import { DEFAULT_TEXT_COLOR, DEFAULT_FONT_FAMILY, NFC_ICON_SRC } from '@/lib/designer/constants';

const widthMm = 85.6;
const heightMm = 53.98;
const pxPerMm = 7;

const stageW = Math.round(widthMm * pxPerMm);
const stageH = Math.round(heightMm * pxPerMm);

const frontDefaultFields: Field[] = [
  {
    id: 'name',
    type: 'multiline',
    label: 'Name',
    text: 'Max Mustermann',
    x: 20,
    y: 20,
    fontSize: 24,
    fontWeight: 700,
    align: 'left',
    color: DEFAULT_TEXT_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
  },
  {
    id: 'role',
    type: 'multiline',
    label: 'Position',
    text: 'Geschäftsführer',
    x: 20,
    y: 54,
    fontSize: 14,
    fontWeight: 500,
    align: 'left',
    color: DEFAULT_TEXT_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
  },
  {
    id: 'company',
    type: 'multiline',
    label: 'Firma',
    text: 'Musterfirma GmbH',
    x: 20,
    y: 80,
    fontSize: 16,
    fontWeight: 600,
    align: 'left',
    color: DEFAULT_TEXT_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
  },
  {
    id: 'contact',
    type: 'multiline',
    label: 'Kontakt',
    text: '+49 170 0000000\nmax@firma.de\nwww.firma.de',
    x: 20,
    y: 114,
    fontSize: 12,
    fontWeight: 400,
    align: 'left',
    color: DEFAULT_TEXT_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
  },
  {
    id: 'qr-front',
    type: 'qr',
    label: 'QR Platzhalter',
    text: '',
    x: stageW - 120,
    y: stageH - 120,
    size: 90,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
];

const backDefaultFields: Field[] = [
  {
    id: 'back-title',
    type: 'multiline',
    label: 'Rückseite Titel',
    text: 'Digitale Visitenkarte',
    x: 28,
    y: 36,
    fontSize: 22,
    fontWeight: 700,
    align: 'left',
    color: DEFAULT_TEXT_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
  },
  {
    id: 'back-sub',
    type: 'multiline',
    label: 'Rückseite Text',
    text: 'Scanne den QR-Code\nund speichere den Kontakt direkt.',
    x: 28,
    y: 82,
    fontSize: 14,
    fontWeight: 400,
    align: 'left',
    color: DEFAULT_TEXT_COLOR,
    fontFamily: DEFAULT_FONT_FAMILY,
  },
  {
    id: 'back-qr',
    type: 'qr',
    label: 'QR Platzhalter Rückseite',
    text: '',
    x: stageW - 150,
    y: 40,
    size: 110,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  {
    id: 'back-nfc-icon',
    type: 'logo',
    label: 'NFC Symbol',
    src: NFC_ICON_SRC,
    originalSrc: NFC_ICON_SRC,
    exportSrc: NFC_ICON_SRC,
    x: 518,
    y: 301,
    width: 60,
    height: 56,
    filename: 'nfc-tap-here.png',
    removedBackground: false,
    vectorStatus: 'idle',
  },
];

export const metalCardProduct = {
  id: 'metal-card',
  name: 'Metallkarte',
  widthMm,
  heightMm,
  pxPerMm,
  safeMarginMm: 3,

  backgrounds: {
    black: '/card-backgrounds/black.png',
    silver: '/card-backgrounds/silver.png',
    gold: '/card-backgrounds/gold.png',
  } satisfies Record<CardFinishKey, string>,

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
  } satisfies Record<CardFinishKey, { border: string; gridLine: string; safeArea: string }>,

  cardLabels: {
    black: 'Schwarz',
    silver: 'Silber',
    gold: 'Gold',
  } satisfies Record<CardFinishKey, string>,

  frontDefaultFields,
  backDefaultFields,
};
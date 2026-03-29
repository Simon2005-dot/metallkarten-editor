import type { Field, DesignerProduct } from '@/lib/designer/types';
import {
  DEFAULT_TEXT_COLOR,
  DEFAULT_FONT_FAMILY,
  NFC_ICON_SRC,
} from '@/lib/designer/constants';

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
    x: stageW - 80,
    y: stageH - 70,
    width: 60,
    height: 56,
    filename: 'nfc-tap-here.png',
    removedBackground: false,
    vectorStatus: 'idle',
  },
];

export const metalCardProduct: DesignerProduct = {
  id: 'metal-card',
  name: 'Metallkarte',
  widthMm: 85.6,
  heightMm: 54,
  pxPerMm: 12,
  safeMarginMm: 3,
  shape: 'rect',

  backgrounds: {
    black: '/backgrounds/metal-black.png',
    silver: '/backgrounds/metal-silver.png',
    gold: '/backgrounds/metal-gold.png',
  },

  frameStyles: {
    black: {
      border: '#374151',
      gridLine: 'rgba(255,255,255,0.06)',
      safeArea: '#9ca3af',
    },
    silver: {
      border: '#9ca3af',
      gridLine: 'rgba(0,0,0,0.06)',
      safeArea: '#6b7280',
    },
    gold: {
      border: '#a16207',
      gridLine: 'rgba(0,0,0,0.06)',
      safeArea: '#92400e',
    },
  },

  cardLabels: {
    black: 'Schwarz',
    silver: 'Silber',
    gold: 'Gold',
  },

  frontDefaultFields,
  backDefaultFields,
};
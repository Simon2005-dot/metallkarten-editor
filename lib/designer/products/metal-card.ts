import type { DesignerProduct, Field } from '@/lib/designer/types';
import {
  DEFAULT_TEXT_COLOR,
  DEFAULT_FONT_FAMILY,
  NFC_ICON_SRC,
} from '@/lib/designer/constants';

const widthMm = 85.6;
const heightMm = 54;
const pxPerMm = 8;

const stageW = Math.round(widthMm * pxPerMm);
const stageH = Math.round(heightMm * pxPerMm);

const frontDefaultFields: Field[] = [
  {
    id: 'name',
    type: 'multiline',
    label: 'Name',
    text: 'Max Mustermann',
    x: 80,
    y: 70,
    fontSize: 32,
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
    x: 80,
    y: 120,
    fontSize: 18,
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
    x: 80,
    y: 170,
    fontSize: 22,
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
    x: 80,
    y: 240,
    fontSize: 16,
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
    x: stageW - 180,
    y: stageH - 180,
    size: 120,
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
    x: 80,
    y: 110,
    fontSize: 28,
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
    x: 80,
    y: 180,
    fontSize: 18,
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
    x: stageW - 220,
    y: 90,
    size: 150,
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
    x: stageW - 140,
    y: stageH - 90,
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
  widthMm,
  heightMm,
  pxPerMm,
  safeMarginMm: 3,
  shape: 'rect',

  backgrounds: {
    black: '/backgrounds/metal-black.png',
    silver: '/backgrounds/metal-silver.png',
    gold: '/backgrounds/metal-gold.png',
  },

  preview: {
    black: {
      fallbackColor: '#1f2937',
      backgroundImage: '/backgrounds/metal-black.png',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    },
    silver: {
      fallbackColor: '#d1d5db',
      backgroundImage: '/backgrounds/metal-silver.png',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    },
    gold: {
      fallbackColor: '#d4af37',
      backgroundImage: '/backgrounds/metal-gold.png',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    },
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
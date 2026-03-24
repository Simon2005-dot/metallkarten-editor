'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import JSZip from 'jszip';

type FontFamilyKey =
  | 'arial'
  | 'helvetica'
  | 'times'
  | 'georgia'
  | 'verdana'
  | 'tahoma'
  | 'trebuchet'
  | 'courier';

type BaseField = {
  id: string;
  label: string;
  x: number;
  y: number;
};

type TextField = BaseField & {
  type: 'text' | 'multiline';
  text: string;
  fontSize: number;
  fontWeight: number;
  align: 'left' | 'center' | 'right';
  color?: string;
  fontFamily: FontFamilyKey;
};

type QrField = BaseField & {
  type: 'qr';
  text: string;
  size: number;
};

type LogoField = BaseField & {
  type: 'logo';
  src: string;
  originalSrc?: string;
  exportSrc?: string;
  width: number;
  height: number;
  filename: string;
  removedBackground?: boolean;
  threshold?: number;
  laserMode?: 'original' | 'no-bg' | 'laser';
  laserThreshold?: number;
};

type Field = TextField | QrField | LogoField;
type Side = 'front' | 'back';
type CardFinishKey = 'black' | 'silver' | 'gold';

type DragState = {
  id: string;
  offsetX: number;
  offsetY: number;
} | null;

type ResizeState = {
  id: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
} | null;

type GuideLine =
  | { type: 'vertical'; x: number }
  | { type: 'horizontal'; y: number };

type PreparedQrField = QrField & { qrMatrix?: boolean[][] | null };
type PreparedField = TextField | LogoField | PreparedQrField;

type CardDesign = {
  id: string;
  name: string;
  cardFinish: CardFinishKey;
  showFrontQr: boolean;
  showBackQr: boolean;
  frontFields: Field[];
  backFields: Field[];
};

const CARD_WIDTH = 85.6;
const CARD_HEIGHT = 53.98;
const PX_PER_MM = 7;
const STAGE_W = Math.round(CARD_WIDTH * PX_PER_MM);
const STAGE_H = Math.round(CARD_HEIGHT * PX_PER_MM);
const SAFE_MARGIN_MM = 3;
const SAFE_MARGIN = SAFE_MARGIN_MM * PX_PER_MM;
const DEFAULT_TEXT_COLOR = '#000000';
const DEFAULT_FONT_FAMILY: FontFamilyKey = 'arial';
const SNAP_THRESHOLD = 6;
const GRID_SIZE = 4;

const FONT_OPTIONS: Record<FontFamilyKey, string> = {
  arial: 'Arial, Helvetica, sans-serif',
  helvetica: 'Helvetica, Arial, sans-serif',
  times: '"Times New Roman", Times, serif',
  georgia: 'Georgia, serif',
  verdana: 'Verdana, Geneva, sans-serif',
  tahoma: 'Tahoma, Geneva, sans-serif',
  trebuchet: '"Trebuchet MS", sans-serif',
  courier: '"Courier New", Courier, monospace',
};

const FONT_LABELS: Record<FontFamilyKey, string> = {
  arial: 'Arial',
  helvetica: 'Helvetica',
  times: 'Times New Roman',
  georgia: 'Georgia',
  verdana: 'Verdana',
  tahoma: 'Tahoma',
  trebuchet: 'Trebuchet MS',
  courier: 'Courier New',
};

const CARD_BACKGROUNDS: Record<CardFinishKey, string> = {
  black: '/card-backgrounds/black.png',
  silver: '/card-backgrounds/silver.png',
  gold: '/card-backgrounds/gold.png',
};

const CARD_FRAME_STYLES: Record<
  CardFinishKey,
  { border: string; gridLine: string; safeArea: string }
> = {
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
};

const CARD_LABELS: Record<CardFinishKey, string> = {
  black: 'Schwarz',
  silver: 'Silber',
  gold: 'Gold',
};

function getLaserColor(cardFinish: CardFinishKey, side: Side) {
  if (cardFinish === 'silver') {
    return side === 'front' ? '#be6a44' : '#111111';
  }

  if (cardFinish === 'black') {
    return side === 'front' ? '#d1d5db' : '#c97a2b';
  }

  if (cardFinish === 'gold') {
    return side === 'front' ? '#2b1e05' : '#3a2a0a';
  }

  return '#111111';
}

const frontDefaultFields: Field[] = [
  {
    id: 'name',
    type: 'text',
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
    type: 'text',
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
    type: 'text',
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
    x: STAGE_W - 120,
    y: STAGE_H - 120,
    size: 90,
  },
];

const backDefaultFields: Field[] = [
  {
    id: 'back-title',
    type: 'text',
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
    x: STAGE_W - 150,
    y: 40,
    size: 110,
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function mmToPx(mm: number) {
  return mm * PX_PER_MM;
}

function pxToMm(px: number) {
  return px / PX_PER_MM;
}

function roundToGrid(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function escapeXml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeAttribute(str = '') {
  return escapeXml(str).replace(/\n/g, '&#10;');
}

function sanitizeOrderNumber(value: string) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

function normalizeQrValue(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/.*)?$/i.test(raw)) return `https://${raw}`;
  return raw;
}

function buildUniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneFields(fields: Field[]): Field[] {
  return fields.map((field) => ({
    ...field,
    id: buildUniqueId(field.id),
  }));
}

function createNewCardDesign(index = 1): CardDesign {
  return {
    id: buildUniqueId('card'),
    name: `Karte ${index}`,
    cardFinish: 'black',
    showFrontQr: true,
    showBackQr: true,
    frontFields: cloneFields(frontDefaultFields),
    backFields: cloneFields(backDefaultFields),
  };
}

async function buildQrMatrix(text: string): Promise<boolean[][] | null> {
  const value = normalizeQrValue(text);
  if (!value) return null;

  try {
    const qr = qrcode(0, 'H');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();

    return Array.from({ length: count }, (_, y) =>
      Array.from({ length: count }, (_, x) => qr.isDark(y, x)),
    );
  } catch {
    return null;
  }
}

function fallbackQrMatrix(text: string, size = 25) {
  const data = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  let seed = 0;

  for (let i = 0; i < text.length; i++) {
    seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  }

  function addFinder(px: number, py: number) {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const outer = x === 0 || y === 0 || x === 6 || y === 6;
        const inner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        data[py + y][px + x] = outer || inner;
      }
    }
  }

  addFinder(0, 0);
  addFinder(size - 7, 0);
  addFinder(0, size - 7);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inFinder = (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
      if (inFinder) continue;
      seed = (1664525 * seed + 1013904223) >>> 0;
      data[y][x] = (seed & 1) === 1;
    }
  }

  return data;
}

function getQrModuleRect(moduleSize: number) {
  const inset = Math.max(0.08, moduleSize * 0.08);
  const size = Math.max(0.2, moduleSize - inset * 2);
  return { offset: inset, size };
}

function textToSvg(field: TextField) {
  const lines = String(field.text || '').split('\n');
  const anchor = field.align === 'center' ? 'middle' : field.align === 'right' ? 'end' : 'start';
  const fill = field.color || DEFAULT_TEXT_COLOR;
  const fontFamily = FONT_OPTIONS[field.fontFamily] || FONT_OPTIONS[DEFAULT_FONT_FAMILY];

  return lines
    .map((line, index) => {
      const y = field.y + index * (field.fontSize * 1.35) + field.fontSize;
      return `<text x="${field.x}" y="${y}" font-size="${field.fontSize}" font-family="${escapeAttribute(
        fontFamily,
      )}" font-weight="${field.fontWeight}" text-anchor="${anchor}" fill="${escapeAttribute(
        fill,
      )}">${escapeXml(line)}</text>`;
    })
    .join('');
}

function qrSvgGroup(field: PreparedQrField) {
  const qrMatrix =
    field.qrMatrix && field.qrMatrix.length > 0
      ? field.qrMatrix
      : fallbackQrMatrix(field.text || 'placeholder');

  const moduleSize = field.size / qrMatrix.length;
  const { offset, size } = getQrModuleRect(moduleSize);
  let rects = '';

  qrMatrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      rects += `<rect x="${field.x + x * moduleSize + offset}" y="${field.y + y * moduleSize + offset}" width="${size}" height="${size}" fill="black" shape-rendering="crispEdges" />`;
    });
  });

  return rects;
}

function logoToSvg(field: LogoField) {
  const href = field.exportSrc || field.src;
  return `<image x="${field.x}" y="${field.y}" width="${field.width}" height="${field.height}" href="${escapeAttribute(
    href,
  )}" xlink:href="${escapeAttribute(href)}" preserveAspectRatio="xMidYMid meet" />`;
}

function fieldBounds(field: Field) {
  if (field.type === 'qr') return { width: field.size, height: field.size };
  if (field.type === 'logo') return { width: field.width, height: field.height };

  const lines = String(field.text || '').split('\n');
  const maxChars = Math.max(...lines.map((line) => line.length), 1);
  const width = Math.max(40, maxChars * field.fontSize * 0.62);
  const height = Math.max(lines.length, 1) * field.fontSize * 1.35;
  return { width, height };
}

function duplicateField(field: Field): Field {
  return {
    ...field,
    id: buildUniqueId(field.id),
    label: `${field.label} Kopie`,
    x: field.x + 16,
    y: field.y + 16,
  };
}

function ensureBlackText(fields: Field[]) {
  return fields.map((field) => {
    if (field.type === 'text' || field.type === 'multiline') {
      return { ...field, color: DEFAULT_TEXT_COLOR };
    }
    return field;
  });
}

async function normalizeLogoForExport(src: string) {
  if (!src || src.startsWith('data:')) return src;

  try {
    const response = await fetch(src, { mode: 'cors' });
    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || src));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return src;
  }
}

async function prepareFieldsForExport(fields: Field[]): Promise<PreparedField[]> {
  return Promise.all(
    ensureBlackText(fields).map(async (field) => {
      if (field.type === 'logo') {
        const exportSrc = await normalizeLogoForExport(field.exportSrc || field.src);
        return { ...field, exportSrc };
      }

      if (field.type === 'qr') {
        const normalizedText = normalizeQrValue(field.text);
        const qrMatrix = await buildQrMatrix(normalizedText || 'placeholder');
        return { ...field, text: normalizedText, qrMatrix };
      }

      return field;
    }),
  );
}

function exportSideSvg(
  fields: PreparedField[],
  includeGuide: boolean,
  meta: { orderNumber: string; side: Side; cardName: string },
) {
  const content = fields
    .map((field) => {
      if (field.type === 'text' || field.type === 'multiline') return textToSvg(field);
      if (field.type === 'qr') return qrSvgGroup(field);
      if (field.type === 'logo') return logoToSvg(field);
      return '';
    })
    .join('\n');

  const guide = includeGuide
    ? `
      <rect x="1" y="1" width="${STAGE_W - 2}" height="${STAGE_H - 2}" fill="none" stroke="#ff00aa" stroke-width="1" />
      <rect x="${SAFE_MARGIN}" y="${SAFE_MARGIN}" width="${STAGE_W - SAFE_MARGIN * 2}" height="${STAGE_H - SAFE_MARGIN * 2}" fill="none" stroke="#ff00aa" stroke-dasharray="6 4" stroke-width="1" />
      <line x1="${STAGE_W / 2}" y1="0" x2="${STAGE_W / 2}" y2="${STAGE_H}" stroke="#00a3ff" stroke-dasharray="6 4" stroke-width="1" />
      <line x1="0" y1="${STAGE_H / 2}" x2="${STAGE_W}" y2="${STAGE_H / 2}" stroke="#00a3ff" stroke-dasharray="6 4" stroke-width="1" />
    `
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${CARD_WIDTH}mm" height="${CARD_HEIGHT}mm"
     viewBox="0 0 ${STAGE_W} ${STAGE_H}">
  <title>${escapeXml(meta.cardName)} - ${escapeXml(meta.side)}</title>
  <desc>
    Bestellnummer: ${escapeXml(meta.orderNumber)}
    | Seite: ${escapeXml(meta.side)}
    | Kartenname: ${escapeXml(meta.cardName)}
  </desc>
  <metadata>
    {"orderNumber":"${escapeXml(meta.orderNumber)}","side":"${escapeXml(meta.side)}"}
  </metadata>
  ${guide}
  ${content}
</svg>`;
}

function getTextBaselines(field: TextField, y: number) {
  const lines = String(field.text || '').split('\n');
  return lines.map((_, index) => y + index * (field.fontSize * 1.35) + field.fontSize);
}

function getFieldSnapPoints(field: Field) {
  const bounds = fieldBounds(field);
  const xPoints = [field.x, field.x + bounds.width / 2, field.x + bounds.width];
  const yPoints = [field.y, field.y + bounds.height / 2, field.y + bounds.height];

  if (field.type === 'text' || field.type === 'multiline') {
    yPoints.push(...getTextBaselines(field, field.y));
  }

  return { xPoints, yPoints };
}

function dedupeGuides(guides: GuideLine[]) {
  const vertical = new Map<number, GuideLine>();
  const horizontal = new Map<number, GuideLine>();

  for (const guide of guides) {
    if (guide.type === 'vertical') vertical.set(Math.round(guide.x), guide);
    if (guide.type === 'horizontal') horizontal.set(Math.round(guide.y), guide);
  }

  return [...vertical.values(), ...horizontal.values()];
}

function snapPositionToOtherFields(
  movingField: Field,
  nextX: number,
  nextY: number,
  otherFields: Field[],
  threshold = SNAP_THRESHOLD,
) {
  const bounds = fieldBounds(movingField);

  const movingXPoints = [nextX, nextX + bounds.width / 2, nextX + bounds.width];
  const movingYPoints = [nextY, nextY + bounds.height / 2, nextY + bounds.height];

  if (movingField.type === 'text' || movingField.type === 'multiline') {
    movingYPoints.push(...getTextBaselines(movingField, nextY));
  }

  let snappedX = nextX;
  let snappedY = nextY;
  let bestDx = threshold + 1;
  let bestDy = threshold + 1;
  const guides: GuideLine[] = [];

  for (const other of otherFields) {
    const { xPoints, yPoints } = getFieldSnapPoints(other);

    for (const sourceX of movingXPoints) {
      for (const targetX of xPoints) {
        const diff = targetX - sourceX;
        const absDiff = Math.abs(diff);
        if (absDiff <= threshold && absDiff < bestDx) {
          bestDx = absDiff;
          snappedX = nextX + diff;
        }
      }
    }

    for (const sourceY of movingYPoints) {
      for (const targetY of yPoints) {
        const diff = targetY - sourceY;
        const absDiff = Math.abs(diff);
        if (absDiff <= threshold && absDiff < bestDy) {
          bestDy = absDiff;
          snappedY = nextY + diff;
        }
      }
    }
  }

  if (bestDx <= threshold) {
    const adjustedXPoints = [snappedX, snappedX + bounds.width / 2, snappedX + bounds.width];
    for (const other of otherFields) {
      const { xPoints } = getFieldSnapPoints(other);
      for (const sourceX of adjustedXPoints) {
        for (const targetX of xPoints) {
          if (Math.abs(sourceX - targetX) <= 0.5) {
            guides.push({ type: 'vertical', x: targetX });
          }
        }
      }
    }
  }

  if (bestDy <= threshold) {
    const adjustedYPoints = [snappedY, snappedY + bounds.height / 2, snappedY + bounds.height];
    if (movingField.type === 'text' || movingField.type === 'multiline') {
      adjustedYPoints.push(...getTextBaselines(movingField, snappedY));
    }

    for (const other of otherFields) {
      const { yPoints } = getFieldSnapPoints(other);
      for (const sourceY of adjustedYPoints) {
        for (const targetY of yPoints) {
          if (Math.abs(sourceY - targetY) <= 0.5) {
            guides.push({ type: 'horizontal', y: targetY });
          }
        }
      }
    }
  }

  return {
    x: snappedX,
    y: snappedY,
    guides: dedupeGuides(guides),
  };
}

function Panel({
  title,
  children,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 14,
        padding: 14,
        background: '#ffffff',
        display: 'grid',
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        {subtitle ? (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{subtitle}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SelectionBadge({ width, height }: { width: number; height: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        right: -2,
        bottom: -22,
        fontSize: 11,
        background: '#4f46e5',
        color: '#fff',
        borderRadius: 999,
        padding: '2px 8px',
      }}
    >
      {pxToMm(width).toFixed(1)} × {pxToMm(height).toFixed(1)} mm
    </div>
  );
}

export default function MetallkartenEditor() {
  const initialCard = useMemo(() => createNewCardDesign(1), []);
  const [cards, setCards] = useState<CardDesign[]>([initialCard]);
  const [activeCardId, setActiveCardId] = useState<string>(initialCard.id);
  const [side, setSide] = useState<Side>('front');
  const [selectedId, setSelectedId] = useState<string>(initialCard.frontFields[0]?.id || '');
  const [dragging, setDragging] = useState<DragState>(null);
  const [resizing, setResizing] = useState<ResizeState>(null);
  const [guideLines, setGuideLines] = useState<GuideLine[]>([]);
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [showSafeArea, setShowSafeArea] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [pasteMessage, setPasteMessage] = useState<string>('');
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [, setQrMatrices] = useState<Record<string, boolean[][]>>({});

  const stageRef = useRef<HTMLDivElement | null>(null);
  const activeCard = cards.find((card) => card.id === activeCardId) || cards[0];

  const fields = side === 'front' ? activeCard.frontFields : activeCard.backFields;
  const visibleFields = fields.filter((field) => {
    if (field.type !== 'qr') return true;
    const isFrontQr = field.label.toLowerCase().includes('vorder') || field.id.includes('qr-front');
    const isBackQr = field.label.toLowerCase().includes('rück') || field.id.includes('back-qr');
    if (isFrontQr) return activeCard.showFrontQr;
    if (isBackQr) return activeCard.showBackQr;
    return true;
  });

  const selected = fields.find((f) => f.id === selectedId) || null;
  const cleanOrderNumber = sanitizeOrderNumber(orderNumber);
  const canExport = cleanOrderNumber.length >= 4;
  const previewTextColor = getLaserColor(activeCard.cardFinish, side);
  const currentBackground = CARD_BACKGROUNDS[activeCard.cardFinish];
  const frameStyle = CARD_FRAME_STYLES[activeCard.cardFinish];
  const protectedIds = fields.slice(0, 5).map((f) => f.id);

  const updateCardById = (cardId: string, patch: Partial<CardDesign>) => {
    setCards((current) => current.map((card) => (card.id === cardId ? { ...card, ...patch } : card)));
  };

  const updateActiveCard = (patch: Partial<CardDesign>) => {
    updateCardById(activeCardId, patch);
  };

  const updateActiveCardFields = (sideToUpdate: Side, updater: (fields: Field[]) => Field[]) => {
    setCards((current) =>
      current.map((card) => {
        if (card.id !== activeCardId) return card;

        return {
          ...card,
          frontFields: sideToUpdate === 'front' ? updater(card.frontFields) : card.frontFields,
          backFields: sideToUpdate === 'back' ? updater(card.backFields) : card.backFields,
        };
      }),
    );
  };

  const setFields = (updater: React.SetStateAction<Field[]>) => {
    updateActiveCardFields(side, (currentFields) =>
      typeof updater === 'function'
        ? (updater as (prev: Field[]) => Field[])(currentFields)
        : updater,
    );
  };

  useEffect(() => {
    const qrFields = cards
      .flatMap((card) => [...card.frontFields, ...card.backFields])
      .filter((field): field is QrField => field.type === 'qr');

    let active = true;

    const buildMatrices = async () => {
      const entries = await Promise.all(
        qrFields.map(async (field) => {
          const matrix = await buildQrMatrix(field.text || 'placeholder');
          return [
            field.id,
            matrix && matrix.length > 0 ? matrix : fallbackQrMatrix(field.text || 'placeholder'),
          ] as const;
        }),
      );

      if (active) setQrMatrices(Object.fromEntries(entries));
    };

    void buildMatrices();

    return () => {
      active = false;
    };
  }, [cards]);

  const updateField = (id: string, patch: Partial<Field>) => {
    setFields((current) =>
      current.map((f) => {
        if (f.id !== id) return f;
        const next = { ...f, ...patch } as Field;
        if (next.type === 'text' || next.type === 'multiline') next.color = DEFAULT_TEXT_COLOR;
        return next;
      }),
    );
  };

  const addTextField = () => {
    const id = buildUniqueId('text');
    const newField: TextField = {
      id,
      type: 'text',
      label: 'Neues Textfeld',
      text: 'Neuer Text',
      x: 40,
      y: 40,
      fontSize: 16,
      fontWeight: 500,
      align: 'left',
      color: DEFAULT_TEXT_COLOR,
      fontFamily: DEFAULT_FONT_FAMILY,
    };
    setFields((current) => [...current, newField]);
    setSelectedId(id);
  };

  const addMultilineField = () => {
    const id = buildUniqueId('multi');
    const newField: TextField = {
      id,
      type: 'multiline',
      label: 'Mehrzeilig',
      text: 'Text Zeile 1\nText Zeile 2',
      x: 40,
      y: 90,
      fontSize: 14,
      fontWeight: 400,
      align: 'left',
      color: DEFAULT_TEXT_COLOR,
      fontFamily: DEFAULT_FONT_FAMILY,
    };
    setFields((current) => [...current, newField]);
    setSelectedId(id);
  };

  const addQrField = () => {
    const id = buildUniqueId('qr');
    const newField: QrField = {
      id,
      type: 'qr',
      label: 'QR Platzhalter',
      text: '',
      x: 80,
      y: 80,
      size: 96,
    };
    setFields((current) => [...current, newField]);
    setSelectedId(id);
  };

  const addNewCard = () => {
    const newCard = createNewCardDesign(cards.length + 1);
    setCards((current) => [...current, newCard]);
    setActiveCardId(newCard.id);
    setSelectedId(newCard.frontFields[0]?.id || '');
    setSide('front');
    setGuideLines([]);
  };

  const duplicateActiveCard = () => {
    const duplicated: CardDesign = {
      ...activeCard,
      id: buildUniqueId('card'),
      name: `${activeCard.name} Kopie`,
      frontFields: cloneFields(activeCard.frontFields),
      backFields: cloneFields(activeCard.backFields),
    };

    setCards((current) => [...current, duplicated]);
    setActiveCardId(duplicated.id);
    setSelectedId(duplicated.frontFields[0]?.id || '');
    setSide('front');
    setGuideLines([]);
  };

  const loadImageElement = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const addLogoFromSource = async (src: string, filename: string) => {
    const exportSrc = await normalizeLogoForExport(src);
    const id = buildUniqueId('logo');
    const currentActiveCardId = activeCardId;
    const currentSide = side;

    const newLogo: LogoField = {
      id,
      type: 'logo',
      label: filename.toLowerCase().includes('screenshot') ? 'Screenshot Logo' : 'Logo',
      src,
      originalSrc: src,
      exportSrc,
      x: STAGE_W - 180,
      y: 24,
      width: 140,
      height: 80,
      filename,
      removedBackground: false,
      threshold: 235,
    };

    setFields((current) => [...current, newLogo]);
    setSelectedId(id);

    setTimeout(async () => {
      try {
        setIsProcessingImage(true);
        const img = await loadImageElement(src);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const whiteThreshold = 235;
        const laserThreshold = 160;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const alpha = data[i + 3];

          const isNearWhite = r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold;
          if (isNearWhite) {
            data[i + 3] = 0;
            continue;
          }

          if (alpha === 0) continue;

          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          const isDark = gray < laserThreshold;
          const value = isDark ? 0 : 255;

          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
          data[i + 3] = isDark ? 255 : 0;
        }

        ctx.putImageData(imageData, 0, 0);
        const laserReady = canvas.toDataURL('image/png');

        setCards((current) =>
          current.map((card) => {
            if (card.id !== currentActiveCardId) return card;

            const update = (list: Field[]) =>
              list.map((field) =>
                field.id === id
                  ? ({
                      ...field,
                      src: laserReady,
                      originalSrc: src,
                      exportSrc: laserReady,
                      removedBackground: true,
                      laserMode: 'laser',
                    } as LogoField)
                  : field,
              );

            return {
              ...card,
              frontFields: currentSide === 'front' ? update(card.frontFields) : card.frontFields,
              backFields: currentSide === 'back' ? update(card.backFields) : card.backFields,
            };
          }),
        );
      } finally {
        setIsProcessingImage(false);
      }
    }, 50);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy = duplicateField(selected);
    setFields((current) => [...current, copy]);
    setSelectedId(copy.id);
  };

  const removeField = (id: string) => {
    setFields((current) => current.filter((f) => f.id !== id));
    setSelectedId((current) => (current === id ? fields[0]?.id || '' : current));
  };

  const onLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await addLogoFromSource(String(reader.result), file.name);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const pointerPos = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>, field: Field) => {
    const pos = pointerPos(event);
    setSelectedId(field.id);
    setDragging({
      id: field.id,
      offsetX: pos.x - field.x,
      offsetY: pos.y - field.y,
    });
  };

  const clearInteractionState = () => {
    setDragging(null);
    setResizing(null);
    setGuideLines([]);
  };

  const onMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (resizing) {
      const field = fields.find((f) => f.id === resizing.id);
      if (!field) return;
      const pos = pointerPos(event);

      if (field.type === 'logo') {
        let nextWidth = resizing.startWidth + (pos.x - resizing.startX);
        let nextHeight = resizing.startHeight + (pos.y - resizing.startY);

        if (snapToGrid) {
          nextWidth = roundToGrid(nextWidth);
          nextHeight = roundToGrid(nextHeight);
        }

        nextWidth = clamp(nextWidth, 24, STAGE_W - field.x - SAFE_MARGIN);
        nextHeight = clamp(nextHeight, 24, STAGE_H - field.y - SAFE_MARGIN);
        setGuideLines([]);
        updateField(field.id, { width: nextWidth, height: nextHeight });
        return;
      }

      if (field.type === 'qr') {
        let nextSize = Math.max(
          resizing.startWidth + (pos.x - resizing.startX),
          resizing.startHeight + (pos.y - resizing.startY),
        );

        if (snapToGrid) nextSize = roundToGrid(nextSize);

        const maxSize = Math.min(STAGE_W - field.x - SAFE_MARGIN, STAGE_H - field.y - SAFE_MARGIN);
        nextSize = clamp(nextSize, 48, maxSize);
        setGuideLines([]);
        updateField(field.id, { size: nextSize });
      }
      return;
    }

    if (!dragging) return;
    const field = fields.find((f) => f.id === dragging.id);
    if (!field) return;

    const pos = pointerPos(event);
    const bounds = fieldBounds(field);

    let x = pos.x - dragging.offsetX;
    let y = pos.y - dragging.offsetY;

    if (snapToGrid) {
      x = roundToGrid(x);
      y = roundToGrid(y);
    }

    const otherFields = visibleFields.filter((f) => f.id !== field.id);
    const snapped = snapPositionToOtherFields(field, x, y, otherFields, SNAP_THRESHOLD);

    x = snapped.x;
    y = snapped.y;

    x = clamp(x, SAFE_MARGIN, STAGE_W - SAFE_MARGIN - bounds.width);
    y = clamp(y, SAFE_MARGIN, STAGE_H - SAFE_MARGIN - bounds.height);

    setGuideLines(snapped.guides);
    updateField(field.id, { x, y });
  };

  const nudgeSelected = (dx: number, dy: number) => {
    if (!selected) return;
    const bounds = fieldBounds(selected);
    const x = clamp(selected.x + dx, SAFE_MARGIN, STAGE_W - SAFE_MARGIN - bounds.width);
    const y = clamp(selected.y + dy, SAFE_MARGIN, STAGE_H - SAFE_MARGIN - bounds.height);
    updateField(selected.id, { x, y });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!selected) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!protectedIds.includes(selected.id)) removeField(selected.id);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeSelected(event.shiftKey ? -10 : -1, 0);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeSelected(event.shiftKey ? 10 : 1, 0);
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        nudgeSelected(0, event.shiftKey ? -10 : -1);
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        nudgeSelected(0, event.shiftKey ? 10 : 1);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelected();
      }
    };

    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (!item.type.startsWith('image/')) continue;
        const file = item.getAsFile();
        if (!file) continue;

        event.preventDefault();
        const reader = new FileReader();
        reader.onload = async () => {
          await addLogoFromSource(String(reader.result), `screenshot-${Date.now()}.png`);
          setPasteMessage('Screenshot als Logo eingefügt.');
          window.setTimeout(() => setPasteMessage(''), 2500);
        };
        reader.readAsDataURL(file);
        break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onPaste);
    };
  }, [selected, fields, protectedIds]);

  const exportAllCards = async () => {
    if (!canExport || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);

      const zip = new JSZip();
      const rootFolder = cleanOrderNumber;

      for (const card of cards) {
        const visibleFrontFields = card.frontFields.filter((field) => {
          if (field.type !== 'qr') return true;
          const isFrontQr = field.label.toLowerCase().includes('vorder') || field.id.includes('qr-front');
          return isFrontQr ? card.showFrontQr : true;
        });

        const visibleBackFields = card.backFields.filter((field) => {
          if (field.type !== 'qr') return true;
          const isBackQr = field.label.toLowerCase().includes('rück') || field.id.includes('back-qr');
          return isBackQr ? card.showBackQr : true;
        });

        const [preparedFront, preparedBack] = await Promise.all([
          prepareFieldsForExport(visibleFrontFields),
          prepareFieldsForExport(visibleBackFields),
        ]);

        const safeCardName = sanitizeOrderNumber(card.name) || 'metallkarte';

        const frontSvg = exportSideSvg(preparedFront, true, {
          orderNumber: cleanOrderNumber,
          side: 'front',
          cardName: card.name,
        });

        const backSvg = exportSideSvg(preparedBack, true, {
          orderNumber: cleanOrderNumber,
          side: 'back',
          cardName: card.name,
        });

        zip.file(`${rootFolder}/${safeCardName}/${safeCardName}-vorderseite.svg`, frontSvg);
        zip.file(`${rootFolder}/${safeCardName}/${safeCardName}-rueckseite.svg`, backSvg);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanOrderNumber}-alle-karten.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDisplaySrc = (field: Field) => (field.type === 'logo' ? field.src : '');

  const renderQrPreview = (field: QrField) => {
    const placeholderStroke = previewTextColor;
    const placeholderFill = 'rgba(255,255,255,0.04)';

    return (
      <svg width={field.size} height={field.size} viewBox={`0 0 ${field.size} ${field.size}`}>
        <rect
          x="1"
          y="1"
          width={field.size - 2}
          height={field.size - 2}
          rx="8"
          fill={placeholderFill}
          stroke={placeholderStroke}
          strokeWidth="2"
          strokeDasharray="8 6"
        />
        <rect x="10" y="10" width="18" height="18" fill={placeholderStroke} opacity="0.9" />
        <rect x={field.size - 28} y="10" width="18" height="18" fill={placeholderStroke} opacity="0.9" />
        <rect x="10" y={field.size - 28} width="18" height="18" fill={placeholderStroke} opacity="0.9" />
        <text
          x="50%"
          y="54%"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill={placeholderStroke}
          fontFamily="Arial, Helvetica, sans-serif"
        >
          QR
        </text>
        <text
          x="50%"
          y="66%"
          textAnchor="middle"
          fontSize="9"
          fill={placeholderStroke}
          fontFamily="Arial, Helvetica, sans-serif"
        >
          Platzhalter
        </text>
      </svg>
    );
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f3f4f6',
        padding: 24,
        fontFamily: 'Arial, sans-serif',
        color: '#111827',
      }}
    >
      <div
        style={{
          maxWidth: 1580,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '380px minmax(0, 1fr)',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <aside
          style={{
            background: '#fff',
            borderRadius: 20,
            padding: 18,
            boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
            display: 'grid',
            gap: 14,
            position: 'sticky',
            top: 20,
            maxHeight: 'calc(100vh - 40px)',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              background: '#111827',
              color: '#fff',
              borderRadius: 16,
              padding: 16,
              display: 'grid',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.8 }}>Karten-Designer</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>Metallkarten Editor Pro</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Kartennamen und Kartenfarbe direkt in der Kartenliste bearbeiten.
            </div>
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              padding: 12,
              background: '#f9fafb',
              fontSize: 14,
              fontWeight: 700,
              color: '#111827',
            }}
          >
            Einstellungen
          </div>

          <Panel title="Bestellung" subtitle="Pflichtangabe für die Zuordnung deiner Dateien">
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
              Alle Karten dieser Bestellung werden gemeinsam in einer ZIP-Datei exportiert.
            </div>
            <div>
              <label>Bestellnummer</label>
              <input
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Bestellnummer hier eingeben"
                style={inputStyle}
              />
            </div>
          </Panel>

          <Panel title="Karten" subtitle="Name und Kartenfarbe direkt in der Liste bearbeiten">
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addNewCard} style={{ ...buttonStyle, flex: 1 }}>
                Neue Karte
              </button>
              <button onClick={duplicateActiveCard} style={{ ...buttonStyle, flex: 1 }}>
                Duplizieren
              </button>
            </div>

            <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflow: 'auto' }}>
              {cards.map((card) => {
                const isActive = activeCardId === card.id;

                return (
                  <div
                    key={card.id}
                    onClick={() => {
                      setActiveCardId(card.id);
                      setSide('front');
                      setSelectedId(card.frontFields[0]?.id || '');
                      setGuideLines([]);
                    }}
                    style={{
                      border: isActive ? '1px solid #111827' : '1px solid #e5e7eb',
                      background: isActive ? '#eef2ff' : '#fafafa',
                      borderRadius: 12,
                      padding: 10,
                      display: 'grid',
                      gap: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 130px',
                        gap: 8,
                        alignItems: 'end',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div>
                        <label style={{ fontSize: 12, color: '#6b7280' }}>Kartenname</label>
                        <input
                          value={card.name}
                          onChange={(e) => updateCardById(card.id, { name: e.target.value })}
                          style={{
                            ...inputStyle,
                            marginTop: 6,
                            fontWeight: 700,
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 12, color: '#6b7280' }}>Kartenfarbe</label>
                        <select
                          value={card.cardFinish}
                          onChange={(e) =>
                            updateCardById(card.id, {
                              cardFinish: e.target.value as CardFinishKey,
                            })
                          }
                          style={inputStyle}
                        >
                          <option value="black">Schwarz</option>
                          <option value="silver">Silber</option>
                          <option value="gold">Gold</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {card.frontFields.length + card.backFields.length} Elemente
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Ansicht">
            <label style={toggleRowStyle}>
              <span>Sicherheitsbereich</span>
              <input
                type="checkbox"
                checked={showSafeArea}
                onChange={(e) => setShowSafeArea(e.target.checked)}
              />
            </label>
            <label style={toggleRowStyle}>
              <span>Raster anzeigen</span>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
            </label>
            <label style={toggleRowStyle}>
              <span>Am Raster ausrichten</span>
              <input
                type="checkbox"
                checked={snapToGrid}
                onChange={(e) => setSnapToGrid(e.target.checked)}
              />
            </label>
            <label style={toggleRowStyle}>
              <span>QR Vorderseite</span>
              <input
                type="checkbox"
                checked={activeCard.showFrontQr}
                onChange={(e) => updateActiveCard({ showFrontQr: e.target.checked })}
              />
            </label>
            <label style={toggleRowStyle}>
              <span>QR Rückseite</span>
              <input
                type="checkbox"
                checked={activeCard.showBackQr}
                onChange={(e) => updateActiveCard({ showBackQr: e.target.checked })}
              />
            </label>
          </Panel>

          <Panel title="Neue Elemente hinzufügen">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={addTextField} style={buttonStyle}>
                Textfeld
              </button>
              <button onClick={addMultilineField} style={buttonStyle}>
                Mehrzeilig
              </button>
              <button onClick={addQrField} style={buttonStyle}>
                QR-Platzhalter
              </button>
              <label style={{ ...buttonStyle, textAlign: 'center', cursor: 'pointer' }}>
                Logo / Bild
                <input
                  type="file"
                  accept="image/*,.svg"
                  style={{ display: 'none' }}
                  onChange={onLogoUpload}
                />
              </label>
            </div>
          </Panel>

          <Panel title="QR-Platzhalter" subtitle="Der finale QR-Code wird später eingesetzt">
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              Kunden geben keinen QR-Inhalt ein. In der Vorschau wird nur ein Platzhalter angezeigt,
              damit Position und Größe festgelegt werden können.
            </div>
          </Panel>

          <Panel title="Screenshot einfügen">
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              Logo fotografieren oder Screenshot erstellen, danach hier auf die Seite klicken und{' '}
              <strong>Strg + V</strong> drücken.
            </div>
            {pasteMessage ? <div style={{ fontSize: 13, color: '#047857' }}>{pasteMessage}</div> : null}
          </Panel>

          <Panel title="Elementliste">
            <div style={{ display: 'grid', gap: 8, maxHeight: 260, overflow: 'auto' }}>
              {visibleFields.map((field) => (
                <button
                  key={field.id}
                  onClick={() => setSelectedId(field.id)}
                  style={{
                    textAlign: 'left',
                    border: selectedId === field.id ? '1px solid #111827' : '1px solid #e5e7eb',
                    background: selectedId === field.id ? '#eef2ff' : '#fafafa',
                    borderRadius: 12,
                    padding: 10,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{field.label}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {field.type} · X {pxToMm(field.x).toFixed(1)} mm · Y {pxToMm(field.y).toFixed(1)} mm
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title={selected ? `Ausgewählt: ${selected.label}` : 'Kein Element ausgewählt'}>
            {selected ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label>X Position (mm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={pxToMm(selected.x).toFixed(1)}
                      onChange={(e) => updateField(selected.id, { x: mmToPx(Number(e.target.value)) })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label>Y Position (mm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={pxToMm(selected.y).toFixed(1)}
                      onChange={(e) => updateField(selected.id, { y: mmToPx(Number(e.target.value)) })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {(selected.type === 'text' || selected.type === 'multiline') && (
                  <>
                    <div>
                      <label>Text</label>
                      {selected.type === 'multiline' ? (
                        <textarea
                          value={selected.text}
                          onChange={(e) => updateField(selected.id, { text: e.target.value })}
                          rows={4}
                          style={inputStyle}
                        />
                      ) : (
                        <input
                          value={selected.text}
                          onChange={(e) => updateField(selected.id, { text: e.target.value })}
                          style={inputStyle}
                        />
                      )}
                    </div>

                    <div>
                      <label>Schriftart</label>
                      <select
                        value={selected.fontFamily}
                        onChange={(e) =>
                          updateField(selected.id, {
                            fontFamily: e.target.value as FontFamilyKey,
                          })
                        }
                        style={inputStyle}
                      >
                        {Object.entries(FONT_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label>Ausrichtung</label>
                      <select
                        value={selected.align}
                        onChange={(e) =>
                          updateField(selected.id, {
                            align: e.target.value as 'left' | 'center' | 'right',
                          })
                        }
                        style={inputStyle}
                      >
                        <option value="left">Links</option>
                        <option value="center">Zentriert</option>
                        <option value="right">Rechts</option>
                      </select>
                    </div>

                    <div>
                      <label>Schriftgröße: {selected.fontSize}px</label>
                      <input
                        type="range"
                        min={8}
                        max={36}
                        step={1}
                        value={selected.fontSize}
                        onChange={(e) =>
                          updateField(selected.id, { fontSize: Number(e.target.value) })
                        }
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label>Stärke: {selected.fontWeight}</label>
                      <input
                        type="range"
                        min={300}
                        max={800}
                        step={100}
                        value={selected.fontWeight}
                        onChange={(e) =>
                          updateField(selected.id, { fontWeight: Number(e.target.value) })
                        }
                        style={{ width: '100%' }}
                      />
                    </div>
                  </>
                )}

                {selected.type === 'qr' && (
                  <>
                    <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                      Dieses Element ist nur ein QR-Platzhalter. Der echte QR-Code wird später eingefügt.
                    </div>
                    <div>
                      <label>
                        Größe: {selected.size}px ({pxToMm(selected.size).toFixed(1)} mm)
                      </label>
                      <input
                        type="range"
                        min={48}
                        max={240}
                        step={2}
                        value={selected.size}
                        onChange={(e) => updateField(selected.id, { size: Number(e.target.value) })}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </>
                )}

                {selected.type === 'logo' && (
                  <>
                    <div>
                      <label>Datei</label>
                      <input
                        value={selected.filename}
                        readOnly
                        style={{ ...inputStyle, background: '#f9fafb' }}
                      />
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      Das Bild wird automatisch für den Laser optimiert.
                    </div>
                  </>
                )}

                {!protectedIds.includes(selected.id) ? (
                  <button
                    onClick={() => removeField(selected.id)}
                    style={{
                      ...buttonStyle,
                      background: '#dc2626',
                      color: '#fff',
                      borderColor: '#dc2626',
                    }}
                  >
                    Element löschen
                  </button>
                ) : null}
              </div>
            ) : (
              <div style={{ fontSize: 14, color: '#6b7280' }}>
                Klicke links in der Elementliste oder direkt in der Vorschau auf ein Element.
              </div>
            )}
          </Panel>

          <Panel title="Design exportieren" subtitle="Alle Karten werden zusammen als ZIP-Datei exportiert">
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              Beim Export wird für jede Karte ein eigener Unterordner mit Vorderseite und Rückseite
              erstellt.
            </div>
            <button
              onClick={exportAllCards}
              style={{
                ...buttonStyle,
                width: '100%',
                background: '#111827',
                color: '#fff',
                borderColor: '#111827',
                opacity: canExport && !isSubmitting ? 1 : 0.55,
              }}
              disabled={!canExport || isSubmitting}
            >
              {isSubmitting ? 'ZIP wird erstellt...' : `${cards.length} Karte(n) exportieren`}
            </button>
          </Panel>
        </aside>

        <main
          style={{
            background: '#fff',
            borderRadius: 20,
            padding: 20,
            boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
            display: 'grid',
            gap: 16,
          }}
        >
          <div
            style={{
              background: canExport ? '#f9fafb' : '#fef2f2',
              border: canExport ? '1px solid #e5e7eb' : '2px solid #ef4444',
              borderRadius: 16,
              padding: 16,
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Bestellnummer {canExport ? '' : 'fehlt'}</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(220px, 380px) 1fr',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <input
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Bestellnummer hier eingeben"
                style={{
                  ...inputStyle,
                  marginTop: 0,
                  border: canExport ? '1px solid #d1d5db' : '2px solid #ef4444',
                  background: canExport ? '#ffffff' : '#fff7f7',
                  fontWeight: 700,
                }}
              />
              <div style={{ fontSize: 13, color: canExport ? '#047857' : '#b91c1c' }}>
                {canExport
                  ? `ZIP-Datei: ${cleanOrderNumber}-alle-karten.zip`
                  : 'Bitte zuerst die Bestellnummer eingeben.'}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 24 }}>Live Vorschau</h2>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                {CARD_WIDTH} mm × {CARD_HEIGHT} mm · {side === 'front' ? 'Vorderseite' : 'Rückseite'} ·
                Vorschau · {activeCard.name}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={statStyle}>
                <strong>{cards.length}</strong>
                <span>Karten</span>
              </div>
              <div style={statStyle}>
                <strong>{visibleFields.length}</strong>
                <span>Elemente</span>
              </div>
              <div style={statStyle}>
                <strong>{SAFE_MARGIN_MM} mm</strong>
                <span>Sicherheitsrand</span>
              </div>
              <div style={statStyle}>
                <strong>{CARD_LABELS[activeCard.cardFinish]}</strong>
                <span>Karte</span>
              </div>
              <div style={statStyle}>
                <strong>{cleanOrderNumber || '—'}</strong>
                <span>Bestellnummer</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setSide('front');
                setSelectedId(activeCard.frontFields[0]?.id || '');
                setGuideLines([]);
              }}
              style={side === 'front' ? activeTabStyle : tabStyle}
            >
              Vorderseite bearbeiten
            </button>
            <button
              onClick={() => {
                setSide('back');
                setSelectedId(activeCard.backFields[0]?.id || '');
                setGuideLines([]);
              }}
              style={side === 'back' ? activeTabStyle : tabStyle}
            >
              Rückseite bearbeiten
            </button>
          </div>

          <div
            style={{
              overflow: 'auto',
              borderRadius: 18,
              border: '1px solid #e5e7eb',
              background: '#f3f4f6',
              padding: 24,
            }}
          >
            <div
              ref={stageRef}
              onMouseMove={onMouseMove}
              onMouseUp={clearInteractionState}
              onMouseLeave={clearInteractionState}
              style={{
                position: 'relative',
                width: STAGE_W,
                height: STAGE_H,
                border: `1px solid ${frameStyle.border}`,
                borderRadius: 18,
                userSelect: 'none',
                overflow: 'hidden',
                backgroundImage: showGrid
                  ? `linear-gradient(to right, ${frameStyle.gridLine} 1px, transparent 1px), linear-gradient(to bottom, ${frameStyle.gridLine} 1px, transparent 1px), url(${currentBackground})`
                  : `url(${currentBackground})`,
                backgroundSize: showGrid ? '20px 20px, 20px 20px, cover' : 'cover',
                backgroundPosition: showGrid ? '0 0, 0 0, center' : 'center',
                backgroundRepeat: 'repeat, repeat, no-repeat',
                filter: 'none',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
              }}
            >
              {showSafeArea ? (
                <div
                  style={{
                    pointerEvents: 'none',
                    position: 'absolute',
                    left: SAFE_MARGIN,
                    top: SAFE_MARGIN,
                    width: STAGE_W - SAFE_MARGIN * 2,
                    height: STAGE_H - SAFE_MARGIN * 2,
                    border: `1px dashed ${frameStyle.safeArea}`,
                  }}
                />
              ) : null}

              {guideLines.map((line, index) =>
                line.type === 'vertical' ? (
                  <div
                    key={`guide-v-${index}`}
                    style={{
                      pointerEvents: 'none',
                      position: 'absolute',
                      left: line.x,
                      top: 0,
                      width: 1,
                      height: STAGE_H,
                      background: '#22c55e',
                      boxShadow: '0 0 0 1px rgba(34,197,94,0.18)',
                      zIndex: 50,
                    }}
                  />
                ) : (
                  <div
                    key={`guide-h-${index}`}
                    style={{
                      pointerEvents: 'none',
                      position: 'absolute',
                      left: 0,
                      top: line.y,
                      width: STAGE_W,
                      height: 1,
                      background: '#22c55e',
                      boxShadow: '0 0 0 1px rgba(34,197,94,0.18)',
                      zIndex: 50,
                    }}
                  />
                ),
              )}

              {visibleFields.map((field) => {
                const isSelected = field.id === selectedId;
                const bounds = fieldBounds(field);

                if (field.type === 'text' || field.type === 'multiline') {
                  const lines = String(field.text || '').split('\n');
                  const fontFamily = FONT_OPTIONS[field.fontFamily] || FONT_OPTIONS[DEFAULT_FONT_FAMILY];

                  return (
                    <div
                      key={field.id}
                      onMouseDown={(e) => onMouseDown(e, field)}
                      onClick={() => setSelectedId(field.id)}
                      style={{
                        position: 'absolute',
                        cursor: 'move',
                        whiteSpace: 'pre',
                        outline: isSelected ? '2px solid #4f46e5' : 'none',
                        outlineOffset: 2,
                        left: field.x,
                        top: field.y,
                        fontSize: field.fontSize,
                        color: previewTextColor,
                        fontWeight: field.fontWeight,
                        lineHeight: 1.35,
                        textAlign: field.align,
                        minWidth: 20,
                        fontFamily,
                        textShadow: '0 1px 0 rgba(255,255,255,0.15), 0 -1px 1px rgba(0,0,0,0.45)',
                      }}
                    >
                      {lines.map((line, index) => (
                        <div key={index}>{line}</div>
                      ))}
                      {isSelected ? <SelectionBadge width={bounds.width} height={bounds.height} /> : null}
                    </div>
                  );
                }

                if (field.type === 'qr') {
                  return (
                    <div
                      key={field.id}
                      onMouseDown={(e) => onMouseDown(e, field)}
                      onClick={() => setSelectedId(field.id)}
                      style={{
                        position: 'absolute',
                        cursor: 'move',
                        background: 'transparent',
                        outline: isSelected ? '2px solid #4f46e5' : 'none',
                        outlineOffset: 2,
                        left: field.x,
                        top: field.y,
                        width: field.size,
                        height: field.size,
                        overflow: 'hidden',
                      }}
                    >
                      {renderQrPreview(field)}
                      {isSelected ? (
                        <>
                          <SelectionBadge width={field.size} height={field.size} />
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const pos = pointerPos(e as React.MouseEvent<HTMLDivElement>);
                              setResizing({
                                id: field.id,
                                startX: pos.x,
                                startY: pos.y,
                                startWidth: field.size,
                                startHeight: field.size,
                              });
                            }}
                            style={{
                              position: 'absolute',
                              right: -6,
                              bottom: -6,
                              width: 16,
                              height: 16,
                              borderRadius: 999,
                              background: '#4f46e5',
                              border: '2px solid white',
                              cursor: 'nwse-resize',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                            }}
                          />
                        </>
                      ) : null}
                    </div>
                  );
                }

                if (field.type === 'logo') {
                  return (
                    <div
                      key={field.id}
                      onMouseDown={(e) => onMouseDown(e, field)}
                      onClick={() => setSelectedId(field.id)}
                      style={{
                        position: 'absolute',
                        cursor: 'move',
                        overflow: 'hidden',
                        outline: isSelected ? '2px solid #4f46e5' : 'none',
                        outlineOffset: 2,
                        left: field.x,
                        top: field.y,
                        width: field.width,
                        height: field.height,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          WebkitMaskImage: `url(${getDisplaySrc(field)})`,
                          WebkitMaskRepeat: 'no-repeat',
                          WebkitMaskSize: 'contain',
                          WebkitMaskPosition: 'center',
                          maskImage: `url(${getDisplaySrc(field)})`,
                          maskRepeat: 'no-repeat',
                          maskSize: 'contain',
                          maskPosition: 'center',
                          backgroundColor: previewTextColor,
                        }}
                      />
                      {isSelected ? (
                        <>
                          <SelectionBadge width={field.width} height={field.height} />
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const pos = pointerPos(e as React.MouseEvent<HTMLDivElement>);
                              setResizing({
                                id: field.id,
                                startX: pos.x,
                                startY: pos.y,
                                startWidth: field.width,
                                startHeight: field.height,
                              });
                            }}
                            style={{
                              position: 'absolute',
                              right: -6,
                              bottom: -6,
                              width: 16,
                              height: 16,
                              borderRadius: 999,
                              background: '#4f46e5',
                              border: '2px solid white',
                              cursor: 'nwse-resize',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                            }}
                          />
                        </>
                      ) : null}
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
              fontSize: 13,
              color: '#6b7280',
            }}
          >
            <span>Vorschau aktiv. Die Karte nutzt dein echtes Hintergrundbild.</span>
            {isProcessingImage ? (
              <span style={{ color: '#2563eb', fontWeight: 700 }}>
                Bild wird für Laser optimiert...
              </span>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
  color: '#111827',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 6,
  padding: 10,
  borderRadius: 10,
  border: '1px solid #d1d5db',
  boxSizing: 'border-box',
  color: '#111827',
  background: '#ffffff',
};

const tabStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
  color: '#111827',
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  background: '#111827',
  color: '#fff',
  borderColor: '#111827',
};

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: '#111827',
  gap: 12,
};

const statStyle: React.CSSProperties = {
  background: '#fafafa',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 12,
  display: 'grid',
  gap: 4,
  color: '#111827',
  minWidth: 110,
};
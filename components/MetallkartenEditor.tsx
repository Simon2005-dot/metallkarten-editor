'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import JSZip from 'jszip';
import { SelectionBadge } from '@/components/designer/SelectionBadge';
import { Panel } from '@/components/designer/Panel';
import { nfcChipProduct } from '@/lib/designer/products/nfc-chip';

import type {
  FontFamilyKey,
  TextField,
  QrField,
  LogoField,
  Field,
  Side,
  CardFinishKey,
  OutputMode,
  DragState,
  ResizeState,
  GuideLine,
  PreparedQrField,
  PreparedField,
  CardDesign,
  VectorTraceResult,
  ContextMenuState,
  DesignerProduct,
} from '@/lib/designer/types';

import {
  DEFAULT_TEXT_COLOR,
  DEFAULT_FONT_FAMILY,
  SNAP_THRESHOLD,
  GRID_SIZE,
  NFC_ICON_SRC,
  FONT_OPTIONS,
  FONT_LABELS,
} from '@/lib/designer/constants';

import { metalCardProduct } from '@/lib/designer/products/metal-card';

import {
  buttonStyle,
  deleteIconButtonStyle,
  inputStyle,
  tabStyle,
  activeTabStyle,
  toggleRowStyle,
  statStyle,
} from '@/lib/designer/styles';

import {
  clamp,
  mmToPx,
  pxToMm,
  roundToGrid,
  sanitizeOrderNumber,
  normalizeQrValue,
  buildUniqueId,
  fieldBounds,
  getFieldDistances,
  duplicateField,
} from '@/lib/designer/helpers';

const ENABLE_CHIP = false;

const PRODUCTS: Record<'metal' | 'chip', DesignerProduct> = {
  metal: metalCardProduct,
  chip: nfcChipProduct,
};


function getLaserColor(cardFinish: CardFinishKey, side: Side) {
  if (cardFinish === 'silver') {
    return side === 'front' ? '#a86e53' : '#111111';
  }

  if (cardFinish === 'black') {
    return side === 'front' ? '#d1d5db' : '#c97a2b';
  }

  if (cardFinish === 'gold') {
    return side === 'front' ? '#6e6b55' : '#000000';
  }

  return '#111111';
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

function cloneFields(fields: Field[]): Field[] {
  return fields.map((field) => {
    if (field.type === 'logo') {
      const originalSrc = field.originalSrc || field.src;
      const isSvg = originalSrc.startsWith('data:image/svg+xml');

      return {
        ...field,
        id: buildUniqueId(field.id),
        src: originalSrc,
        originalSrc,
        exportSrc: isSvg ? originalSrc : field.exportSrc || originalSrc,
        vectorMarkup: isSvg ? field.vectorMarkup : undefined,
        vectorWidth: isSvg ? field.vectorWidth : undefined,
        vectorHeight: isSvg ? field.vectorHeight : undefined,
        removedBackground: isSvg ? true : false,
        laserMode: isSvg ? 'laser' : 'original',
        vectorStatus: isSvg
          ? field.vectorStatus || 'ready'
          : 'idle',
      };
    }

    return {
      ...field,
      id: buildUniqueId(field.id),
    };
  });
}

function createNewCardDesign(
  index = 1,
  productConfig: typeof metalCardProduct | typeof nfcChipProduct,
): CardDesign {
  return {
    id: buildUniqueId('card'),
    name: `Karte ${index}`,
    cardFinish: 'black',
    showFrontQr: false,
    showBackQr: true,
    frontFields: cloneFields(productConfig.frontDefaultFields),
    backFields: cloneFields(productConfig.backDefaultFields),
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

function qrSvgGroup(field: PreparedQrField, outputMode: OutputMode) {
  const qrMatrix =
    field.qrMatrix && field.qrMatrix.length > 0
      ? field.qrMatrix
      : fallbackQrMatrix(field.text || 'placeholder');

  const moduleSize = field.size / qrMatrix.length;
  const { offset, size } = getQrModuleRect(moduleSize);

  const fill = outputMode === 'uv' ? field.color || '#000000' : '#000000';
  const bg = outputMode === 'uv' ? field.backgroundColor || '#ffffff' : '#ffffff';

  let rects = `<rect x="${field.x}" y="${field.y}" width="${field.size}" height="${field.size}" fill="${bg}" rx="8" />`;

  qrMatrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      rects += `<rect x="${field.x + x * moduleSize + offset}" y="${field.y + y * moduleSize + offset}" width="${size}" height="${size}" fill="${fill}" shape-rendering="crispEdges" />`;
    });
  });

  return rects;
}

function logoToSvg(
  field: LogoField,
  outputMode: OutputMode,
  cardFinish?: CardFinishKey,
) {
  if (outputMode === 'uv') {
    const imageSrc = field.exportSrc || field.originalSrc || field.src;

    if (field.label === 'NFC Symbol') {
      const fill = field.color || '#000000';

      return `<svg
        x="${field.x}"
        y="${field.y}"
        width="${field.width}"
        height="${field.height}"
        viewBox="0 0 ${field.width} ${field.height}"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <mask id="mask-${escapeAttribute(field.id)}">
            <image
              x="0"
              y="0"
              width="${field.width}"
              height="${field.height}"
              preserveAspectRatio="xMidYMid meet"
              href="${escapeAttribute(imageSrc)}"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="${field.width}"
          height="${field.height}"
          fill="${escapeAttribute(fill)}"
          mask="url(#mask-${escapeAttribute(field.id)})"
        />
      </svg>`;
    }

    const shouldOutline = false;
    const outlineOffset = 0;

    if (!shouldOutline) {
      return `<image
        x="${field.x}"
        y="${field.y}"
        width="${field.width}"
        height="${field.height}"
        preserveAspectRatio="xMidYMid meet"
        href="${escapeAttribute(imageSrc)}"
      />`;
    }

    const maskId = `mask-${escapeAttribute(field.id)}`;

    return `<svg
      x="${field.x - outlineOffset}"
      y="${field.y - outlineOffset}"
      width="${field.width + outlineOffset * 2}"
      height="${field.height + outlineOffset * 2}"
      viewBox="0 0 ${field.width + outlineOffset * 2} ${field.height + outlineOffset * 2}"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <mask id="${maskId}">
          <image
            x="${outlineOffset}"
            y="${outlineOffset}"
            width="${field.width}"
            height="${field.height}"
            preserveAspectRatio="xMidYMid meet"
            href="${escapeAttribute(imageSrc)}"
          />
        </mask>
      </defs>

      <rect
        x="0"
        y="${outlineOffset}"
        width="${field.width}"
        height="${field.height}"
        fill="#ffffff"
        mask="url(#${maskId})"
      />
      <rect
        x="${outlineOffset * 2}"
        y="${outlineOffset}"
        width="${field.width}"
        height="${field.height}"
        fill="#ffffff"
        mask="url(#${maskId})"
      />
      <rect
        x="${outlineOffset}"
        y="0"
        width="${field.width}"
        height="${field.height}"
        fill="#ffffff"
        mask="url(#${maskId})"
      />
      <rect
        x="${outlineOffset}"
        y="${outlineOffset * 2}"
        width="${field.width}"
        height="${field.height}"
        fill="#ffffff"
        mask="url(#${maskId})"
      />

      <image
        x="${outlineOffset}"
        y="${outlineOffset}"
        width="${field.width}"
        height="${field.height}"
        preserveAspectRatio="xMidYMid meet"
        href="${escapeAttribute(imageSrc)}"
      />
    </svg>`;
  }

  if (!field.vectorMarkup || !field.vectorWidth || !field.vectorHeight) {
    throw new Error(`Logo "${field.label}" ist nicht vektorisiert und darf nicht als Bild exportiert werden.`);
  }

  const scaleX = field.width / field.vectorWidth;
  const scaleY = field.height / field.vectorHeight;

  return `<g transform="translate(${field.x} ${field.y}) scale(${scaleX} ${scaleY})" fill="#000000" color="#000000" stroke="none">
  ${field.vectorMarkup}
</g>`;
}

function ensureBlackText(fields: Field[], outputMode: OutputMode) {
  if (outputMode === 'uv') return fields;

  return fields.map((field) => {
    if (field.type === 'multiline') {
      return { ...field, color: DEFAULT_TEXT_COLOR };
    }

    if (field.type === 'qr') {
      return {
        ...field,
        color: '#000000',
        backgroundColor: '#ffffff',
      };
    }

    return field;
  });
}

async function prepareFieldsForExport(
  fields: Field[],
  outputMode: OutputMode,
): Promise<PreparedField[]> {
  return Promise.all(
    ensureBlackText(fields, outputMode).map(async (field) => {
      if (field.type === 'logo') {
        return field;
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
  meta: { orderNumber: string; side: Side; cardName: string; cardFinish: CardFinishKey },
  outputMode: OutputMode,
  dimensions: {
    cardWidth: number;
    cardHeight: number;
    stageW: number;
    stageH: number;
    safeMargin: number;
  },
) {
  const { cardWidth, cardHeight, stageW, stageH, safeMargin } = dimensions;

  const content = fields
    .map((field) => {
      if (field.type === 'multiline') return textToSvg(field);
      if (field.type === 'qr') return qrSvgGroup(field, outputMode);
      if (field.type === 'logo') return logoToSvg(field, outputMode, meta.cardFinish);
      return '';
    })
    .join('\n');

  const guide = includeGuide
    ? `
      <rect x="1" y="1" width="${stageW - 2}" height="${stageH - 2}" fill="none" stroke="#ff00aa" stroke-width="1" />
      <rect x="${safeMargin}" y="${safeMargin}" width="${stageW - safeMargin * 2}" height="${stageH - safeMargin * 2}" fill="none" stroke="#ff00aa" stroke-dasharray="6 4" stroke-width="1" />
      <line x1="${stageW / 2}" y1="0" x2="${stageW / 2}" y2="${stageH}" stroke="#00a3ff" stroke-dasharray="6 4" stroke-width="1" />
      <line x1="0" y1="${stageH / 2}" x2="${stageW}" y2="${stageH / 2}" stroke="#00a3ff" stroke-dasharray="6 4" stroke-width="1" />
    `
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${cardWidth}mm" height="${cardHeight}mm"
     viewBox="0 0 ${stageW} ${stageH}">
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

  if (field.type === 'multiline') {
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

  if (movingField.type === 'multiline') {
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
    if (movingField.type === 'multiline') {
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

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function upscaleImageSource(
  src: string,
  options?: {
    minWidth?: number;
    minHeight?: number;
    maxScale?: number;
  },
) {
  const img = await loadImageElement(src);

  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;

  const minWidth = options?.minWidth ?? 1600;
  const minHeight = options?.minHeight ?? 900;
  const maxScale = options?.maxScale ?? 4;

  const scaleX = minWidth / originalWidth;
  const scaleY = minHeight / originalHeight;
  const scale = Math.max(1, Math.min(maxScale, Math.max(scaleX, scaleY)));

  if (scale <= 1.01) {
    return {
      src,
      width: originalWidth,
      height: originalHeight,
      scaled: false,
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(originalWidth * scale);
  canvas.height = Math.round(originalHeight * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      src,
      width: originalWidth,
      height: originalHeight,
      scaled: false,
    };
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const upscaledSrc = canvas.toDataURL('image/png');

  return {
    src: upscaledSrc,
    width: canvas.width,
    height: canvas.height,
    scaled: true,
  };
}

function createBooleanMask(width: number, height: number, fill = false) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

function cloneMask(mask: boolean[][]) {
  return mask.map((row) => [...row]);
}

function isMaskPixelOn(mask: boolean[][], x: number, y: number) {
  if (y < 0 || y >= mask.length) return false;
  if (x < 0 || x >= mask[0].length) return false;
  return mask[y][x];
}

function removeIsolatedPixels(mask: boolean[][], minNeighbors = 2) {
  const h = mask.length;
  const w = mask[0]?.length || 0;
  const next = cloneMask(mask);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y][x]) continue;

      let neighbors = 0;
      for (let yy = -1; yy <= 1; yy++) {
        for (let xx = -1; xx <= 1; xx++) {
          if (xx === 0 && yy === 0) continue;
          if (isMaskPixelOn(mask, x + xx, y + yy)) neighbors++;
        }
      }

      if (neighbors < minNeighbors) next[y][x] = false;
    }
  }

  return next;
}

function dilateMask(mask: boolean[][], radius = 1) {
  const h = mask.length;
  const w = mask[0]?.length || 0;
  const next = createBooleanMask(w, h, false);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y][x]) continue;

      for (let yy = -radius; yy <= radius; yy++) {
        for (let xx = -radius; xx <= radius; xx++) {
          const nx = x + xx;
          const ny = y + yy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) {
            next[ny][nx] = true;
          }
        }
      }
    }
  }

  return next;
}

function erodeMask(mask: boolean[][], radius = 1) {
  const h = mask.length;
  const w = mask[0]?.length || 0;
  const next = createBooleanMask(w, h, false);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let keep = true;

      for (let yy = -radius; yy <= radius && keep; yy++) {
        for (let xx = -radius; xx <= radius; xx++) {
          const nx = x + xx;
          const ny = y + yy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || !mask[ny][nx]) {
            keep = false;
            break;
          }
        }
      }

      next[y][x] = keep;
    }
  }

  return next;
}

function closeMask(mask: boolean[][], radius = 1) {
  return erodeMask(dilateMask(mask, radius), radius);
}

function findMaskBounds(mask: boolean[][]) {
  const h = mask.length;
  const w = mask[0]?.length || 0;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y][x]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1, isEmpty: true };
  }

  return { minX, minY, maxX, maxY, isEmpty: false };
}

function cropMask(mask: boolean[][], padding = 2) {
  const bounds = findMaskBounds(mask);
  const h = mask.length;
  const w = mask[0]?.length || 0;

  if (bounds.isEmpty) {
    return {
      mask,
      offsetX: 0,
      offsetY: 0,
      width: w,
      height: h,
    };
  }

  const minX = Math.max(0, bounds.minX - padding);
  const minY = Math.max(0, bounds.minY - padding);
  const maxX = Math.min(w - 1, bounds.maxX + padding);
  const maxY = Math.min(h - 1, bounds.maxY + padding);

  const cropped: boolean[][] = [];
  for (let y = minY; y <= maxY; y++) {
    cropped.push(mask[y].slice(minX, maxX + 1));
  }

  return {
    mask: cropped,
    offsetX: minX,
    offsetY: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function boostContrast(imageData: ImageData, contrast = 40) {
  const data = imageData.data;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(Math.round(factor * (data[i] - 128) + 128), 0, 255);
    data[i + 1] = clamp(Math.round(factor * (data[i + 1] - 128) + 128), 0, 255);
    data[i + 2] = clamp(Math.round(factor * (data[i + 2] - 128) + 128), 0, 255);
  }

  return imageData;
}
function getPixelAt(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const i = (y * width + x) * 4;
  return {
    r: data[i],
    g: data[i + 1],
    b: data[i + 2],
    a: data[i + 3],
  };
}

function colorDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function averageBackgroundFromCorners(imageData: ImageData, sampleSize = 12) {
  const { width, height, data } = imageData;

  const points: Array<{ r: number; g: number; b: number }> = [];

  const cornerRects = [
    { startX: 0, endX: Math.min(sampleSize, width), startY: 0, endY: Math.min(sampleSize, height) },
    { startX: Math.max(0, width - sampleSize), endX: width, startY: 0, endY: Math.min(sampleSize, height) },
    { startX: 0, endX: Math.min(sampleSize, width), startY: Math.max(0, height - sampleSize), endY: height },
    { startX: Math.max(0, width - sampleSize), endX: width, startY: Math.max(0, height - sampleSize), endY: height },
  ];

  for (const rect of cornerRects) {
    for (let y = rect.startY; y < rect.endY; y++) {
      for (let x = rect.startX; x < rect.endX; x++) {
        const p = getPixelAt(data, width, x, y);
        if (p.a < 20) continue;
        points.push({ r: p.r, g: p.g, b: p.b });
      }
    }
  }

  if (points.length === 0) {
    return { r: 255, g: 255, b: 255 };
  }

  const sum = points.reduce(
    (acc, p) => {
      acc.r += p.r;
      acc.g += p.g;
      acc.b += p.b;
      return acc;
    },
    { r: 0, g: 0, b: 0 },
  );

  return {
    r: Math.round(sum.r / points.length),
    g: Math.round(sum.g / points.length),
    b: Math.round(sum.b / points.length),
  };
}


function maskFromImageData(
  imageData: ImageData,
  backgroundTolerance = 28,
  minAlpha = 20,
) {
  const { width, height, data } = imageData;
  const mask = createBooleanMask(width, height, false);

  const backgroundColor = averageBackgroundFromCorners(imageData, 16);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < minAlpha) {
        mask[y][x] = false;
        continue;
      }

      const distance = colorDistance(
        { r, g, b },
        backgroundColor,
      );

      // Alles behalten, was sich sichtbar vom Hintergrund unterscheidet
      mask[y][x] = distance > backgroundTolerance;
    }
  }

  const cleaned = removeIsolatedPixels(mask, 2);
  const closed = closeMask(cleaned, 1);
  return removeIsolatedPixels(closed, 2);
}


type Edge = {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
};
function applyMaskToImageData(imageData: ImageData, mask: boolean[][]) {
  const { width, height, data } = imageData;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      if (!mask[y][x]) {
        data[i + 3] = 0;
      }
    }
  }

  return imageData;
}

function buildEdgesFromMask(mask: boolean[][]) {
  const h = mask.length;
  const w = mask[0]?.length || 0;
  const edges: Edge[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y][x]) continue;

      if (!isMaskPixelOn(mask, x, y - 1)) {
        edges.push({ sx: x, sy: y, ex: x + 1, ey: y });
      }
      if (!isMaskPixelOn(mask, x + 1, y)) {
        edges.push({ sx: x + 1, sy: y, ex: x + 1, ey: y + 1 });
      }
      if (!isMaskPixelOn(mask, x, y + 1)) {
        edges.push({ sx: x + 1, sy: y + 1, ex: x, ey: y + 1 });
      }
      if (!isMaskPixelOn(mask, x - 1, y)) {
        edges.push({ sx: x, sy: y + 1, ex: x, ey: y });
      }
    }
  }

  return edges;
}

function pointKey(x: number, y: number) {
  return `${x},${y}`;
}

function signedArea(points: Array<{ x: number; y: number }>) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function simplifyCollinear(points: Array<{ x: number; y: number }>) {
  if (points.length <= 3) return points;

  const result: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    const isCollinear = dx1 * dy2 === dy1 * dx2;
    const sameDirection =
      Math.sign(dx1) === Math.sign(dx2) || dx1 === 0 || dx2 === 0
        ? Math.sign(dy1) === Math.sign(dy2) || dy1 === 0 || dy2 === 0
        : false;

    if (isCollinear && sameDirection) continue;
    result.push(curr);
  }

  return result.length >= 3 ? result : points;
}

function edgesToLoops(edges: Edge[]) {
  const byStart = new Map<string, Edge[]>();

  for (const edge of edges) {
    const key = pointKey(edge.sx, edge.sy);
    const list = byStart.get(key) || [];
    list.push(edge);
    byStart.set(key, list);
  }

  const used = new Set<string>();
  const loops: Array<Array<{ x: number; y: number }>> = [];

  function edgeId(edge: Edge) {
    return `${edge.sx},${edge.sy}->${edge.ex},${edge.ey}`;
  }

  for (const edge of edges) {
    const startId = edgeId(edge);
    if (used.has(startId)) continue;

    const loop: Array<{ x: number; y: number }> = [];
    let current = edge;

    while (current) {
      const id = edgeId(current);
      if (used.has(id)) break;
      used.add(id);

      loop.push({ x: current.sx, y: current.sy });

      const nextKey = pointKey(current.ex, current.ey);
      const candidates = byStart.get(nextKey) || [];
      const nextEdge = candidates.find((candidate) => !used.has(edgeId(candidate)));

      if (!nextEdge) {
        loop.push({ x: current.ex, y: current.ey });
        break;
      }

      current = nextEdge;

      if (
        loop.length > 2 &&
        current.sx === loop[0].x &&
        current.sy === loop[0].y &&
        current.ex === loop[1]?.x &&
        current.ey === loop[1]?.y
      ) {
        break;
      }
    }

    const simplified = simplifyCollinear(loop);
    if (simplified.length >= 3) loops.push(simplified);
  }

  return loops;
}

function loopsToPath(loops: Array<Array<{ x: number; y: number }>>) {
  return loops
    .filter((loop) => Math.abs(signedArea(loop)) >= 1)
    .map((loop) => {
      const first = loop[0];
      const rest = loop.slice(1);
      return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')} Z`;
    })
    .join(' ');
}

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}


async function parseSvgDataUrl(dataUrl: string): Promise<{
  vectorMarkup: string;
  vectorWidth: number;
  vectorHeight: number;
}> {
  let svgText = '';

  if (dataUrl.startsWith('data:image/svg+xml')) {
    const [, payload = ''] = dataUrl.split(',', 2);
    const isBase64 = dataUrl.includes(';base64');

    svgText = isBase64 ? atob(payload) : decodeURIComponent(payload);
  } else {
    throw new Error('Ungültige SVG-Datenquelle.');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.documentElement;

  if (!svg || svg.tagName.toLowerCase() !== 'svg') {
    throw new Error('SVG konnte nicht gelesen werden.');
  }

  const viewBox = svg.getAttribute('viewBox');
  let vectorWidth = 100;
  let vectorHeight = 100;

  if (viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);

    if (parts.length === 4) {
      vectorWidth = parts[2] || vectorWidth;
      vectorHeight = parts[3] || vectorHeight;
    }
  } else {
    const widthAttr = svg.getAttribute('width') || '';
    const heightAttr = svg.getAttribute('height') || '';

    const parsedWidth = Number(widthAttr.replace(/[^\d.]/g, ''));
    const parsedHeight = Number(heightAttr.replace(/[^\d.]/g, ''));

    if (Number.isFinite(parsedWidth) && parsedWidth > 0) vectorWidth = parsedWidth;
    if (Number.isFinite(parsedHeight) && parsedHeight > 0) vectorHeight = parsedHeight;
  }

  return {
    vectorMarkup: svg.innerHTML,
    vectorWidth,
    vectorHeight,
  };
}


async function traceImageToVectorAsset(
  src: string,
  options?: {
  backgroundTolerance?: number;
  minAlpha?: number;
  upscaleMinWidth?: number;
  upscaleMinHeight?: number;
  upscaleMaxScale?: number;
  contrast?: number;
},
): Promise<VectorTraceResult> {
  const upscaled = await upscaleImageSource(src, {
    minWidth: options?.upscaleMinWidth ?? 1600,
    minHeight: options?.upscaleMinHeight ?? 900,
    maxScale: options?.upscaleMaxScale ?? 4,
  });

  const img = await loadImageElement(upscaled.src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas-Kontext konnte nicht erstellt werden.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const boosted = boostContrast(imageData, options?.contrast ?? 40);

  const mask = maskFromImageData(
  boosted,
  options?.backgroundTolerance ?? 28,
  options?.minAlpha ?? 20,
);

const transparentImageData = new ImageData(
  new Uint8ClampedArray(boosted.data),
  boosted.width,
  boosted.height,
);

applyMaskToImageData(transparentImageData, mask);

const previewCanvas = document.createElement('canvas');
previewCanvas.width = transparentImageData.width;
previewCanvas.height = transparentImageData.height;

const previewCtx = previewCanvas.getContext('2d');
if (!previewCtx) {
  throw new Error('Preview-Canvas konnte nicht erstellt werden.');
}

previewCtx.putImageData(transparentImageData, 0, 0);
const transparentPreviewSrc = previewCanvas.toDataURL('image/png');

  const cropped = cropMask(mask, 2);
  const edges = buildEdgesFromMask(cropped.mask);
  const loops = edgesToLoops(edges);
  const path = loopsToPath(loops);

  if (!path) {
    throw new Error('Bild konnte nicht sinnvoll vektorisiert werden.');
  }

  const vectorWidth = Math.max(1, cropped.width);
  const vectorHeight = Math.max(1, cropped.height);
 const vectorMarkup = `<path d="${path}" fill="currentColor" fill-rule="evenodd" />`;

  const previewSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vectorWidth} ${vectorHeight}">
  ${vectorMarkup}
</svg>`;

  return {
  previewSrc: transparentPreviewSrc,
  vectorMarkup,
  vectorWidth,
  vectorHeight,
};
}

function createNfcField(
  productConfig: typeof metalCardProduct | typeof nfcChipProduct,
): LogoField {
  const stageW = Math.round(productConfig.widthMm * productConfig.pxPerMm);
  const stageH = Math.round(productConfig.heightMm * productConfig.pxPerMm);

  return {
    id: buildUniqueId('nfc'),
    type: 'logo',
    label: 'NFC Symbol',
    src: NFC_ICON_SRC,
    originalSrc: NFC_ICON_SRC,
    exportSrc: NFC_ICON_SRC,
    x: stageW - 120,
    y: stageH - 80,
    width: 60,
    height: 56,
    filename: 'nfc-tap-here.png',
    removedBackground: false,
    threshold: 235,
    laserThreshold: 165,
    laserMode: 'original',
    vectorStatus: 'idle',
    color: '#000000',
  };
}

function getChipSafeAreaRect(stageW: number, stageH: number) {
  const top = 22;
  const bottom = stageH - 22;
  const left = 48;

  const radius = (bottom - top) / 2 ;
  const arcCenterX = stageW - 70;
  const arcCenterY = stageH / 2;
  const rightJoinX = arcCenterX - radius;

  return {
    top,
    bottom,
    left,
    radius,
    arcCenterX,
    arcCenterY,
    rightJoinX,
  };
}

function clampRectToMetalSafeArea(
  x: number,
  y: number,
  width: number,
  height: number,
  stageW: number,
  stageH: number,
  safeMargin: number,
) {
  return {
    x: clamp(x, safeMargin, stageW - safeMargin - width),
    y: clamp(y, safeMargin, stageH - safeMargin - height),
  };
}

function clampRectToChipSafeArea(
  x: number,
  y: number,
  width: number,
  height: number,
  stageW: number,
  stageH: number,
) {
  const area = getChipSafeAreaRect(stageW, stageH);

  let nextX = x;
  let nextY = y;

  // Oben / unten begrenzen
  nextY = clamp(nextY, area.top, area.bottom - height);

  // Links begrenzen
  nextX = Math.max(nextX, area.left);

  // Ganz rechte absolute Grenze des Halbkreises
  const absoluteMaxRight = area.arcCenterX + area.radius;

  // Rechte Kante des Elements
  let rightEdge = nextX + width;

  // Wenn Feld vollständig im rechteckigen Teil liegt: fertig
  if (rightEdge <= area.rightJoinX) {
    return { x: nextX, y: nextY };
  }

  // Für den runden Bereich:
  // Prüfe obere und untere rechte Ecke des Felds
  const rightSideYs = [nextY, nextY + height];

  let maxAllowedRight = absoluteMaxRight;

  for (const pointY of rightSideYs) {
    const dy = pointY - area.arcCenterY;
    const insideY = area.radius * area.radius - dy * dy;

    // Diese Y-Lage liegt außerhalb des Halbkreises -> Feld muss links in den rechteckigen Teil
    if (insideY < 0) {
      maxAllowedRight = Math.min(maxAllowedRight, area.rightJoinX);
      continue;
    }

    const allowedRightAtThisY = area.arcCenterX + Math.sqrt(insideY);
    maxAllowedRight = Math.min(maxAllowedRight, allowedRightAtThisY);
  }

  // Rechte Kante begrenzen
  rightEdge = Math.min(rightEdge, maxAllowedRight);

  nextX = rightEdge - width;

  // Linke Grenze nachziehen
  nextX = Math.max(nextX, area.left);

  return {
    x: nextX,
    y: nextY,
  };
}

function clampFieldToProductSafeArea(
  productKey: 'metal' | 'chip',
  x: number,
  y: number,
  width: number,
  height: number,
  stageW: number,
  stageH: number,
  safeMargin: number,
) {
  if (productKey === 'chip') {
    return clampRectToChipSafeArea(x, y, width, height, stageW, stageH);
  }

  return clampRectToMetalSafeArea(x, y, width, height, stageW, stageH, safeMargin);
}

export default function MetallkartenEditor() {
  const [productKey, setProductKey] = useState<'metal' | 'chip'>('metal');
  const product = PRODUCTS[productKey];

  const CARD_WIDTH = product.widthMm;
  const CARD_HEIGHT = product.heightMm;
  const PX_PER_MM = product.pxPerMm;
  const STAGE_W = Math.round(CARD_WIDTH * PX_PER_MM);
  const STAGE_H = Math.round(CARD_HEIGHT * PX_PER_MM);
  const SAFE_MARGIN = product.safeMarginMm * PX_PER_MM;

  const initialCard = useMemo(() => createNewCardDesign(1, product), [product]);
  const [cards, setCards] = useState<CardDesign[]>([initialCard]);
  const [activeCardId, setActiveCardId] = useState<string>(initialCard.id);
  const [side, setSide] = useState<Side>('front');
  const [selectedId, setSelectedId] = useState<string>('');
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [outputMode, setOutputMode] = useState<OutputMode>('laser');
  const [measuredFieldBounds, setMeasuredFieldBounds] = useState<
    Record<string, { width: number; height: number }>
  >({});

  useEffect(() => {
  const newCard = createNewCardDesign(1, product);
  setCards([newCard]);
  setActiveCardId(newCard.id);
  setSelectedId('');
  setSide('front');
  setGuideLines([]);
  setEditingTextId(null);
  setContextMenu(null);
}, [product]);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
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
  const contextField = contextMenu ? fields.find((f) => f.id === contextMenu.fieldId) || null : null;
  const selectedMeasuredBounds = selected ? measuredFieldBounds[selected.id] : undefined;
const selectedDistances = selected
  ? getFieldDistances(selected, STAGE_W, STAGE_H, PX_PER_MM, selectedMeasuredBounds)
  : null;

  const cleanOrderNumber = sanitizeOrderNumber(orderNumber);
const canExport = cleanOrderNumber.length >= 4;
const previewTextColor = getLaserColor(activeCard.cardFinish, side);
const shouldShowUvLogoOutline = false;
const uvOutlinePx = Math.max(1, Math.round(PX_PER_MM * 0.35));
const currentBackground = product.backgrounds[activeCard.cardFinish];
const currentPreview = product.preview[activeCard.cardFinish];
const frameStyle = product.frameStyles[activeCard.cardFinish];
const shapePath = product.clipPathSvg?.(STAGE_W, STAGE_H) ?? '';
const clipId = `product-clip-${productKey}`;
const holePx = product.hole
  ? {
      x: mmToPx(product.hole.x, PX_PER_MM),
      y: mmToPx(product.hole.y, PX_PER_MM),
      radius: mmToPx(product.hole.radius, PX_PER_MM),
    }
  : null;

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

  const updateLogoFieldAcrossCards = (
    cardId: string,
    sideToUpdate: Side,
    fieldId: string,
    updater: (field: LogoField) => LogoField,
  ) => {
    setCards((current) =>
      current.map((card) => {
        if (card.id !== cardId) return card;

        const updateList = (list: Field[]) =>
          list.map((field) => {
            if (field.id !== fieldId || field.type !== 'logo') return field;
            return updater(field);
          });

        return {
          ...card,
          frontFields: sideToUpdate === 'front' ? updateList(card.frontFields) : card.frontFields,
          backFields: sideToUpdate === 'back' ? updateList(card.backFields) : card.backFields,
        };
      }),
    );
  };

  const vectorizeExistingLogo = async (
    cardId: string,
    sideToUpdate: Side,
    field: LogoField,
  ) => {
    try {
      updateLogoFieldAcrossCards(cardId, sideToUpdate, field.id, (currentField) => ({
        ...currentField,
        vectorStatus: 'processing',
      }));

      const traced = await traceImageToVectorAsset(field.originalSrc || field.src, {
  backgroundTolerance: 28,
  minAlpha: 20,
  upscaleMinWidth: 1600,
  upscaleMinHeight: 900,
  upscaleMaxScale: 4,
  contrast: 40,
});

      updateLogoFieldAcrossCards(cardId, sideToUpdate, field.id, (currentField) => ({
        ...currentField,
        src: traced.previewSrc,
        originalSrc: currentField.originalSrc || currentField.src,
        exportSrc: traced.previewSrc,
        removedBackground: true,
        laserMode: 'laser',
        vectorMarkup: traced.vectorMarkup,
        vectorWidth: traced.vectorWidth,
        vectorHeight: traced.vectorHeight,
        vectorStatus: 'ready',
      }));
    } catch (error) {
      console.error(error);

      updateLogoFieldAcrossCards(cardId, sideToUpdate, field.id, (currentField) => ({
        ...currentField,
        vectorStatus: 'error',
      }));
    }
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
useEffect(() => {
  const nextBounds: Record<string, { width: number; height: number }> = {};

  visibleFields.forEach((field) => {
    const el = fieldRefs.current[field.id];
    if (!el) return;

    nextBounds[field.id] = {
      width: el.offsetWidth,
      height: el.offsetHeight,
    };
  });

  setMeasuredFieldBounds(nextBounds);
}, [visibleFields, selectedId, editingTextId, side, activeCardId, previewTextColor]);
  useEffect(() => {
    if (outputMode !== 'laser') return;

    const logosToProcess: Array<{
      cardId: string;
      side: Side;
      field: LogoField;
    }> = [];

    for (const card of cards) {
      for (const field of card.frontFields) {
        if (
  field.type === 'logo' &&
  !field.vectorMarkup &&
  field.vectorStatus !== 'processing' &&
  !(field.originalSrc || field.src).startsWith('data:image/svg+xml')
) {
          logosToProcess.push({
            cardId: card.id,
            side: 'front',
            field,
          });
        }
      }

      for (const field of card.backFields) {
        if (
  field.type === 'logo' &&
  !field.vectorMarkup &&
  field.vectorStatus !== 'processing' &&
  !(field.originalSrc || field.src).startsWith('data:image/svg+xml')
) {
          logosToProcess.push({
            cardId: card.id,
            side: 'back',
            field,
          });
        }
      }
    }

    if (logosToProcess.length === 0) return;

    for (const item of logosToProcess) {
      void vectorizeExistingLogo(item.cardId, item.side, item.field);
    }
  },  [cards, outputMode]);

  const updateField = (id: string, patch: Partial<Field>) => {
  setFields((current) =>
    current.map((f) => {
      if (f.id !== id) return f;
      return { ...f, ...patch } as Field;
    }),
  );
};

  const addMultilineField = () => {
    const id = buildUniqueId('multi');
    const newField: TextField = {
      id,
      type: 'multiline',
      label: 'Textfeld',
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
    setContextMenu(null);
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
    color: '#000000',
    backgroundColor: '#ffffff',
  };
    setFields((current) => [...current, newField]);
    setSelectedId(id);
    setContextMenu(null);
  };

  const addNfcField = () => {
    const field = createNfcField(product);
    setFields((current) => [...current, field]);
    setSelectedId(field.id);
    setContextMenu(null);
  };

  const addNewCard = () => {
    const newCard = createNewCardDesign(cards.length + 1, product);
    setCards((current) => [...current, newCard]);
    setActiveCardId(newCard.id);
    setSelectedId('');
    setSide('front');
    setGuideLines([]);
    setEditingTextId(null);
    setContextMenu(null);
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
    setSelectedId('');
    setSide('front');
    setGuideLines([]);
    setEditingTextId(null);
    setContextMenu(null);
  };

  const deleteCard = (cardId: string) => {
    if (cards.length <= 1) {
      alert('Mindestens eine Karte muss vorhanden sein.');
      return;
    }

    setCards((current) => {
      const remaining = current.filter((card) => card.id !== cardId);
      const nextActive = remaining.find((card) => card.id === activeCardId) || remaining[0];

      if (activeCardId === cardId && nextActive) {
        setActiveCardId(nextActive.id);
        setSide('front');
        setSelectedId('');
        setGuideLines([]);
        setEditingTextId(null);
        setContextMenu(null);
      }

      return remaining;
    });
  };

  const addLogoFromSource = async (src: string, filename: string) => {
    const id = buildUniqueId('logo');
    const currentActiveCardId = activeCardId;
    const currentSide = side;

    const baseLogo: LogoField = {
      id,
      type: 'logo',
      label: filename.toLowerCase().includes('screenshot') ? 'Screenshot Logo' : 'Logo',
      src,
      originalSrc: src,
      exportSrc: src,
      x: STAGE_W - 180,
      y: 24,
      width: 140,
      height: 80,
      filename,
      removedBackground: false,
      threshold: 235,
      laserThreshold: 165,
      laserMode: 'original',
      vectorStatus: 'processing',
    };

    setFields((current) => [...current, baseLogo]);
    setSelectedId(id);
    setEditingTextId(null);
    setContextMenu(null);

    setTimeout(async () => {
      try {
        setIsProcessingImage(true);

        const traced = await traceImageToVectorAsset(src, {
  backgroundTolerance: 28,
  minAlpha: 20,
  upscaleMinWidth: 1600,
  upscaleMinHeight: 900,
  upscaleMaxScale: 4,
  contrast: 40,
});

        setCards((current) =>
          current.map((card) => {
            if (card.id !== currentActiveCardId) return card;

            const update = (list: Field[]) =>
              list.map((field) =>
                field.id === id
                  ? ({
                      ...field,
                      src: traced.previewSrc,
                      originalSrc: src,
                      exportSrc: traced.previewSrc,
                      removedBackground: true,
                      laserMode: 'laser',
                      vectorMarkup: traced.vectorMarkup,
                      vectorWidth: traced.vectorWidth,
                      vectorHeight: traced.vectorHeight,
                      vectorStatus: 'ready',
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
      } catch (error) {
        console.error(error);
        setPasteMessage('Bild konnte nicht sauber vektorisiert werden.');
        window.setTimeout(() => setPasteMessage(''), 3000);

        setCards((current) =>
          current.map((card) => {
            if (card.id !== currentActiveCardId) return card;

            const remove = (list: Field[]) => list.filter((field) => field.id !== id);

            return {
              ...card,
              frontFields: currentSide === 'front' ? remove(card.frontFields) : card.frontFields,
              backFields: currentSide === 'back' ? remove(card.backFields) : card.backFields,
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
    setEditingTextId(null);
    setContextMenu(null);
  };

  const removeField = (id: string) => {
    setFields((current) => current.filter((f) => f.id !== id));
    setSelectedId((current) => (current === id ? '' : current));
    setEditingTextId((current) => (current === id ? null : current));
    setContextMenu(null);
  };

  const onLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const isSvg =
    file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

  const reader = new FileReader();

  reader.onload = async () => {
    const src = String(reader.result);

    if (isSvg) {
      try {
        const parsed = await parseSvgDataUrl(src);

        const id = buildUniqueId('logo');

        const svgLogo: LogoField = {
          id,
          type: 'logo',
          label: file.name.toLowerCase().includes('screenshot')
            ? 'Screenshot Logo'
            : 'Logo',
          src,
          originalSrc: src,
          exportSrc: src,
          x: STAGE_W - 180,
          y: 24,
          width: 140,
          height: 80,
          filename: file.name,
          removedBackground: true,
          threshold: 235,
          laserThreshold: 165,
          laserMode: 'laser',
          vectorStatus: 'ready',
          vectorMarkup: parsed.vectorMarkup,
          vectorWidth: parsed.vectorWidth,
          vectorHeight: parsed.vectorHeight,
        };

        setFields((current) => [...current, svgLogo]);
        setSelectedId(id);
        setEditingTextId(null);
        setContextMenu(null);
      } catch (error) {
        console.error(error);
        setPasteMessage('SVG konnte nicht gelesen werden.');
        window.setTimeout(() => setPasteMessage(''), 3000);
      } finally {
        event.target.value = '';
      }

      return;
    }

    await addLogoFromSource(src, file.name);
    event.target.value = '';
  };

  reader.readAsDataURL(file);
};

  const pointerPos = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>, field: Field) => {
    const pos = pointerPos(event);
    setSelectedId(field.id);
    setEditingTextId(null);
    setContextMenu(null);
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
          nextWidth = roundToGrid(nextWidth, GRID_SIZE);
          nextHeight = roundToGrid(nextHeight, GRID_SIZE);
        }

       nextWidth = Math.max(24, nextWidth);
nextHeight = Math.max(24, nextHeight);

const clampedPos = clampFieldToProductSafeArea(
  productKey,
  field.x,
  field.y,
  nextWidth,
  nextHeight,
  STAGE_W,
  STAGE_H,
  SAFE_MARGIN,
);

nextWidth = Math.min(nextWidth, STAGE_W - clampedPos.x);
nextHeight = Math.min(nextHeight, STAGE_H - clampedPos.y);

if (productKey === 'chip') {
  const chipAdjusted = clampFieldToProductSafeArea(
    productKey,
    field.x,
    field.y,
    nextWidth,
    nextHeight,
    STAGE_W,
    STAGE_H,
    SAFE_MARGIN,
  );
  nextWidth = Math.max(24, nextWidth - Math.max(0, field.x - chipAdjusted.x));
  nextHeight = Math.max(24, nextHeight);
}
        setGuideLines([]);
        updateField(field.id, { width: nextWidth, height: nextHeight });
        return;
      }

      if (field.type === 'qr') {
        let nextSize = Math.max(
          resizing.startWidth + (pos.x - resizing.startX),
          resizing.startHeight + (pos.y - resizing.startY),
        );

        if (snapToGrid) nextSize = roundToGrid(nextSize, GRID_SIZE);

        nextSize = Math.max(48, nextSize);

let test = clampFieldToProductSafeArea(
  productKey,
  field.x,
  field.y,
  nextSize,
  nextSize,
  STAGE_W,
  STAGE_H,
  SAFE_MARGIN,
);

while (
  (test.x !== field.x || test.y !== field.y) &&
  nextSize > 48
) {
  nextSize -= 2;
  test = clampFieldToProductSafeArea(
    productKey,
    field.x,
    field.y,
    nextSize,
    nextSize,
    STAGE_W,
    STAGE_H,
    SAFE_MARGIN,
  );
}
        setGuideLines([]);
        updateField(field.id, { size: nextSize });
      }
      return;
    }

    if (!dragging) return;
    const field = fields.find((f) => f.id === dragging.id);
    if (!field) return;
    if (editingTextId === field.id) return;

    const pos = pointerPos(event);
    const bounds = measuredFieldBounds[field.id] ?? fieldBounds(field);

    let x = pos.x - dragging.offsetX;
    let y = pos.y - dragging.offsetY;

    if (snapToGrid) {
      x = roundToGrid(x, GRID_SIZE);
      y = roundToGrid(y, GRID_SIZE);
    }

    const otherFields = visibleFields.filter((f) => f.id !== field.id);
    const snapped = snapPositionToOtherFields(field, x, y, otherFields, SNAP_THRESHOLD);

    x = snapped.x;
    y = snapped.y;

    const clampedPos = clampFieldToProductSafeArea(
  productKey,
  x,
  y,
  bounds.width,
  bounds.height,
  STAGE_W,
  STAGE_H,
  SAFE_MARGIN,
);

x = clampedPos.x;
y = clampedPos.y;

    setGuideLines(snapped.guides);
    updateField(field.id, { x, y });
  };

  const nudgeSelected = (dx: number, dy: number) => {
    if (!selected) return;
    const bounds = measuredFieldBounds[selected.id] ?? fieldBounds(selected);
    const clampedPos = clampFieldToProductSafeArea(
  productKey,
  selected.x + dx,
  selected.y + dy,
  bounds.width,
  bounds.height,
  STAGE_W,
  STAGE_H,
  SAFE_MARGIN,
);

updateField(selected.id, {
  x: clampedPos.x,
  y: clampedPos.y,
});
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!selected) return;

      if (event.key === 'Escape') {
        setEditingTextId(null);
        setContextMenu(null);
        setSelectedId('');
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeField(selected.id);
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
          setPasteMessage('Screenshot wurde eingefügt, hochskaliert und direkt vektorisiert.');
          window.setTimeout(() => setPasteMessage(''), 3000);
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
  }, [selected, fields]);

  const exportAllCards = async () => {
    if (!canExport || isSubmitting) return;

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
  prepareFieldsForExport(visibleFrontFields, outputMode),
  prepareFieldsForExport(visibleBackFields, outputMode),
]);

        const safeCardName = sanitizeOrderNumber(card.name) || 'metallkarte';

const frontSvg = exportSideSvg(
  preparedFront,
  true,
  {
  orderNumber: cleanOrderNumber,
  side: 'front',
  cardName: card.name,
  cardFinish: card.cardFinish,
},
  outputMode,
  {
    cardWidth: CARD_WIDTH,
    cardHeight: CARD_HEIGHT,
    stageW: STAGE_W,
    stageH: STAGE_H,
    safeMargin: SAFE_MARGIN,
  },
);

const backSvg = exportSideSvg(
  preparedBack,
  true,
  {
  orderNumber: cleanOrderNumber,
  side: 'back',
  cardName: card.name,
  cardFinish: card.cardFinish,
},
  outputMode,
  {
    cardWidth: CARD_WIDTH,
    cardHeight: CARD_HEIGHT,
    stageW: STAGE_W,
    stageH: STAGE_H,
    safeMargin: SAFE_MARGIN,
  },
);
        if (
  outputMode === 'laser' &&
  (frontSvg.includes('<image') || backSvg.includes('<image'))
) {
  throw new Error(
    'Export enthält noch Rasterbilder (<image>). Bitte alle Logos/Screenshots vollständig vektorisieren.',
  );
}

       zip.file(`${rootFolder}/${safeCardName}/${safeCardName}-vorderseite-${outputMode}.svg`, frontSvg);
zip.file(`${rootFolder}/${safeCardName}/${safeCardName}-rueckseite-${outputMode}.svg`, backSvg);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanOrderNumber}-alle-karten-${outputMode}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : 'Beim Export ist ein Fehler aufgetreten.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDisplaySrc = (field: Field) => (field.type === 'logo' ? field.src : '');

  const renderQrPreview = (field: QrField) => {
    const placeholderStroke =
  outputMode === 'uv' ? field.color || '#000000' : previewTextColor;

const placeholderFill =
  outputMode === 'uv' ? field.backgroundColor || '#ffffff' : 'rgba(255,255,255,0.04)';

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
      onClick={() => {
        setContextMenu(null);
        setEditingTextId(null);
        setSelectedId('');
      }}
    >
      <div
        style={{
          maxWidth: 1760,
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
          onClick={(e) => e.stopPropagation()}
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
            <div style={{ fontSize: 22, fontWeight: 700 }}>Metallkarten Editor</div>
          </div>

          <Panel title="Bestellung" subtitle="Pflichtangabe für die Zuordnung deiner Dateien">
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>

            </div>
            <div>
              <label>Bestellnummer</label>
              <input
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Bestellnummer oder Firmenname hier eingeben"
                style={inputStyle}
              />
            </div>
          </Panel>
           <Panel title="Produkt wählen">
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: ENABLE_CHIP ? '1fr 1fr' : '1fr',
      gap: 8,
    }}
  >
    <button
      onClick={() => setProductKey('metal')}
      style={productKey === 'metal' ? activeTabStyle : tabStyle}
    >
      Metallkarte
    </button>

    {ENABLE_CHIP && (
      <button
        onClick={() => setProductKey('chip')}
        style={productKey === 'chip' ? activeTabStyle : tabStyle}
      >
        NFC Chip
      </button>
    )}
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
                      setSelectedId('');
                      setGuideLines([]);
                      setEditingTextId(null);
                      setContextMenu(null);
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, color: '#6b7280' }}>Kartenname</label>
                        <input
                          value={card.name}
                          onChange={(e) => updateCardById(card.id, { name: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            ...inputStyle,
                            marginTop: 6,
                            fontWeight: 700,
                          }}
                        />
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCard(card.id);
                        }}
                        title="Karte löschen"
                        style={deleteIconButtonStyle}
                      >
                        ×
                      </button>
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
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

                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {card.frontFields.length + card.backFields.length} Elemente
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
<Panel title="Ausgabemodus" subtitle="Wähle zwischen Laser-Gravur und UV-Druck">
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
    <button
      onClick={() => setOutputMode('laser')}
      style={outputMode === 'laser' ? activeTabStyle : tabStyle}
    >
      Laser
    </button>
    <button
      onClick={() => setOutputMode('uv')}
      style={outputMode === 'uv' ? activeTabStyle : tabStyle}
    >
      UV-Druck
    </button>
  </div>

  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
    Laser = schwarze Gravurdatei. UV-Druck = farbige Gestaltung mit Text-, QR- und Bildfarben.
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
                checked={activeCard.showFrontQr ?? false}
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
              <button onClick={addMultilineField} style={buttonStyle}>
                Textfeld
              </button>
              <button onClick={addQrField} style={buttonStyle}>
                QR-Platzhalter
              </button>
              <button onClick={addNfcField} style={buttonStyle}>
                NFC-Symbol
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
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
              Es gibt jetzt nur noch ein Textfeld. Es startet beim Einfügen einzeilig und kann später
              im Editor mehrzeilig erweitert werden.
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
                  onClick={() => {
                    setSelectedId(field.id);
                    setEditingTextId(null);
                    setContextMenu(null);
                  }}
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
                   {field.type} · X {pxToMm(field.x, PX_PER_MM).toFixed(1)} mm · Y {pxToMm(field.y, PX_PER_MM).toFixed(1)} mm
                  </div>
                  {field.type === 'logo' ? (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                      Status:{' '}
                      {field.vectorStatus === 'ready'
                        ? 'vektorisiert'
                        : field.vectorStatus === 'processing'
                        ? 'wird verarbeitet...'
                        : field.vectorStatus === 'error'
                        ? 'Fehler'
                        : 'wartet'}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </Panel>

          <section
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 24,
              padding: 24,
              background: '#ffffff',
              display: 'grid',
              gap: 18,
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a' }}>
                Design exportieren
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6, lineHeight: 1.5 }}>
              </div>
            </div>

            <div style={{ fontSize: 15, color: '#0f172a', lineHeight: 1.55 }}>
            </div>

            <div
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                padding: 14,
                color: '#0f172a',
              }}
            >
              Die ZIP-Datei soll anschließend an folgende E-Mail geschickt werden:
              <br />
              <strong>Simons3d.factory@outlook.com</strong>
            </div>

            <button
              onClick={exportAllCards}
              style={{
                width: '100%',
                padding: '20px 18px',
                borderRadius: 20,
                border: 'none',
                background: canExport && !isSubmitting ? '#8b8d97' : '#b7bac2',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 16,
                cursor: canExport && !isSubmitting ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
              }}
              disabled={!canExport || isSubmitting}
            >
              {isSubmitting
  ? 'ZIP wird erstellt...'
  : `${cards.length} Karte(n) als ${outputMode === 'laser' ? 'Laser' : 'UV'} exportieren`}
            </button>
          </section>
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
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              background: canExport ? '#f9fafb' : '#fef2f2',
              border: canExport ? '1px solid #e5e7eb' : '2px solid #ef4444',
              borderRadius: 16,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                Bestellnummer {canExport ? '' : 'fehlt'}
              </div>
            </div>

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
                placeholder="Bestellnummer oder Firmenname eingeben"
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
  ? `ZIP-Datei: ${cleanOrderNumber}-alle-karten-${outputMode}.zip`
  : 'Bitte zuerst die Bestellnummer oder Firmenname eingeben'}
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
  {product.widthMm} mm × {product.heightMm} mm · {side === 'front' ? 'Vorderseite' : 'Rückseite'} ·
Vorschau · {activeCard.name} · Modus: {outputMode === 'laser' ? 'Laser' : 'UV-Druck'}
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
                <strong>{product.cardLabels[activeCard.cardFinish]}</strong>
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
      setSelectedId('');
      setGuideLines([]);
      setEditingTextId(null);
      setContextMenu(null);
    }}
    style={side === 'front' ? activeTabStyle : tabStyle}
  >
    Vorderseite bearbeiten
  </button>

  <button
    onClick={() => {
      setSide('back');
      setSelectedId('');
      setGuideLines([]);
      setEditingTextId(null);
      setContextMenu(null);
    }}
    style={side === 'back' ? activeTabStyle : tabStyle}
  >
    Rückseite bearbeiten
  </button>
</div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 340px',
              gap: 20,
              alignItems: 'start',
            }}
          >
            <div style={{ display: 'grid', gap: 14 }}>
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
  onClick={() => {
    setEditingTextId(null);
    setContextMenu(null);
    setSelectedId('');
  }}
  style={{
    position: 'relative',
    width: STAGE_W,
    height: STAGE_H,
    userSelect: 'none',
  }}
>
  {shapePath ? (
    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <path d={shapePath} fillRule="evenodd" />
        </clipPath>
      </defs>
    </svg>
  ) : null}

  <div
    style={{
      position: 'absolute',
      inset: 0,
      border: `1px solid ${frameStyle.border}`,
      borderRadius: shapePath ? 0 : 18,
      overflow: 'hidden',
      clipPath: shapePath ? `url(#${clipId})` : undefined,
      WebkitClipPath: shapePath ? `url(#${clipId})` : undefined,
      backgroundColor: currentPreview?.fallbackColor ?? '#d1d5db',
      backgroundImage: currentPreview?.backgroundImage
        ? `url(${currentPreview.backgroundImage})`
        : currentBackground
        ? `url(${currentBackground})`
        : undefined,
      backgroundSize: currentPreview?.backgroundSize ?? 'cover',
      backgroundPosition: currentPreview?.backgroundPosition ?? 'center',
      backgroundRepeat: currentPreview?.backgroundRepeat ?? 'no-repeat',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
    }}
  >
    {showGrid ? (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, ${frameStyle.gridLine} 1px, transparent 1px),
            linear-gradient(to bottom, ${frameStyle.gridLine} 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
    ) : null}

    {holePx ? (
      <div
        style={{
          position: 'absolute',
          left: holePx.x - holePx.radius,
          top: holePx.y - holePx.radius,
          width: holePx.radius * 2,
          height: holePx.radius * 2,
          borderRadius: '50%',
          background: '#f3f4f6',
          border: `1px solid ${frameStyle.border}`,
          pointerEvents: 'none',
          zIndex: 3,
        }}
      />
    ) : null}
  </div>


  {showSafeArea ? (
  product.safeAreaSvg ? (
    <svg
      width={STAGE_W}
      height={STAGE_H}
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        inset: 0,
        zIndex: 10,
      }}
    >
      <path
        d={product.safeAreaSvg(STAGE_W, STAGE_H, SAFE_MARGIN)}
        fill="none"
        stroke={frameStyle.safeArea}
        strokeWidth={1}
        strokeDasharray="6 4"
      />
    </svg>
  ) : (
    <div
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        left: SAFE_MARGIN,
        top: SAFE_MARGIN,
        width: STAGE_W - SAFE_MARGIN * 2,
        height: STAGE_H - SAFE_MARGIN * 2,
        border: `1px dashed ${frameStyle.safeArea}`,
        zIndex: 10,
      }}
    />
  )
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

    if (field.type === 'multiline') {
      const lines = String(field.text || '').split('\n');
      const fontFamily =
        FONT_OPTIONS[field.fontFamily] || FONT_OPTIONS[DEFAULT_FONT_FAMILY];
      const isEditing = editingTextId === field.id;

      return (
        <div
          key={field.id}
          ref={(el) => {
            fieldRefs.current[field.id] = el;
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedId(field.id);
            setContextMenu(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSelectedId(field.id);
            setEditingTextId(null);
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              fieldId: field.id,
            });
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setSelectedId(field.id);
            setEditingTextId(field.id);
            setContextMenu(null);
          }}
          onMouseDown={(e) => {
            if (isEditing) return;
            onMouseDown(e, field);
          }}
          style={{
            position: 'absolute',
            cursor: isEditing ? 'text' : 'move',
            whiteSpace: 'pre',
            outline: isSelected ? '2px solid #4f46e5' : 'none',
            outlineOffset: 2,
            left: field.x,
            top: field.y,
            minWidth: 20,
            zIndex: 20,
          }}
        >
          {isEditing ? (
            <textarea
              autoFocus
              value={field.text}
              rows={Math.max(String(field.text || '').split('\n').length, 1)}
              onChange={(e) => updateField(field.id, { text: e.target.value })}
              onBlur={() => setEditingTextId(null)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setEditingTextId(null);
                }
              }}
              style={{
                width: Math.max(bounds.width + 24, 140),
                minHeight: bounds.height + 18,
                resize: 'both',
                padding: '6px 8px',
                borderRadius: 8,
                border: '2px solid #4f46e5',
                background: 'rgba(255,255,255,0.96)',
                color: '#111827',
                fontSize: field.fontSize,
                fontWeight: field.fontWeight,
                lineHeight: 1.35,
                textAlign: field.align,
                fontFamily,
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          ) : (
            <div
              style={{
                fontSize: field.fontSize,
                color: outputMode === 'uv' ? field.color ?? '#000000' : previewTextColor,
                fontWeight: field.fontWeight,
                lineHeight: 1.35,
                textAlign: field.align,
                fontFamily,
                textShadow:
                  outputMode === 'uv'
                    ? 'none'
                    : '0 1px 0 rgba(255,255,255,0.15), 0 -1px 1px rgba(0,0,0,0.45)',
              }}
            >
              {lines.map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </div>
          )}

          {isSelected && !isEditing ? (
            <SelectionBadge width={bounds.width} height={bounds.height} />
          ) : null}
        </div>
      );
    }

    if (field.type === 'qr') {
      return (
        <div
          key={field.id}
          ref={(el) => {
            fieldRefs.current[field.id] = el;
          }}
          onMouseDown={(e) => onMouseDown(e, field)}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedId(field.id);
            setEditingTextId(null);
            setContextMenu(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSelectedId(field.id);
            setEditingTextId(null);
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              fieldId: field.id,
            });
          }}
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
            zIndex: 20,
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
          ref={(el) => {
            fieldRefs.current[field.id] = el;
          }}
          onMouseDown={(e) => onMouseDown(e, field)}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedId(field.id);
            setEditingTextId(null);
            setContextMenu(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSelectedId(field.id);
            setEditingTextId(null);
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              fieldId: field.id,
            });
          }}
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
            zIndex: 20,
          }}
        >
          {outputMode === 'uv' ? (
  <div
    style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      opacity: field.vectorStatus === 'processing' ? 0.85 : 1,
      pointerEvents: 'none',
      userSelect: 'none',
    }}
  >
    {shouldShowUvLogoOutline && field.label !== 'NFC Symbol' ? (
      <>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            WebkitMaskImage: `url(${field.exportSrc || field.originalSrc || field.src})`,
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskSize: 'contain',
            WebkitMaskPosition: 'center',
            maskImage: `url(${field.exportSrc || field.originalSrc || field.src})`,
            maskRepeat: 'no-repeat',
            maskSize: 'contain',
            maskPosition: 'center',
            backgroundColor: '#ffffff',
            transform: `translate(-${uvOutlinePx}px, 0)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            WebkitMaskImage: `url(${field.exportSrc || field.originalSrc || field.src})`,
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskSize: 'contain',
            WebkitMaskPosition: 'center',
            maskImage: `url(${field.exportSrc || field.originalSrc || field.src})`,
            maskRepeat: 'no-repeat',
            maskSize: 'contain',
            maskPosition: 'center',
            backgroundColor: '#ffffff',
            transform: `translate(${uvOutlinePx}px, 0)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            WebkitMaskImage: `url(${field.exportSrc || field.originalSrc || field.src})`,
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskSize: 'contain',
            WebkitMaskPosition: 'center',
            maskImage: `url(${field.exportSrc || field.originalSrc || field.src})`,
            maskRepeat: 'no-repeat',
            maskSize: 'contain',
            maskPosition: 'center',
            backgroundColor: '#ffffff',
            transform: `translate(0, -${uvOutlinePx}px)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            WebkitMaskImage: `url(${field.exportSrc || field.originalSrc || field.src})`,
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskSize: 'contain',
            WebkitMaskPosition: 'center',
            maskImage: `url(${field.exportSrc || field.originalSrc || field.src})`,
            maskRepeat: 'no-repeat',
            maskSize: 'contain',
            maskPosition: 'center',
            backgroundColor: '#ffffff',
            transform: `translate(0, ${uvOutlinePx}px)`,
          }}
        />
      </>
    ) : null}

    {field.label === 'NFC Symbol' ? (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          WebkitMaskImage: `url(${field.exportSrc || field.originalSrc || field.src})`,
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskSize: 'contain',
          WebkitMaskPosition: 'center',
          maskImage: `url(${field.exportSrc || field.originalSrc || field.src})`,
          maskRepeat: 'no-repeat',
          maskSize: 'contain',
          maskPosition: 'center',
          backgroundColor: field.color || '#000000',
        }}
      />
    ) : (
      <img
        src={field.exportSrc || field.originalSrc || field.src}
        alt={field.label}
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    )}
  </div>
) : field.vectorMarkup && field.vectorWidth && field.vectorHeight ? (
  <svg
    width={field.width}
    height={field.height}
    viewBox={`0 0 ${field.vectorWidth} ${field.vectorHeight}`}
    preserveAspectRatio="xMidYMid meet"
    style={{
      display: 'block',
      width: '100%',
      height: '100%',
      opacity: field.vectorStatus === 'processing' ? 0.6 : 1,
      pointerEvents: 'none',
    }}
  >
    <svg
  width={field.width}
  height={field.height}
  viewBox={`0 0 ${field.vectorWidth} ${field.vectorHeight}`}
  preserveAspectRatio="xMidYMid meet"
  style={{
    display: 'block',
    width: '100%',
    height: '100%',
    opacity: field.vectorStatus === 'processing' ? 0.6 : 1,
    pointerEvents: 'none',
    color: previewTextColor,
  }}
>
  <g dangerouslySetInnerHTML={{ __html: field.vectorMarkup }} />
</svg>
  </svg>
) : (
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
      opacity: field.vectorStatus === 'processing' ? 0.6 : 1,
    }}
  />
)}

          {field.vectorStatus === 'processing' ? (
            <div
              style={{
                position: 'absolute',
                left: 6,
                top: 6,
                fontSize: 10,
                background: 'rgba(17,24,39,0.85)',
                color: '#fff',
                borderRadius: 999,
                padding: '2px 6px',
              }}
            >
              Trace…
            </div>
          ) : null}

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
            {selected && selectedDistances ? (
  <div
    style={{
      marginTop: 14,
      border: '1px solid #e5e7eb',
      borderRadius: 14,
      background: '#ffffff',
      padding: 14,
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: 12,
    }}
  >
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 10,
        background: '#fafafa',
      }}
    >
      <div style={{ fontSize: 12, color: '#6b7280' }}>Abstand links</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
        {selectedDistances.left.toFixed(1)} mm
      </div>
    </div>

    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 10,
        background: '#fafafa',
      }}
    >
      <div style={{ fontSize: 12, color: '#6b7280' }}>Abstand rechts</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
        {selectedDistances.right.toFixed(1)} mm
      </div>
    </div>

    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 10,
        background: '#fafafa',
      }}
    >
      <div style={{ fontSize: 12, color: '#6b7280' }}>Abstand oben</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
        {selectedDistances.top.toFixed(1)} mm
      </div>
    </div>

    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 10,
        background: '#fafafa',
      }}
    >
      <div style={{ fontSize: 12, color: '#6b7280' }}>Abstand unten</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
        {selectedDistances.bottom.toFixed(1)} mm
      </div>
    </div>
   </div>
) : null}
    </div>
  </div>

  <div style={{ display: 'grid', gap: 14 }}>
              <Panel title={selected ? `Ausgewählt: ${selected.label}` : 'Kein Element ausgewählt'}>
                {selected ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label>X Position (mm)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={pxToMm(selected.x, PX_PER_MM).toFixed(1)}
                        onChange={(e) => {
  const nextX = mmToPx(Number(e.target.value), PX_PER_MM);
  const bounds = fieldBounds(selected);
  const clampedPos = clampFieldToProductSafeArea(
    productKey,
    nextX,
    selected.y,
    bounds.width,
    bounds.height,
    STAGE_W,
    STAGE_H,
    SAFE_MARGIN,
  );

  updateField(selected.id, { x: clampedPos.x });
}
}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label>Y Position (mm)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={pxToMm(selected.y, PX_PER_MM).toFixed(1)}
                          onChange={(e) => {
  const nextY = mmToPx(Number(e.target.value), PX_PER_MM);
  const bounds = fieldBounds(selected);
  const clampedPos = clampFieldToProductSafeArea(
    productKey,
    selected.x,
    nextY,
    bounds.width,
    bounds.height,
    STAGE_W,
    STAGE_H,
    SAFE_MARGIN,
  );

  updateField(selected.id, { y: clampedPos.y });
}}
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    {selected.type === 'multiline' && (
                      <>
{outputMode === 'uv' ? (
  <div>
    <label>Textfarbe</label>
    <input
      type="color"
      value={selected.color ?? '#000000'}
      onChange={(e) =>
        updateField(selected.id, { color: e.target.value })
      }
      style={{
        ...inputStyle,
        padding: 4,
        height: 44,
      }}
    />
  </div>
) : (
  <div style={{ fontSize: 12, color: '#6b7280' }}>
    Im Laser-Modus wird Text als Gravur dargestellt. Textfarbe ist nur im UV-Modus aktiv.
  </div>
)}
                        <div>
                          <label>Text</label>
                          <textarea
                            value={selected.text}
                            onChange={(e) => updateField(selected.id, { text: e.target.value })}
                            rows={4}
                            style={inputStyle}
                          />
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
                            max={80}
                            step={1}
                            value={selected.fontSize}
                            onChange={(e) => updateField(selected.id, { fontSize: Number(e.target.value) })}
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
                      <>{outputMode === 'uv' ? (
  <>
    <div>
      <label>QR-Farbe</label>
      <input
        type="color"
        value={selected.color || '#000000'}
        onChange={(e) => updateField(selected.id, { color: e.target.value })}
        style={{
          ...inputStyle,
          padding: 4,
          height: 44,
        }}
      />
    </div>

    <div>
      <label>QR-Hintergrund</label>
      <input
        type="color"
        value={selected.backgroundColor || '#ffffff'}
        onChange={(e) =>
          updateField(selected.id, { backgroundColor: e.target.value })
        }
        style={{
          ...inputStyle,
          padding: 4,
          height: 44,
        }}
      />
    </div>
  </>
) : null}
                        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                          Dieses Element ist nur ein QR-Platzhalter. Der echte QR-Code wird später eingefügt.
                        </div>
                        <div>
                          <label>
                           Größe: {selected.size}px ({pxToMm(selected.size, PX_PER_MM).toFixed(1)} mm)
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

                    {outputMode === 'uv' && selected.label === 'NFC Symbol' ? (
  <div>
    <label>NFC-Farbe</label>
    <input
      type="color"
      value={selected.color ?? '#000000'}
      onChange={(e) =>
        updateField(selected.id, { color: e.target.value })
      }
      style={{
        ...inputStyle,
        padding: 4,
        height: 44,
      }}
    />
  </div>
) : null}

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
                          Das Bild wird automatisch hochskaliert, kontrastverstärkt und als Pfad exportiert.
                        </div>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>
                          Vektorstatus:{' '}
                          <strong>
                            {selected.vectorStatus === 'ready'
                              ? 'vektorisiert'
                              : selected.vectorStatus === 'processing'
                              ? 'wird verarbeitet'
                              : selected.vectorStatus === 'error'
                              ? 'Fehler'
                              : 'wartet'}
                          </strong>
                        </div>
                      </>
                    )}

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
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: '#6b7280' }}>
                    Klicke links in der Elementliste oder direkt in der Vorschau auf ein Element.
                  </div>
                )}
              </Panel>

              <Panel title="Editor Hinweise">
                <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                  Doppelklick auf ein Textfeld zum direkten Bearbeiten. Mit Pfeiltasten kannst du das
                  ausgewählte Element verschieben. Mit <strong>Strg/Cmd + D</strong> wird es dupliziert.
                </div>
                {isProcessingImage ? (
                  <div style={{ color: '#2563eb', fontWeight: 700, fontSize: 13 }}>
                    Bild wird hochskaliert und in Vektor-Konturen umgewandelt...
                  </div>
                ) : null}
              </Panel>
            </div>
          </div>
        </main>
      </div>

      {contextMenu && contextField ? (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            zIndex: 9999,
            overflow: 'hidden',
            minWidth: 220,
            padding: 12,
            display: 'grid',
            gap: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextField.type === 'multiline' && (
            <>
              <div style={{ display: 'grid', gap: 4 }}>
                <label style={{ fontSize: 12, color: '#6b7280' }}>
                  Schriftgröße: {contextField.fontSize}px
                </label>
                <input
                  type="range"
                  min={8}
                  max={80}
                  step={1}
                  value={contextField.fontSize}
                  onChange={(e) =>
                    updateField(contextField.id, {
                      fontSize: Number(e.target.value),
                    })
                  }
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gap: 4 }}>
                <label style={{ fontSize: 12, color: '#6b7280' }}>
                  Stärke: {contextField.fontWeight}
                </label>
                <input
                  type="range"
                  min={300}
                  max={800}
                  step={100}
                  value={contextField.fontWeight}
                  onChange={(e) =>
                    updateField(contextField.id, {
                      fontWeight: Number(e.target.value),
                    })
                  }
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gap: 4 }}>
                <label style={{ fontSize: 12, color: '#6b7280' }}>Schriftart</label>
                <select
                  value={contextField.fontFamily}
                  onChange={(e) =>
                    updateField(contextField.id, {
                      fontFamily: e.target.value as FontFamilyKey,
                    })
                  }
                  style={{
                    width: '100%',
                    padding: 8,
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    background: '#fff',
                  }}
                >
                  {Object.entries(FONT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {outputMode === 'uv' ? (
  <div style={{ display: 'grid', gap: 4 }}>
    <label style={{ fontSize: 12, color: '#6b7280' }}>Textfarbe</label>
    <input
      type="color"
      value={contextField.color ?? '#000000'}
      onChange={(e) =>
        updateField(contextField.id, { color: e.target.value })
      }
      style={{
        width: '100%',
        height: 42,
        borderRadius: 8,
        border: '1px solid #d1d5db',
        background: '#fff',
        padding: 4,
      }}
    />
  </div>
) : null}
            </>
          )}

          <button
            onClick={() => removeField(contextField.id)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderRadius: 8,
              background: '#fee2e2',
              color: '#b91c1c',
              textAlign: 'left',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Löschen
          </button>
        </div>
      ) : null}
    </div>
  );
}
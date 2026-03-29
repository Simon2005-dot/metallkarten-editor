import type { Field } from './types';

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function mmToPx(mm: number, pxPerMm: number) {
  return mm * pxPerMm;
}

export function pxToMm(px: number, pxPerMm: number) {
  return px / pxPerMm;
}

export function roundToGrid(value: number, gridSize: number) {
  return Math.round(value / gridSize) * gridSize;
}

export function sanitizeOrderNumber(value: string) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

export function normalizeQrValue(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/.*)?$/i.test(raw)) return `https://${raw}`;
  return raw;
}

export function buildUniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function fieldBounds(field: Field) {
  if (field.type === 'qr') {
    return { width: field.size, height: field.size };
  }

  if (field.type === 'logo') {
    return { width: field.width, height: field.height };
  }

  const lines = String(field.text || '').split('\n');
  const maxChars = Math.max(...lines.map((line) => line.length), 1);
  const width = Math.max(40, maxChars * field.fontSize * 0.62);
  const height = Math.max(lines.length, 1) * field.fontSize * 1.35;

  return { width, height };
}

export function getFieldDistances(
  field: Field,
  stageW: number,
  stageH: number,
  pxPerMm: number,
  measuredBounds?: { width: number; height: number },
) {
  const bounds = measuredBounds || fieldBounds(field);

  return {
    left: pxToMm(field.x, pxPerMm),
    right: pxToMm(stageW - (field.x + bounds.width), pxPerMm),
    top: pxToMm(field.y, pxPerMm),
    bottom: pxToMm(stageH - (field.y + bounds.height), pxPerMm),
  };
}

export function duplicateField(field: Field): Field {
  if (field.type === 'logo') {
    const originalSrc = field.originalSrc || field.src;

    return {
      ...field,
      id: buildUniqueId(field.id),
      label: `${field.label} Kopie`,
      x: field.x + 16,
      y: field.y + 16,
      src: originalSrc,
      originalSrc,
      exportSrc: originalSrc,
      vectorMarkup: undefined,
      vectorWidth: undefined,
      vectorHeight: undefined,
      removedBackground: false,
      laserMode: 'original',
      vectorStatus: 'idle',
    };
  }

  return {
    ...field,
    id: buildUniqueId(field.id),
    label: `${field.label} Kopie`,
    x: field.x + 16,
    y: field.y + 16,
  };
}
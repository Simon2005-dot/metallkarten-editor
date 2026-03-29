import type { CardFinishKey, Field } from './types';

export type ProductFrameStyle = {
  border: string;
  gridLine: string;
  safeArea: string;
};

export type DesignerProduct = {
  id: string;
  name: string;

  widthMm: number;
  heightMm: number;
  pxPerMm: number;
  safeMarginMm: number;

  backgrounds: Record<CardFinishKey, string>;
  frameStyles: Record<CardFinishKey, ProductFrameStyle>;
  cardLabels: Record<CardFinishKey, string>;

  frontDefaultFields: Field[];
  backDefaultFields: Field[];
};
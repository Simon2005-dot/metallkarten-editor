export type FontFamilyKey =
  | 'arial'
  | 'helvetica'
  | 'times'
  | 'georgia'
  | 'verdana'
  | 'tahoma'
  | 'trebuchet'
  | 'courier';

export type BaseField = {
  id: string;
  label: string;
  x: number;
  y: number;
};

export type TextField = BaseField & {
  type: 'multiline';
  text: string;
  fontSize: number;
  fontWeight: number;
  align: 'left' | 'center' | 'right';
  color?: string;
  fontFamily: FontFamilyKey;
};

export type QrField = BaseField & {
  type: 'qr';
  text: string;
  size: number;
  color?: string;
  backgroundColor?: string;
};

export type LogoField = BaseField & {
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
  vectorMarkup?: string;
  vectorWidth?: number;
  vectorHeight?: number;
  vectorStatus?: 'idle' | 'processing' | 'ready' | 'error';
  preserveFullColor?: boolean;
};

export type Field = TextField | QrField | LogoField;

export type Side = 'front' | 'back';

export type CardFinishKey = 'black' | 'silver' | 'gold';

export type OutputMode = 'laser' | 'uv';

export type DragState = {
  id: string;
  offsetX: number;
  offsetY: number;
} | null;

export type ResizeState = {
  id: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
} | null;

export type GuideLine =
  | { type: 'vertical'; x: number }
  | { type: 'horizontal'; y: number };

export type PreparedQrField = QrField & {
  qrMatrix?: boolean[][] | null;
};

export type PreparedField = TextField | LogoField | PreparedQrField;

export type CardDesign = {
  id: string;
  name: string;
  cardFinish: CardFinishKey;
  showFrontQr: boolean;
  showBackQr: boolean;
  frontFields: Field[];
  backFields: Field[];
};

export type VectorTraceResult = {
  previewSrc: string;
  vectorMarkup: string;
  vectorWidth: number;
  vectorHeight: number;
};

export type ContextMenuState = {
  x: number;
  y: number;
  fieldId: string;
} | null;

export type ProductShape = 'rect' | 'circle';

export type DesignerProduct = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  pxPerMm: number;
  safeMarginMm: number;
  shape: ProductShape;
  hole?: {
    x: number;
    y: number;
    radius: number;
  };
  backgrounds: Record<string, string>;
  frameStyles: Record<
    string,
    { border: string; gridLine: string; safeArea: string }
  >;
  cardLabels: Record<string, string>;
  frontDefaultFields: Field[];
  backDefaultFields: Field[];
};
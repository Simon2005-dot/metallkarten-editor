'use client';

export function SelectionBadge({ width, height }: { width: number; height: number }) {
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
      {width} × {height}
    </div>
  );
}
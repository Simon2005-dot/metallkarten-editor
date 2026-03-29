'use client';

import React from 'react';

type PanelProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function Panel({ title, subtitle, children }: PanelProps) {
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
          <div style={{ fontSize: 12, color: '#1d1f22', marginTop: 2 }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
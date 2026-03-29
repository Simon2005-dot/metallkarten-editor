import type { CSSProperties } from 'react';

export const buttonStyle: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
  color: '#111827',
};

export const deleteIconButtonStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 999,
  border: '1px solid #fecaca',
  background: '#fff1f2',
  color: '#dc2626',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: '1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

export const inputStyle: CSSProperties = {
  width: '100%',
  marginTop: 6,
  padding: 10,
  borderRadius: 10,
  border: '1px solid #d1d5db',
  boxSizing: 'border-box',
  color: '#111827',
  background: '#ffffff',
};

export const tabStyle: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
  color: '#111827',
};

export const activeTabStyle: CSSProperties = {
  ...tabStyle,
  background: '#111827',
  color: '#fff',
  borderColor: '#111827',
};

export const toggleRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: '#111827',
  gap: 12,
};

export const statStyle: CSSProperties = {
  background: '#fafafa',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 12,
  display: 'grid',
  gap: 4,
  color: '#111827',
  minWidth: 110,
};
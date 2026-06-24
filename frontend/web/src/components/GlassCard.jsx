import React from 'react';

export default function GlassCard({ children, style = {}, className = '', padding = 22, borderRadius = 24 }) {
  return (
    <div
      className={`glass-card ${className}`}
      style={{ padding, borderRadius, ...style }}
    >
      {children}
    </div>
  );
}

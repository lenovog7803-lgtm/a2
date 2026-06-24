import React, { useState } from 'react';
import { MONTHS_RU, fmtMoney } from '../api.js';

export function ProfitChart({ chartData = [], mode = 'month' }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!chartData.length) return (
    <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A6AEB8', fontSize: 13 }}>
      Нет данных
    </div>
  );

  const W = 620, H = 210, PAD = 14;
  const vals = chartData.map(p => p.margin ?? p.value ?? 0);
  const prev = chartData.map(p => p.prev_margin ?? p.prev_value ?? 0);
  const allVals = [...vals, ...prev];
  const minV = Math.min(...allVals, 0);
  const maxV = Math.max(...allVals, 1);
  const range = maxV - minV || 1;

  const toY = (v) => PAD + ((maxV - v) / range) * (H - PAD * 2 - 20);
  const toX = (i) => (i / (chartData.length - 1)) * (W - PAD * 2) + PAD;

  const pts = chartData.map((p, i) => ({ x: toX(i), y: toY(vals[i]), py: toY(prev[i]), v: vals[i], pv: prev[i], label: p.label || MONTHS_RU[i] || '' }));

  const curPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const prevPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.py.toFixed(1)}`).join(' ');
  const areaPath = `${curPath} L${pts[pts.length-1].x.toFixed(1)},${(H-PAD).toFixed(1)} L${pts[0].x.toFixed(1)},${(H-PAD).toFixed(1)} Z`;

  const hoverPt = hoverIdx !== null ? pts[hoverIdx] : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: H, display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1366F0" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#1366F0" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1366F0" />
            <stop offset="100%" stopColor="#0E1726" />
          </linearGradient>
        </defs>
        {hoverPt && (
          <line x1={hoverPt.x} y1={PAD} x2={hoverPt.x} y2={H-PAD} stroke="#1366F0" strokeWidth="1.4" strokeDasharray="4 4" opacity="0.45" />
        )}
        <path d={prevPath} fill="none" stroke="#B8C0CC" strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" />
        <path d={areaPath} fill="url(#areaGrad)" />
        <path d={curPath} fill="none" stroke="url(#lineGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={hoverIdx === i ? 5 : 3.5} fill="#fff" stroke="#1366F0" strokeWidth="2.5" />
            <rect
              x={p.x - W / pts.length / 2}
              y={0}
              width={W / pts.length}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              style={{ cursor: 'pointer' }}
            />
          </g>
        ))}
      </svg>
      {/* x labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 6px', marginTop: -18 }}>
        {pts.map((p, i) => (
          <span key={i} style={{ fontSize: 11, color: hoverIdx === i ? '#0E1726' : '#8A93A0', fontWeight: hoverIdx === i ? 700 : 500 }}>{p.label}</span>
        ))}
      </div>
      {/* Tooltip */}
      {hoverPt && (
        <div style={{
          position: 'absolute', top: 0,
          left: Math.min(Math.max(0, hoverPt.x / W * 100 - 12), 65) + '%',
          width: 150, pointerEvents: 'none',
          borderRadius: 13, padding: '11px 13px',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.85)',
          boxShadow: '0 16px 40px -16px rgba(20,30,55,0.5)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.04em' }}>{hoverPt.label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 5 }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 17, color: '#0E1726' }}>{fmtMoney(hoverPt.v)}</span>
            {hoverPt.pv > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: hoverPt.v >= hoverPt.pv ? '#1E9E5A' : '#E0473B' }}>
                {hoverPt.v >= hoverPt.pv ? '+' : ''}{fmtMoney(hoverPt.v - hoverPt.pv)}
              </span>
            )}
          </div>
          {hoverPt.pv > 0 && <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 2 }}>было {fmtMoney(hoverPt.pv)}</div>}
        </div>
      )}
    </div>
  );
}

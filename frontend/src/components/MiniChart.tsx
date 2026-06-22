import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Circle, Rect, Line } from 'react-native-svg';
import { useTheme } from '../themeContext';

interface MiniChartProps {
  data: number[];
  width: number;
  height?: number;
  color?: string;
  showTooltip?: boolean;
  labels?: string[];
}

export function MiniChart({ data, width, height = 60, color = '#2563EB', showTooltip = true, labels }: MiniChartProps) {
  const { theme } = useTheme();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<any>(null);

  if (!data || data.length < 2) return null;

  const H = height;
  const W = width;
  const PAD_L = 4;
  const PAD_R = 4;
  const PAD_T = 6;
  const PAD_B = 4;
  const maxVal = Math.max(...data, 1);

  const pts = data.map((v, i) => ({
    x: PAD_L + (i / (data.length - 1)) * (W - PAD_L - PAD_R),
    y: PAD_T + (1 - v / maxVal) * (H - PAD_T - PAD_B),
    v, i,
  }));

  let path = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1].x + pts[i].x) / 2;
    path += ` C${cpx},${pts[i - 1].y} ${cpx},${pts[i].y} ${pts[i].x},${pts[i].y}`;
  }
  const fillPath = path + ` L${pts[pts.length - 1].x},${H} L${pts[0].x},${H} Z`;

  const gradId = `mg_${color.replace('#', '')}`;

  return (
    <View style={{ position: 'relative' }}>
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        <Defs>
          <SvgGrad id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.15" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </SvgGrad>
        </Defs>

        <Path d={fillPath} fill={`url(#${gradId})`} />

        {pts.map((pt, i) => {
          if (i === 0) return null;
          let op = 1;
          if (hoveredIdx !== null) {
            const dist = Math.min(Math.abs(i - hoveredIdx), Math.abs(i - 1 - hoveredIdx));
            op = dist === 0 ? 1 : dist === 1 ? 0.5 : 0.15;
          }
          const cpx = (pts[i - 1].x + pts[i].x) / 2;
          const seg = `M${pts[i - 1].x},${pts[i - 1].y} C${cpx},${pts[i - 1].y} ${cpx},${pt.y} ${pt.x},${pt.y}`;
          return <Path key={i} d={seg} stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={op} />;
        })}

        {hoveredIdx !== null && pts[hoveredIdx] && (
          <>
            <Circle cx={pts[hoveredIdx].x} cy={pts[hoveredIdx].y} r={6} fill={color} opacity={0.15} />
            <Circle cx={pts[hoveredIdx].x} cy={pts[hoveredIdx].y} r={3.5} fill={color} />
            <Circle cx={pts[hoveredIdx].x} cy={pts[hoveredIdx].y} r={1.8} fill="#fff" />
            <Line x1={pts[hoveredIdx].x} y1={PAD_T} x2={pts[hoveredIdx].x} y2={H - PAD_B} stroke={color} strokeWidth={0.8} strokeDasharray="2,3" opacity={0.3} />
          </>
        )}

        {showTooltip && pts.map((pt, i) => (
          <Rect
            key={i}
            x={pt.x - W / data.length / 2}
            y={0}
            width={W / data.length}
            height={H}
            fill="transparent"
            onPressIn={() => {
              setHoveredIdx(i);
              setTooltip({ x: pt.x, y: pt.y, v: pt.v, label: labels?.[i] || String(i + 1) });
            }}
            onPressOut={() => { setHoveredIdx(null); setTooltip(null); }}
          />
        ))}
      </Svg>

      {tooltip && showTooltip && (
        <View style={{
          position: 'absolute',
          left: Math.max(0, Math.min(tooltip.x - 45, W - 92)),
          top: Math.max(0, tooltip.y - 46),
          backgroundColor: '#1a1a2e',
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          zIndex: 99,
        }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9 }}>{tooltip.label}</Text>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
            {tooltip.v.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} Br
          </Text>
        </View>
      )}
    </View>
  );
}

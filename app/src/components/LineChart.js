import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme';

// points: [{ x: number (ms), y: number, y2?: number (trend) }]
// Values up the left side (yLabel: their unit), dates along the bottom.
export default function LineChart({ points, height = 180, color, trendColor, goal, formatY, formatX, yLabel }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  if (!points.length) return null;

  const padL = 40;
  const padR = 10;
  const padT = yLabel ? 18 : 10;
  const padB = 22;
  const ys = points.flatMap((p) => [p.y, p.y2]).filter((v) => v != null);
  if (goal != null) ys.push(goal);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (maxY - minY < 2) {
    minY -= 1;
    maxY += 1;
  }
  const spanPad = (maxY - minY) * 0.1;
  minY -= spanPad;
  maxY += spanPad;
  const minX = points[0].x;
  const maxX = points.length > 1 ? points[points.length - 1].x : minX + 1;
  const w = Math.max(1, width - padL - padR);
  const h = height - padT - padB;
  const sx = (x) => padL + ((x - minX) / (maxX - minX || 1)) * w;
  const sy = (y) => padT + (1 - (y - minY) / (maxY - minY)) * h;

  const ticks = [minY + (maxY - minY) * 0.15, (minY + maxY) / 2, maxY - (maxY - minY) * 0.15];
  const showDots = points.length <= 40;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {ticks.map((v, i) => (
            <React.Fragment key={i}>
              <Line x1={padL} x2={width - padR} y1={sy(v)} y2={sy(v)} stroke={t.border} strokeWidth={1} />
              <SvgText x={padL - 6} y={sy(v) + 4} fontSize={10} fill={t.textFaint} textAnchor="end">
                {formatY ? formatY(v) : v.toFixed(0)}
              </SvgText>
            </React.Fragment>
          ))}
          {yLabel ? (
            <SvgText x={padL - 6} y={10} fontSize={10} fontWeight="bold" fill={t.textDim} textAnchor="end">
              {yLabel}
            </SvgText>
          ) : null}
          {goal != null && (
            <Line x1={padL} x2={width - padR} y1={sy(goal)} y2={sy(goal)} stroke={t.good} strokeDasharray="6 4" strokeWidth={1.5} />
          )}
          {points.length > 1 && (
            <Polyline
              points={points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
              fill="none"
              stroke={color || t.primary}
              strokeOpacity={0.35}
              strokeWidth={1.5}
            />
          )}
          {points.some((p) => p.y2 != null) && points.length > 1 && (
            <Polyline
              points={points
                .filter((p) => p.y2 != null)
                .map((p) => `${sx(p.x)},${sy(p.y2)}`)
                .join(' ')}
              fill="none"
              stroke={trendColor || color || t.primary}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {showDots && points.map((p, i) => <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3} fill={color || t.primary} />)}
          {formatX && (
            <>
              <SvgText x={padL} y={height - 6} fontSize={10} fill={t.textFaint}>
                {formatX(minX)}
              </SvgText>
              {maxX - minX > 2 * 86400000 && (
                <SvgText x={padL + w / 2} y={height - 6} fontSize={10} fill={t.textFaint} textAnchor="middle">
                  {formatX((minX + maxX) / 2)}
                </SvgText>
              )}
              <SvgText x={width - padR} y={height - 6} fontSize={10} fill={t.textFaint} textAnchor="end">
                {formatX(maxX)}
              </SvgText>
            </>
          )}
        </Svg>
      )}
      {width === 0 && <Text> </Text>}
    </View>
  );
}

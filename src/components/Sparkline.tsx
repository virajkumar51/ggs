import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
  strokeWidth?: number;
  showArea?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 68,
  height = 24,
  positive = true,
  strokeWidth = 1.5,
  showArea = true,
}) => {
  if (!data || data.length < 2) {
    return <div className="w-[68px] h-[24px] bg-[#141923]" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((val - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polylineStr = points.join(' ');
  const areaStr = `${pad},${height - pad} ${polylineStr} ${width - pad},${height - pad}`;
  const strokeColor = positive ? '#00E676' : '#FF4D4D';
  const gradId = `spark-${positive ? 'up' : 'dn'}-${width}-${height}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {showArea && <polygon points={areaStr} fill={`url(#${gradId})`} />}
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylineStr}
      />
    </svg>
  );
};

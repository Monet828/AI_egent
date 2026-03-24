"use client";

import { useState, useEffect } from "react";
import {
  Radar,
  RadarChart as ReRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

type Props = {
  values: {
    design: number;
    performance: number;
    cost: number;
    lifestyle: number;
    trust: number;
  };
};

export default function RadarChart({ values }: Props) {
  const [animatedValues, setAnimatedValues] = useState({
    design: 0,
    performance: 0,
    cost: 0,
    lifestyle: 0,
    trust: 0,
  });

  useEffect(() => {
    // 少し遅延してからアニメーション開始
    const timer = setTimeout(() => {
      setAnimatedValues(values);
    }, 300);
    return () => clearTimeout(timer);
  }, [values]);

  const data = [
    { axis: "デザイン", value: animatedValues.design },
    { axis: "性能", value: animatedValues.performance },
    { axis: "コスパ", value: animatedValues.cost },
    { axis: "暮らし", value: animatedValues.lifestyle },
    { axis: "安心・信頼", value: animatedValues.trust },
  ];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ReRadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fontSize: 12, fill: "#374151" }}
        />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          dataKey="value"
          stroke="#1D9E75"
          fill="#1D9E75"
          fillOpacity={0.2}
          strokeWidth={2}
          isAnimationActive={true}
          animationDuration={800}
          animationEasing="ease-out"
        />
      </ReRadarChart>
    </ResponsiveContainer>
  );
}

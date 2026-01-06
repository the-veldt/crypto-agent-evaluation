'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from 'recharts';
import { getModelColor } from '@/lib/utils';

interface ScoreComparisonChartProps {
  summary: {
    averageScores: {
      [system: string]: {
        overall: number;
      };
    };
  };
}

export function ScoreComparisonChart({ summary }: ScoreComparisonChartProps) {
  const data = Object.entries(summary.averageScores).map(([system, scores]) => ({
    system,
    score: scores.overall,
  }));

  const chartConfig = {
    score: {
      label: 'Overall Score',
      color: 'hsl(var(--chart-1))',
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overall Score Comparison</CardTitle>
        <CardDescription>Average overall scores across all questions</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="system" />
            <YAxis domain={[0, 10]} />
            <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }} />
            <Bar dataKey="score" radius={4}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getModelColor(entry.system)}
                  style={{ transition: 'opacity 0.2s' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

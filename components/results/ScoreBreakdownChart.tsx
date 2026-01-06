'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from 'recharts';
import { getModelColor } from '@/lib/utils';

interface ScoreBreakdownChartProps {
  summary: {
    averageScores: {
      [system: string]: {
        taskCompletion: number;
        answerQuality: number;
        reasoningQuality: number;
        efficiency: number;
      };
    };
  };
}

export function ScoreBreakdownChart({ summary }: ScoreBreakdownChartProps) {
  const data = Object.entries(summary.averageScores).map(([system, scores]) => ({
    system,
    taskCompletion: scores.taskCompletion,
    answerQuality: scores.answerQuality,
    reasoningQuality: scores.reasoningQuality,
    efficiency: scores.efficiency,
  }));

  const chartConfig = {
    taskCompletion: {
      label: 'Task Completion',
      color: 'hsl(var(--chart-1))',
    },
    answerQuality: {
      label: 'Answer Quality',
      color: 'hsl(var(--chart-2))',
    },
    reasoningQuality: {
      label: 'Reasoning Quality',
      color: 'hsl(var(--chart-3))',
    },
    efficiency: {
      label: 'Efficiency',
      color: 'hsl(var(--chart-4))',
    },
  } satisfies ChartConfig;

  // Helper to get slightly different opacity for each metric
  const getMetricColor = (system: string, opacity: number) => {
    const baseColor = getModelColor(system);
    // Extract the hex color and convert to rgba
    if (baseColor.startsWith('var(')) {
      return `color-mix(in srgb, ${baseColor} ${opacity * 100}%, transparent)`;
    }
    return baseColor;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Score Breakdown by Dimension</CardTitle>
        <CardDescription>
          Comparison across task completion, answer quality, reasoning, and efficiency
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="system" />
            <YAxis domain={[0, 10]} />
            <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="taskCompletion" radius={4}>
              {data.map((entry, index) => (
                <Cell key={`tc-${index}`} fill={getMetricColor(entry.system, 1)} />
              ))}
            </Bar>
            <Bar dataKey="answerQuality" radius={4}>
              {data.map((entry, index) => (
                <Cell key={`aq-${index}`} fill={getMetricColor(entry.system, 0.8)} />
              ))}
            </Bar>
            <Bar dataKey="reasoningQuality" radius={4}>
              {data.map((entry, index) => (
                <Cell key={`rq-${index}`} fill={getMetricColor(entry.system, 0.6)} />
              ))}
            </Bar>
            <Bar dataKey="efficiency" radius={4}>
              {data.map((entry, index) => (
                <Cell key={`ef-${index}`} fill={getMetricColor(entry.system, 0.4)} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

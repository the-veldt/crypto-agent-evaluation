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

interface PerformanceMetricsChartProps {
  summary: {
    averageExecutionTime: {
      [system: string]: number;
    };
    averageSteps: {
      [system: string]: number;
    };
  };
}

export function PerformanceMetricsChart({ summary }: PerformanceMetricsChartProps) {
  const data = Object.keys(summary.averageExecutionTime).map((system) => ({
    system,
    executionTime: (summary.averageExecutionTime[system] / 1000).toFixed(1), // Convert to seconds
    steps: summary.averageSteps[system].toFixed(1),
  }));

  const chartConfig = {
    executionTime: {
      label: 'Execution Time (s)',
      color: 'hsl(var(--chart-1))',
    },
    steps: {
      label: 'Steps',
      color: 'hsl(var(--chart-2))',
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Metrics</CardTitle>
        <CardDescription>Average execution time and steps taken per system</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Execution Time Chart */}
          <div>
            <h4 className="text-sm font-medium mb-4">Execution Time (seconds)</h4>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="system" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }} />
                <Bar dataKey="executionTime" radius={4}>
                  {data.map((entry, index) => (
                    <Cell key={`time-${index}`} fill={getModelColor(entry.system)} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>

          {/* Steps Chart */}
          <div>
            <h4 className="text-sm font-medium mb-4">Average Steps</h4>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="system" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }} />
                <Bar dataKey="steps" radius={4}>
                  {data.map((entry, index) => (
                    <Cell key={`steps-${index}`} fill={getModelColor(entry.system)} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

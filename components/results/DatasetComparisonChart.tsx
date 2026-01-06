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
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { getModelColor } from '@/lib/utils';

interface DatasetComparisonChartProps {
  summary: {
    averageScoresByDataset: {
      [dataset: string]: {
        [system: string]: {
          overall: number;
        };
      };
    };
  };
}

export function DatasetComparisonChart({ summary }: DatasetComparisonChartProps) {
  // exit early if no data
  if (!summary?.averageScoresByDataset || Object.keys(summary.averageScoresByDataset).length === 0) {
    return null;
  }

  // Transform data: for each dataset, create an object with all systems as properties
  const datasets = Object.keys(summary.averageScoresByDataset);
  const allSystems = new Set<string>();

  // Collect all unique systems across all datasets
  datasets.forEach(dataset => {
    Object.keys(summary.averageScoresByDataset[dataset]).forEach(system => {
      allSystems.add(system);
    });
  });

  const data = datasets.map(dataset => {
    const dataPoint: any = { dataset };
    allSystems.forEach(system => {
      dataPoint[system] = summary.averageScoresByDataset[dataset][system]?.overall || 0;
    });
    return dataPoint;
  });

  // Create chart config dynamically based on systems
  const chartConfig: ChartConfig = {};
  allSystems.forEach(system => {
    chartConfig[system] = {
      label: system,
      color: getModelColor(system),
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overall Scores by Dataset</CardTitle>
        <CardDescription>
          Comparison of model performance across different evaluation datasets
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dataset" />
            <YAxis domain={[0, 10]} />
            <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }} />
            <ChartLegend content={<ChartLegendContent />} />
            {Array.from(allSystems).map(system => (
              <Bar
                key={system}
                dataKey={system}
                fill={getModelColor(system)}
                radius={4}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

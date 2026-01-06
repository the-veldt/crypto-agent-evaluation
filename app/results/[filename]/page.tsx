import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadAgentResult } from '@/lib/results/loadResults';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScoreComparisonChart } from '@/components/results/ScoreComparisonChart';
import { ScoreBreakdownChart } from '@/components/results/ScoreBreakdownChart';
import { PerformanceMetricsChart } from '@/components/results/PerformanceMetricsChart';
import { DatasetComparisonChart } from '@/components/results/DatasetComparisonChart';
import { ChevronLeft } from 'lucide-react';

interface ResultDetailPageProps {
  params: Promise<{
    filename: string;
  }>;
}

export default async function ResultDetailPage({ params }: ResultDetailPageProps) {
  const { filename } = await params;
  const result = await loadAgentResult(decodeURIComponent(filename));

  if (!result) {
    notFound();
  }

  return (
    <div className="container mx-auto p-8">
      <Link
        href="/results"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to Results
      </Link>

      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          Evaluation Results: {result.dataset}
        </h1>
        <div className="flex gap-2 items-center text-muted-foreground">
          <span>{new Date(result.timestamp).toLocaleString()}</span>
          <span>•</span>
          <span>Judge: {result.judgeModel}</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Questions</CardDescription>
            <CardTitle className="text-3xl">{result.summary.totalQuestions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Successful Evaluations</CardDescription>
            <CardTitle className="text-3xl">{result.summary.successfulEvaluations}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Failed Evaluations</CardDescription>
            <CardTitle className="text-3xl">{result.summary.failedEvaluations}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Agent Systems</CardDescription>
            <CardTitle className="text-3xl">{result.config.agentSystems.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Agent Systems */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Tested Systems</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {result.config.agentSystems.map((system) => (
              <Badge key={system} variant="secondary" className="text-sm">
                {system}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="space-y-8">
        <ScoreComparisonChart summary={result.summary} />
        <ScoreBreakdownChart summary={result.summary} />
        <DatasetComparisonChart summary={result.summary} />
        <PerformanceMetricsChart summary={result.summary} />
      </div>

      {/* Detailed Results */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Question-by-Question Results</CardTitle>
          <CardDescription>
            Detailed evaluation results for each question
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {result.results.map((questionResult, idx) => (
              <div key={questionResult.question.qid} className="border-b pb-6 last:border-b-0">
                <div className="mb-3">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">
                      {idx + 1}. {questionResult.question.query}
                    </h3>
                    <Badge variant="outline">{questionResult.question.qid}</Badge>
                  </div>
                  {questionResult.question.categories && (
                    <div className="flex gap-1 flex-wrap">
                      {questionResult.question.categories.map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {questionResult.evaluations.map((evaluation) => (
                    <Card key={evaluation.system}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center justify-between">
                          {evaluation.system}
                          <Badge
                            variant={
                              evaluation.evaluation.overall_score >= 7
                                ? 'default'
                                : evaluation.evaluation.overall_score >= 5
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {evaluation.evaluation.overall_score.toFixed(1)}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Task Completion:</span>
                          <span>{evaluation.evaluation.task_completion_score.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Answer Quality:</span>
                          <span>{evaluation.evaluation.answer_quality_score.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Reasoning:</span>
                          <span>{evaluation.evaluation.reasoning_quality_score.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Efficiency:</span>
                          <span>{evaluation.evaluation.efficiency_score.toFixed(1)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

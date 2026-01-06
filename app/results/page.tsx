import Link from 'next/link';
import { loadAgentResults } from '@/lib/results/loadResults';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function ResultsPage() {
  const results = await loadAgentResults();

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Agent Evaluation Results</h1>
        <p className="text-muted-foreground">
          View and compare evaluation results across different agent systems
        </p>
      </div>

      {results.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Results Found</CardTitle>
            <CardDescription>
              Run an agent evaluation to see results here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Run: <code className="bg-muted px-2 py-1 rounded">npm run eval:agent</code>
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Evaluation Runs</CardTitle>
            <CardDescription>
              {results.length} evaluation run{results.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dataset</TableHead>
                  <TableHead>Judge Model</TableHead>
                  <TableHead>Systems</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => {
                  const successRate = result.summary.totalQuestions > 0
                    ? ((result.summary.successfulEvaluations / (result.summary.totalQuestions * result.config.agentSystems.length)) * 100).toFixed(0)
                    : 0;

                  return (
                    <TableRow key={result.filename}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {result.dataset}
                          {result.filename.includes('-reranked') && (
                            <Badge variant="secondary" className="text-xs">Reranked</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{result.judgeModel}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {result.config.agentSystems.map((system) => (
                            <Badge key={system} variant="secondary">
                              {system}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{result.summary.totalQuestions}</TableCell>
                      <TableCell>{successRate}%</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(result.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/results/${encodeURIComponent(result.filename)}`}
                          className="text-primary hover:underline text-sm"
                        >
                          View Details
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="container mx-auto p-8">
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="max-w-3xl w-full space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-bold tracking-tight">
              Crypto Agent Evaluation
            </h1>
            <p className="text-xl text-muted-foreground">
              Evaluate and compare AI agent performance on crypto-related tasks
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Search Evaluation</CardTitle>
                <CardDescription>
                  Compare search quality across Droyd and Exa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Run evaluations to test search result quality across different providers.
                </p>
                <code className="text-xs bg-muted px-2 py-1 rounded block">
                  npm run eval:search
                </code>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Agent Evaluation</CardTitle>
                <CardDescription>
                  Compare AI agents on task completion
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Test GPT-5, Gemini, and Droyd agents on crypto research tasks.
                </p>
                <code className="text-xs bg-muted px-2 py-1 rounded block">
                  npm run eval:agent
                </code>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle>View Results</CardTitle>
              <CardDescription className="text-primary-foreground/80">
                Visualize and compare evaluation results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/results"
                className="inline-flex items-center justify-center rounded-md bg-background text-foreground px-6 py-3 text-sm font-medium transition-colors hover:bg-background/90"
              >
                View Agent Results Dashboard
              </Link>
            </CardContent>
          </Card>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Learn more in the{" "}
              <a
                href="https://github.com/your-repo/crypto-agent-evaluation"
                className="font-medium underline underline-offset-4 hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                README
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

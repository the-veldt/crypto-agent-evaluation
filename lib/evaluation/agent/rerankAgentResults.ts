import { generateText } from 'ai';
import { Output } from 'ai';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import type {
  AgentEvaluation,
  QuestionEvaluationResult,
  EvaluationRunResult,
} from './types';
import { calculateSummary } from './runAgentEvaluation';

// Schema for a single agent's evaluation
const agentEvaluationSchema = z.object({
  overall_score: z.number(),
  task_completion_score: z.number(),
  task_completion_reasoning: z.string(),
  answer_quality_score: z.number(),
  answer_quality_reasoning: z.string(),
  reasoning_quality_score: z.number(),
  reasoning_quality_reasoning: z.string(),
  efficiency_score: z.number(),
  efficiency_reasoning: z.string(),
  key_strengths: z.array(z.string()),
  key_weaknesses: z.array(z.string()),
  overall_assessment: z.string(),
});

// Schema for all agents' evaluations in one call (array of system + evaluation)
const comparativeEvaluationsSchema = z.object({
  evaluations: z.array(
    z.object({
      system: z.string(),
      evaluation: agentEvaluationSchema,
    })
  ),
});

/**
 * Format comparative context showing all agents side-by-side
 */
function formatComparativeContext(questionResult: QuestionEvaluationResult): string {
  const { question, agentResults, evaluations } = questionResult;

  let context = `## Question\n"${question.query}"\n\n`;
  context += `## Agent Responses (Side-by-Side)\n\n`;

  for (const agentResult of agentResults) {
    if (agentResult.error) continue;

    const system = agentResult.system;
    const finalAnswer = agentResult.finalAnswer || '(No answer provided)';
    const evaluation = evaluations.find((e) => e.system === system)?.evaluation;

    context += `### Agent: ${system}\n\n`;
    context += `**Final Answer:**\n${finalAnswer}\n\n`;

    if (evaluation) {
      context += `**Current Scores:**\n`;
      context += `- Overall: ${evaluation.overall_score}/10\n`;
      context += `- Task Completion: ${evaluation.task_completion_score}/10\n`;
      context += `- Answer Quality: ${evaluation.answer_quality_score}/10\n`;
      context += `- Reasoning Quality: ${evaluation.reasoning_quality_score}/10\n`;
      context += `- Efficiency: ${evaluation.efficiency_score}/10\n\n`;
    }

    context += `---\n\n`;
  }

  return context;
}

/**
 * Comparative evaluation for all agents in a single call
 */
export async function comparativelyEvaluateAllAgents({
  model,
  questionResult,
}: {
  model: LanguageModel;
  questionResult: QuestionEvaluationResult;
}): Promise<Array<{ system: string; evaluation: AgentEvaluation }>> {
  const comparativeContext = formatComparativeContext(questionResult);

  // Get list of systems to evaluate
  const systems = questionResult.agentResults
    .filter(r => !r.error)
    .map(r => r.system);

  const prompt = `You are performing COMPARATIVE evaluation of AI agent responses.

${comparativeContext}

Your task is to evaluate ALL agents by comparing them against each other.

**Instructions:**
1. Review all agent responses side-by-side
2. Compare final answers for accuracy, completeness, and usefulness
3. Consider the current scores as a baseline calibration
4. Adjust scores up or down based on relative performance
5. If an agent clearly outperformed others, increase its scores
6. If an agent underperformed compared to others, decrease its scores
7. Maintain consistency - similar quality should have similar scores
8. Provide evaluations for ALL of the following systems: ${systems.join(', ')}

**Evaluation Criteria:**
- **Task Completion** (0-10): How completely did this agent address the question compared to others?
- **Answer Quality** (0-10): How accurate, clear, and useful is the answer compared to others?
- **Reasoning Quality** (0-10): N/A for final answers only - use original score as baseline
- **Efficiency** (0-10): N/A for final answers only - use original score as baseline
- **Overall** (0-10): Taking all factors into account, how does this agent compare?

Return an array of evaluations with adjusted scores and clear reasoning explaining the comparative analysis.`;

  const { output } = await generateText({
    model,
    output: Output.object({ schema: comparativeEvaluationsSchema }),
    prompt,
  });

  return output.evaluations;
}

/**
 * Rerank all evaluations in a result file
 */
export async function rerankEvaluationResults({
  evaluationResult,
  judgeModel,
}: {
  evaluationResult: EvaluationRunResult;
  judgeModel: LanguageModel;
}): Promise<EvaluationRunResult> {
  console.log(`\nReranking ${evaluationResult.results.length} questions...`);

  const rerankedResults = { ...evaluationResult };

  for (let i = 0; i < evaluationResult.results.length; i++) {
    const questionResult = evaluationResult.results[i];
    const questionNum = i + 1;

    console.log(
      `\nQuestion ${questionNum}/${evaluationResult.results.length}: "${questionResult.question.query}"`
    );

    try {
      console.log(`  Re-evaluating all agents comparatively...`);

      // Single call to evaluate all agents at once
      const allEvaluations = await comparativelyEvaluateAllAgents({
        model: judgeModel,
        questionResult,
      });

      // Convert array to map for easy lookup
      const evaluationMap = new Map(
        allEvaluations.map(item => [item.system, item.evaluation])
      );

      // Map the evaluations back to the array format
      const newEvaluations = questionResult.evaluations.map(evalItem => {
        const newEvaluation = evaluationMap.get(evalItem.system);

        if (newEvaluation) {
          console.log(`    ✓ ${evalItem.system}: ${newEvaluation.overall_score}/10`);
          return {
            ...evalItem,
            evaluation: newEvaluation,
          };
        } else {
          console.error(`    ✗ ${evalItem.system}: Not found in response, keeping original`);
          return evalItem;
        }
      });

      rerankedResults.results[i] = {
        ...questionResult,
        evaluations: newEvaluations,
      };
    } catch (error) {
      console.error(
        `    ✗ Error: ${error instanceof Error ? error.message : 'Unknown'}`
      );
      console.error(`    Keeping original evaluations for this question`);
      rerankedResults.results[i] = questionResult;
    }
  }

  // Recalculate summary statistics with new scores
  rerankedResults.summary = calculateSummary(rerankedResults.results);

  return rerankedResults;
}

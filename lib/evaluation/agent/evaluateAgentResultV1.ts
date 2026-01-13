import { generateText, Output, LanguageModel } from 'ai';
import { z } from 'zod';

const agentEvaluationSchema = z.object({
  overall_score: z.number().describe('Overall quality score from 0-10'),

  task_completion_score: z.number().describe(
    'How completely the agent addressed all aspects of the task (0-10)'
  ),
  task_completion_reasoning: z.string().describe(
    'Explanation of task completion assessment'
  ),

  answer_quality_score: z.number().describe(
    'Quality of the final answer - accuracy, clarity, usefulness (0-10)'
  ),
  answer_quality_reasoning: z.string().describe(
    'Explanation of answer quality assessment'
  ),

  reasoning_quality_score: z.number().describe(
    "Quality of the agent's reasoning process and logic (0-10)"
  ),
  reasoning_quality_reasoning: z.string().describe('Explanation of reasoning quality'),

  efficiency_score: z.number().describe(
    'Efficiency of execution - steps taken vs value delivered (0-10)'
  ),
  efficiency_reasoning: z.string().describe('Explanation of efficiency assessment'),

  key_strengths: z.array(z.string()).describe('Key strengths of the agent response'),

  key_weaknesses: z.array(z.string()).describe('Key weaknesses or areas for improvement'),

  overall_assessment: z.string().describe('Overall summary assessment of the agent performance'),
});

export type AgentEvaluation = z.infer<typeof agentEvaluationSchema>;

export interface EvaluateAgentResultParams {
  model: LanguageModel;
  evalQuestion: string;
  agentTrace: string;
}

export async function evaluateAgentResult({
  model,
  evalQuestion,
  agentTrace,
}: EvaluateAgentResultParams): Promise<AgentEvaluation> {
  const { output } = await generateText({
    model,
    output: Output.object({
      schema: agentEvaluationSchema,
    }),
    prompt: `You are evaluating an AI agent's performance on a given task.

**Current Date:** ${new Date().toISOString()}

**Task:** ${evalQuestion}

**Agent Execution Trace:**
${agentTrace}

---

Evaluate the agent's performance based on:

1. **Task Completion** (0-10): Did the agent fully complete all aspects of the task? Did it address everything the query asked for, or did it miss key elements?

2. **Answer Quality** (0-10): Is the final answer accurate, clear, well-structured, and useful? Does it provide actionable information?

3. **Reasoning Quality** (0-10): Was the agent's thought process logical, coherent, and well-reasoned? Did it make sound decisions about which tools to use and how to interpret results?

4. **Efficiency** (0-10): Did the agent complete the task efficiently without unnecessary steps or redundancy? Was the execution path optimal?

5. **Overall Score** (0-10): Taking all factors into account, how well did the agent perform?

For each score, provide clear reasoning. Identify key strengths and weaknesses, and give an overall assessment.

Be objective and critical. Rating responses in the 3-5 range is perfectly acceptable. A perfect 10 should be rare and reserved for exceptional performance.`,
  });

  return output;
}

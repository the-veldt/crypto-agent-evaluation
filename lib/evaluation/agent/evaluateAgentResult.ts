/**
 * Agent Result Evaluation V2 - Pairwise Comparison
 *
 * Performs blinded pairwise comparisons between agent responses
 * with randomized presentation order to prevent position bias.
 */

import { generateText, Output, LanguageModel } from 'ai';
import { z } from 'zod';
import type { AgentSystemResult, PairwiseComparison } from './types';

/**
 * Zod schema for dimensional comparison
 */
const dimensionalComparisonSchema = z.object({
  winner: z.enum(['response1', 'response2', 'tie']).describe(
    'Which response performed better on this dimension'
  ),
  confidence: z.enum(['high', 'medium', 'low']).describe(
    'Confidence level in this assessment'
  ),
  reasoning: z.string().describe('Brief explanation for this dimensional comparison'),
});

/**
 * Zod schema for complete pairwise comparison
 */
const pairwiseComparisonSchema = z.object({
  overall_winner: z.enum(['response1', 'response2', 'tie']).describe(
    'Overall winner across all dimensions'
  ),
  overall_confidence: z.enum(['high', 'medium', 'low']).describe(
    'Overall confidence in the decision'
  ),

  task_completion: dimensionalComparisonSchema.describe(
    'How completely each response addressed the task'
  ),
  answer_quality: dimensionalComparisonSchema.describe(
    'Accuracy, clarity, and usefulness of the answers'
  ),
  reasoning_quality: dimensionalComparisonSchema.describe(
    'Quality of logical reasoning and decision-making'
  ),
  efficiency: dimensionalComparisonSchema.describe(
    'Efficiency of execution without unnecessary steps'
  ),

  overall_reasoning: z.string().describe(
    'Comprehensive explanation for the overall decision'
  ),
  key_differentiators: z.array(z.string()).describe(
    'Key factors that distinguished the better response (2-4 items)'
  ),
});

/**
 * Zod schema for simplified pairwise comparison (output-only evaluation)
 */
const simplePairwiseComparisonSchema = z.object({
  overall_winner: z.enum(['response1', 'response2', 'tie']).describe(
    'Which response provided superior overall quality'
  ),
  overall_confidence: z.enum(['high', 'medium', 'low']).describe(
    'Confidence in the assessment'
  ),
  overall_reasoning: z.string().describe(
    'Comprehensive explanation for the decision (3-4 sentences)'
  ),
  key_differentiators: z.array(z.string()).describe(
    'Key factors that distinguished the better response (2-4 specific points)'
  ),
});

/**
 * Parameters for pairwise comparison
 */
export interface PairwiseCompareParams {
  model: LanguageModel;
  question: string;
  systemAResult: AgentSystemResult;
  systemBResult: AgentSystemResult;
  systemAName: string;
  systemBName: string;
}

/**
 * Format agent result for blinded comparison
 * Omits system name and presents information in standardized format
 */
function formatResponseForComparison(result: AgentSystemResult): string {
  if (result.error) {
    return `**ERROR:** ${result.error}\n\nThis response failed to execute successfully.`;
  }

  const sections: string[] = [];

  // Final answer (most important for comparison)
  sections.push(`## Final Answer\n`);
  sections.push(result.finalAnswer || '(No answer provided)\n');

  // Process summary
  sections.push(`\n## Process Summary`);
  sections.push(`- Steps taken: ${result.stepCount}`);
  sections.push(`- Execution time: ${(result.executionTimeMs / 1000).toFixed(1)}s`);

  if (result.toolCalls.length > 0) {
    const uniqueTools = [...new Set(result.toolCalls.map((tc) => tc.toolName))];
    sections.push(`- Tools used: ${uniqueTools.join(', ')}`);
  } else {
    sections.push(`- Tools used: none`);
  }

  // Key steps (first 3 steps for process visibility)
  if (result.steps.length > 0) {
    sections.push(`\n## Key Steps`);

    const stepsToShow = result.steps.slice(0, 3);
    stepsToShow.forEach((step) => {
      const stepText = step.text || '(tool calls only)';
      const truncated = stepText.length > 200 ? stepText.substring(0, 200) + '...' : stepText;
      sections.push(`\n**Step ${step.stepNumber}:** ${truncated}`);

      if (step.toolCalls && step.toolCalls.length > 0) {
        const toolNames = step.toolCalls.map((tc) => tc.toolName).join(', ');
        sections.push(`*Tools: ${toolNames}*`);
      }
    });

    if (result.steps.length > 3) {
      sections.push(`\n... and ${result.steps.length - 3} more steps`);
    }
  }

  return sections.join('\n');
}

/**
 * Perform blinded pairwise comparison between two agent results
 *
 * Randomizes presentation order (Response 1 vs Response 2) to prevent position bias.
 * Returns comparison with winner mapped back to original systems (A vs B).
 *
 * @param params - Comparison parameters
 * @returns Pairwise comparison result
 */
export async function pairwiseCompare({
  model,
  question,
  systemAResult,
  systemBResult,
  systemAName,
  systemBName,
}: PairwiseCompareParams): Promise<PairwiseComparison> {
  // Randomize which system is shown as Response 1 vs Response 2
  const showAFirst = Math.random() < 0.5;
  const response1System: 'A' | 'B' = showAFirst ? 'A' : 'B';
  const response1Result = showAFirst ? systemAResult : systemBResult;
  const response2Result = showAFirst ? systemBResult : systemAResult;

  // Format both responses for blinded comparison
  const response1Text = formatResponseForComparison(response1Result);
  const response2Text = formatResponseForComparison(response2Result);

  const prompt = `You are an expert evaluator assessing AI agent performance - the agent is intended to be a crypto research assistant for industry professionals.

**Current Date:** ${new Date().toISOString()}

**Task:** ${question}

---

**Response 1:**
${response1Text}

---

**Response 2:**
${response2Text}

---

## Evaluation Framework

Compare these two agent responses across four critical dimensions:

### 1. Task Completion (0-10)
Assess how thoroughly each response addressed the complete scope of the task:
- **Completeness**: Did the agent address all aspects of the query, or were key components overlooked?
- **Scope appropriateness**: Was the depth and breadth of the response suitable for the question asked?
- **Requirement fulfillment**: Were explicit and implicit requirements satisfied?

### 2. Answer Quality (0-10)
Evaluate the substantive quality of the response based on professional standards:
- **Analytical rigor**: Depth of analysis, quality of insights, logical soundness of conclusions
- **Detail and specificity**: Concrete examples, data points, sources, and supporting evidence (not just volume of results)
- **Information quality**: Relevance, accuracy, and actionability of provided information
- **Professional value**: Would this response be useful to an industry professional making decisions?

**Critical**: Do NOT assume more results equals better quality. Evaluate based on analytical depth, reasoning quality, use of evidence, and professional utility. A response with 5 well-analyzed, sourced findings with clear reasoning is superior to 10 superficial results.

### 3. Reasoning Quality (0-10)
Assess the agent's cognitive process and decision-making:
- **Logical coherence**: Clear, sound reasoning throughout the execution
- **Strategic approach**: Appropriate selection and sequencing of tools/methods
- **Problem-solving**: How well did the agent navigate challenges and iterate toward the goal?
- **Methodological soundness**: Was the research/analysis approach professionally rigorous?

### 4. Efficiency (0-10)
Evaluate resource utilization and operational efficiency:
- **Cost-effectiveness**: Token usage and API calls relative to value delivered
- **Tool economy**: Minimal tool invocations needed to achieve quality results
- **Execution economy**: Avoided redundant steps, unnecessary iterations, or wasteful operations
- **Value per resource**: Quality achieved per unit of compute/cost expended

**Note**: Efficiency only matters if the task was successfully completed. A fast but incomplete response scores low. Evaluate whether the agent achieved maximum value with minimal resource expenditure.

---

## Output Requirements

For each dimension:
- **Winner**: response1, response2, or tie
- **Confidence**:
  - high = clear, significant difference in quality/performance
  - medium = noticeable but not overwhelming difference
  - low = very similar, marginal differences only
- **Reasoning**: 1-2 sentences explaining the assessment

Then provide:
- **Overall winner**: Synthesize across all dimensions (a response can win overall without winning every dimension)
- **Overall confidence**: Your confidence in the holistic assessment
- **Key differentiators**: 2-4 specific, concrete factors that distinguished the superior response
- **Overall reasoning**: 2-3 sentences summarizing the comparative evaluation

## Evaluation Principles

- **Professional objectivity**: Evaluate as an industry expert, not a general user
- **Substance over superficiality**: Depth of analysis beats breadth of results
- **Quality over quantity**: Well-reasoned insights with evidence > long lists without context
- **Ties are valid**: If responses are genuinely equivalent in quality, assign a tie
- **Holistic assessment**: Consider the complete response—answer AND process AND efficiency
- **Evidence-based**: Base judgments on observable differences in the responses provided`;

  const { output } = await generateText({
    model,
    output: Output.object({ schema: pairwiseComparisonSchema }),
    prompt,
  });

  // Map response1/response2 back to A/B based on randomization
  const mapWinner = (winner: 'response1' | 'response2' | 'tie'): 'A' | 'B' | 'tie' => {
    if (winner === 'tie') return 'tie';
    if (winner === 'response1') return response1System;
    return response1System === 'A' ? 'B' : 'A';
  };

  const comparison: PairwiseComparison = {
    questionId: '', // Will be set by caller
    systemA: systemAName,
    systemB: systemBName,
    winner: mapWinner(output.overall_winner),
    confidence: output.overall_confidence,
    response1System,
    dimensions: {
      taskCompletion: {
        winner: mapWinner(output.task_completion.winner),
        confidence: output.task_completion.confidence,
        reasoning: output.task_completion.reasoning,
      },
      answerQuality: {
        winner: mapWinner(output.answer_quality.winner),
        confidence: output.answer_quality.confidence,
        reasoning: output.answer_quality.reasoning,
      },
      reasoningQuality: {
        winner: mapWinner(output.reasoning_quality.winner),
        confidence: output.reasoning_quality.confidence,
        reasoning: output.reasoning_quality.reasoning,
      },
      efficiency: {
        winner: mapWinner(output.efficiency.winner),
        confidence: output.efficiency.confidence,
        reasoning: output.efficiency.reasoning,
      },
    },
    reasoning: output.overall_reasoning,
    keyDifferentiators: output.key_differentiators,
    timestamp: new Date().toISOString(),
  };

  return comparison;
}

/**
 * Format agent result for simplified output-only comparison
 * Only shows the final answer without process details
 */
function formatResponseForSimpleComparison(result: AgentSystemResult): string {
  if (result.error) {
    return `**ERROR:** ${result.error}\n\nThis response failed to execute successfully.`;
  }

  return result.finalAnswer || '(No answer provided)';
}

/**
 * Perform simplified blinded pairwise comparison (output-only)
 *
 * This version evaluates only the final output quality without considering
 * process, reasoning, or efficiency. Ideal for comparing agents where you
 * only have access to their final responses or when process doesn't matter.
 *
 * @param params - Comparison parameters
 * @returns Simplified pairwise comparison result (no dimensional breakdowns)
 */
export async function pairwiseCompareSimple({
  model,
  question,
  systemAResult,
  systemBResult,
  systemAName,
  systemBName,
}: PairwiseCompareParams): Promise<PairwiseComparison> {
  // Randomize which system is shown as Response 1 vs Response 2
  const showAFirst = Math.random() < 0.5;
  const response1System: 'A' | 'B' = showAFirst ? 'A' : 'B';
  const response1Result = showAFirst ? systemAResult : systemBResult;
  const response2Result = showAFirst ? systemBResult : systemAResult;

  // Format both responses (output only)
  const response1Text = formatResponseForSimpleComparison(response1Result);
  const response2Text = formatResponseForSimpleComparison(response2Result);

  const prompt = `You are an expert evaluator assessing AI agent response quality for crypto industry professionals.

**Current Date:** ${new Date().toISOString()}

**Task:** ${question}

---

**Response 1:**
${response1Text}

---

**Response 2:**
${response2Text}

---

## Evaluation Instructions

Compare these two responses based on **overall quality**. 

### Quality Assessment Criteria:

1. **Completeness & Relevance**
   - Does the response fully address the question asked?
   - Are all key aspects covered, or are critical elements missing?
   - Is the scope appropriate for the question?

2. **Analytical Depth & Rigor**
   - Quality and depth of analysis provided
   - Logical soundness of conclusions and insights
   - Use of concrete examples, data points, and evidence
   - Professional-grade reasoning and argumentation

3. **Information Quality**
   - Accuracy and reliability of information provided
   - Specificity and depth of findings
   - Proper use of sources and supporting evidence and details
   - Balance between breadth and depth

4. **Professional Value**
   - Would this response be useful to an industry professional?
   - Does it provide insights, details, and evidence or just surface-level information?
   - Is it appropriately detailed for decision-making?

## Critical Principles:

- **Quality over quantity**: A response with 5 well-analyzed findings with clear reasoning and evidence is superior to 10 superficial results (unless the task is find a specific number of results or only requests high-level information on a lot of items)
- **Substance over style**: Evaluate based on content quality and to a lesser extent, presentation length or formatting
- **Professional standards**: Assess as an industry expert who values depth, detail, and evidence
- **No process penalties**: You cannot see how the response was generated, so don't penalize based on assumptions about efficiency or tool use

## Output Requirements:

Provide:
- **Winner**: response1, response2, or tie
- **Confidence**:
  - high = clear, significant difference in quality
  - medium = noticeable difference but not overwhelming
  - low = very similar quality, marginal differences
- **Overall reasoning**: 3-4 sentences explaining your assessment, focusing on the key quality differences observed
- **Key differentiators**: 2-4 specific, concrete factors that distinguished the superior response (be specific with examples from the responses)

**Note on ties**: If both responses are genuinely equivalent in quality and completeness, assign a tie. Don't force a winner when quality is truly comparable.`;

  const { output } = await generateText({
    model,
    output: Output.object({ schema: simplePairwiseComparisonSchema }),
    prompt,
  });

  // Map response1/response2 back to A/B based on randomization
  const mapWinner = (winner: 'response1' | 'response2' | 'tie'): 'A' | 'B' | 'tie' => {
    if (winner === 'tie') return 'tie';
    if (winner === 'response1') return response1System;
    return response1System === 'A' ? 'B' : 'A';
  };

  // Return simplified comparison without dimensions
  return {
    questionId: '', // Will be set by caller
    systemA: systemAName,
    systemB: systemBName,
    winner: mapWinner(output.overall_winner),
    confidence: output.overall_confidence,
    response1System,
    reasoning: output.overall_reasoning,
    keyDifferentiators: output.key_differentiators,
    timestamp: new Date().toISOString(),
  };
}

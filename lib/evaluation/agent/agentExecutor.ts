/**
 * Agent Executors
 *
 * Wrappers for executing different agent systems and capturing results
 */

import { createAgent } from '../../agents/agentFactory/agentFactory';
import { droydTask } from '../../utils/droydTask';
import type {
  AgentSystemResult,
  AgentStep,
  ToolCall,
  AgentEvaluationConfig,
} from './types';
import { loadCachedResponse, validateCacheVersion, isCacheEnabled, getCacheDir } from './cacheLoader';

/**
 * Execute a standard model agent (GPT-5, Gemini, etc) using agentFactory
 */
export async function executeStandardAgent(
  query: string,
  modelName: 'gpt-5' | 'gpt-5-mini' | 'claude-4.5-sonnet' | 'gemini-3-flash' | 'gemini-3-pro',
  config: AgentEvaluationConfig
): Promise<AgentSystemResult> {
  const startTime = Date.now();

  try {
    console.log(`[executeStandardAgent] Starting ${modelName} agent for query: "${query}"`);

    const standardConfig = config.standardAgentConfig || {
      tools: ['webSearch'],
      maxSteps: 10,
      instructions:`Role: crypto research assistant

        Tools: 'webSearch'

        Utilize web search capabilities to find accurate, current information about crypto projects, trends, and markets.

        Your objective is to be a user's crypto research assistant.
        `
    };

    // Create agent using agentFactory
    const { generate } = await createAgent({
      tools: standardConfig.tools,
      instructions: standardConfig.instructions || '',
      model: modelName,
      maxSteps: standardConfig.maxSteps || 10,
    });

    // Execute agent
    const result = await generate(query);

    const executionTimeMs = Date.now() - startTime;

    // Extract steps from result
    const steps: AgentStep[] = (result.steps || []).map((step: any, index: number) => ({
      stepNumber: index + 1,
      text: step.text,
      toolCalls: step.toolCalls?.map((tc: any) => ({
        toolName: tc.toolName,
        parameters: tc.args,
        result: tc.result,
      })),
      finishReason: step.finishReason,
      usage: step.usage
        ? {
            promptTokens: step.usage.promptTokens,
            completionTokens: step.usage.completionTokens,
            totalTokens: step.usage.totalTokens,
          }
        : undefined,
    }));

    // Extract all tool calls
    const toolCalls: ToolCall[] = [];
    for (const step of result.steps || []) {
      if (step.toolCalls) {
        for (const tc of step.toolCalls) {
          toolCalls.push({
            toolName: tc.toolName,
            parameters: tc?.input,
            //result: tc?.result,
          });
        }
      }
    }

    // Extract final answer (last text output)
    const finalAnswer = result.text || '';

    // Calculate total tokens
    const totalTokens = result.totalUsage?.totalTokens || 0;

    const agentResult: AgentSystemResult = {
      system: modelName,
      steps,
      finalAnswer,
      executionTimeMs,
      totalTokens,
      stepCount: steps.length,
      rawResponse: result,
      toolCalls,
    };

    console.log(
      `[executeStandardAgent] ${modelName} completed in ${executionTimeMs}ms with ${steps.length} steps`
    );

    return agentResult;
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;

    console.error(`[executeStandardAgent] ${modelName} failed:`, error);

    return {
      system: modelName,
      steps: [],
      finalAnswer: '',
      executionTimeMs,
      stepCount: 0,
      rawResponse: null,
      toolCalls: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute Droyd agent using droydTask API
 */
export async function executeDroydAgent(
  query: string,
  system: 'droyd' | 'droyd-casual' | 'droyd-pro',
  config: AgentEvaluationConfig
): Promise<AgentSystemResult> {
  const startTime = Date.now();

  try {
    console.log(`[executeDroydAgent] Starting ${system} agent for query: "${query}"`);

    const droydConfig = config.droydAgentConfig || {
      agentType: 'agent',
    };

    // Determine which user ID to use based on system tier
    let userId: string | undefined;
    if (system === 'droyd-casual') {
      userId = process.env.DROYD_CASUAL_USER;
      if (!userId) {
        throw new Error('DROYD_CASUAL_USER environment variable is not set');
      }
    } else if (system === 'droyd-pro') {
      userId = process.env.DROYD_PRO_USER;
      if (!userId) {
        throw new Error('DROYD_PRO_USER environment variable is not set');
      }
    }
    // For 'droyd', userId remains undefined and will use DROYD_USER_ID from env

    // Execute Droyd task
    const result = await droydTask({
      taskInstructions: query,
      agentType: droydConfig.agentType || 'agent',
      userId,
    });

    const executionTimeMs = Date.now() - startTime;

    console.log(`[executeDroydAgent] Droyd task result:`, result);

    // Extract final answer based on response type
    let finalAnswer = '';

    if ('_output' in result.data) {
      // Output response (agent/chat/data)
      finalAnswer = result.data._output as string;
    } else if ('text' in result.data) {
      // Text response (agent/chat/data)
      finalAnswer = result.data.text;
    } else if ('result_summary' in result.data) {
      // Structured response (research/trading)
      finalAnswer = `**${result.data.task_title}**\n\n${result.data.result_summary.join('\n')}`;
    }

    // Process steps if available
    let steps: AgentStep[] = [];
    let toolCalls: ToolCall[] = [];

    if ('steps' in result.data && Array.isArray(result.data.steps)) {
      // Filter and format steps
      steps = result.data.steps.map((step: any, index: number) => {
        // Filter out tool-result content to reduce token usage
        const filteredContent = Array.isArray(step.content)
          ? step.content.filter((content: any) => content.type !== 'tool-result')
          : step.content;

        return {
          stepNumber: index + 1,
          text: JSON.stringify(filteredContent, null, 2),
          finishReason: step.finishReason,
        };
      });

      // Extract tool calls from steps
      for (const step of result.data.steps) {
        if (Array.isArray(step.content)) {
          const stepToolCalls = step.content
            .filter((content: any) => content.type === 'tool-call')
            .map((tc: any) => ({
              toolName: tc.toolName,
              parameters: tc.input,
            }));
          toolCalls.push(...stepToolCalls);
        }
      }

      console.log(`[executeDroydAgent] Processed ${steps.length} steps with ${toolCalls.length} tool calls (filtered tool-result content)`);
    } else {
      // Fallback: Create a single step for Droyd (opaque execution)
      steps = [
        {
          stepNumber: 1,
          text: finalAnswer,
          finishReason: 'text' in result.data ? result.data.finishReason : 'stop',
        },
      ];
    }

    const agentResult: AgentSystemResult = {
      system,
      steps,
      finalAnswer,
      executionTimeMs,
      stepCount: steps.length,
      rawResponse: result,
      toolCalls,
      totalTokens: result.data?.totalUsage?.totalTokens ?? 0,
    };

    console.log(`[executeDroydAgent] ${system} completed in ${executionTimeMs}ms`);

    return agentResult;
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;

    console.error(`[executeDroydAgent] ${system} failed:`, error);

    return {
      system,
      steps: [],
      finalAnswer: '',
      executionTimeMs,
      stepCount: 0,
      rawResponse: null,
      toolCalls: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute agent based on system type, with optional cache support
 */
export async function executeAgent(
  query: string,
  system: 'gpt-5' | 'gpt-5-mini' | 'claude-4.5-sonnet' | 'gemini-3-flash' | 'gemini-3-pro' | 'droyd' | 'droyd-casual' | 'droyd-pro' | 'surf-quick' | 'elfa-fast' | 'elfa-expert' | 'messari-assistant',
  config: AgentEvaluationConfig,
  qid?: string // Optional question ID for cache lookup
): Promise<AgentSystemResult> {
  // Check cache first if enabled
  if (isCacheEnabled(config) && qid) {
    const cacheDir = getCacheDir(config);
    const cached = await loadCachedResponse(system, qid, cacheDir);

    if (cached) {
      // Validate version compatibility (v2 for AgentEvaluationConfigV2)
      const expectedVersion = 'rankingMethod' in config ? 'v2' : 'v1';

      if (validateCacheVersion(cached, expectedVersion)) {
        console.log(`  [Cache HIT] ${system} (qid: ${qid})`);

        // Return cached agentResult with cache flag
        return {
          ...cached.agentResult,
          _fromCache: true,
        } as AgentSystemResult;
      }
    }
  }

  // Cache miss or disabled - execute normally
  // Third-party systems (surf-quick, elfa-fast, elfa-expert, messari-assistant) can only be used with cache
  if (system === 'surf-quick' || system === 'elfa-fast' || system === 'elfa-expert' || system === 'messari-assistant') {
    const errorMsg = `${system} is a third-party system and can only be used with --use-cache. No cached response found for qid: ${qid}`;
    console.error(`  ✗ ${errorMsg}`);
    return {
      system,
      steps: [],
      finalAnswer: '',
      executionTimeMs: 0,
      stepCount: 0,
      rawResponse: null,
      toolCalls: [],
      error: errorMsg,
    };
  }

  if (system === 'droyd' || system === 'droyd-casual' || system === 'droyd-pro') {
    return executeDroydAgent(query, system, config);
  } else {
    return executeStandardAgent(query, system, config);
  }
}

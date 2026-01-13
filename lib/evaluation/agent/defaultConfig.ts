import type { AgentEvaluationConfig, AgentEvaluationConfigV2 } from './types';

/**
 * Default configuration for agent evaluations (V1)
 */
export const defaultAgentEvaluationConfig: AgentEvaluationConfig = {
  agentSystems: ['gpt-5-mini', 'gemini-3-flash', 'droyd'], // gpt-5, gemini-3-flash, droyd
  datasets: 'all', // Load all dataset files from datasets/agent/
  judgeModel: 'gemini-3-flash', // prefered: claude-4.5-sonnet | cheap: gemini-3-flash
  outputDir: 'datasets/_results/agent',
  standardAgentConfig: {
    tools: ['webSearch'],
    maxSteps: 10,
    instructions:`Role: crypto research assistant

        Tools: 'webSearch'

        Utilize web search capabilities to find accurate, current information about crypto projects, trends, and markets.

        Your objective is to be a user's crypto research assistant. Answer the user's question as best as you can
        `
    },
  droydAgentConfig: {
    agentType: 'agent',
  },
};

/**
 * Default configuration for agent evaluations (V2)
 */
export const defaultAgentEvaluationConfigV2: AgentEvaluationConfigV2 = {
  agentSystems: ['gpt-5-mini', 'gemini-3-flash', 'droyd'], 
  datasets: 'all',
  judgeModel: 'claude-4.5-sonnet', // preferred: claude-4.5-sonnet | cheap: gemini-3-flash
  outputDir: 'datasets/_results/agent',
  rankingMethod: 'elo', // Default to ELO ranking
  keepRawResponse: false, // Strip by default for smaller files
  standardAgentConfig: {
    tools: ['webSearch'],
    maxSteps: 10,
    instructions:`Role: crypto research assistant

        Tools: 'webSearch'

        Utilize web search capabilities to find accurate, current information about crypto projects, trends, and markets.

        Your objective is to be a user's crypto research assistant. Answer the user's question as best as you can
        `
    },
  droydAgentConfig: {
    agentType: 'agent',
  },
};

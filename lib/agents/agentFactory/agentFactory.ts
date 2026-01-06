/**
 * Crypto Agent Factory
 *
 * Creates ToolLoopAgent instances with runtime configuration and lifecycle hooks.
 */

import { LanguageModel, ModelMessage, StepResult, ToolLoopAgent, StopCondition, stepCountIs } from 'ai';
import { z } from 'zod';
import { modelMap } from './models';

// ============================================================================
// Types
// ============================================================================

export interface CreateAgentOptions {
    tools: string[]; // Tool names - will use lookup to load actual tool objects
    instructions: string; // System instructions for the agent
    model: keyof typeof modelMap; // Model name from model cards
    maxSteps?: number; // Optional maximum steps (defaults to 10)
}

// Call options schema for runtime configuration
const agentCallOptionsSchema = z.object({
    evaluationId: z.string().optional(),
    output: z.any().optional(), // Optional output schema for structured output per call
});

type AgentCallOptions = z.infer<typeof agentCallOptionsSchema>;

// ============================================================================
// Helpers
// ============================================================================

// Available tools mapping
import { webSearchTool } from './tools/webSearch';
import { droydSearchTool } from './tools/droydSearch';
import { droydTaskTool } from './tools/droydTask';

const AVAILABLE_TOOLS: Record<string, any> = {
    webSearch: webSearchTool,
    droydSearch: droydSearchTool,
    droydTask: droydTaskTool,
};

/**
 * Loads tools based on tool names
 */
function loadTools(toolNames: string[]): Record<string, any> {
    const tools: Record<string, any> = {};

    for (const toolName of toolNames) {
        const tool = AVAILABLE_TOOLS[toolName];

        if (!tool) {
            console.warn(`[loadTools] Tool "${toolName}" not found. Available tools: ${Object.keys(AVAILABLE_TOOLS).join(', ')}`);
            continue;
        }

        console.log(`[loadTools] Loading tool: ${toolName}`);
        tools[toolName] = tool;
    }

    return tools;
}

// ============================================================================
// Agent Factory
// ============================================================================

/**
 * Creates an agent with the specified configuration
 */
export async function createAgent(options: CreateAgentOptions) {
    const { tools: toolNames, instructions, model: modelName, maxSteps = 10 } = options;

    console.log(`[${modelName}][createAgent] Creating agent with options:`, options);

    // Get the model configuration
    const modelConfig = modelMap[modelName];
    if (!modelConfig) {
        throw new Error(`Model ${modelName} not found in modelMap`);
    }

    const toolLoopAgent = new ToolLoopAgent({
        model: modelConfig.model,

        // Define the call options schema for type-safe runtime configuration
        callOptionsSchema: agentCallOptionsSchema,

        /**
         * Prepare call to inject runtime context into tools and build instructions
         */
        prepareCall: async (callParams) => {
            const options = (callParams.options ?? {}) as AgentCallOptions;

            console.log(`[${modelName}][prepareCall] Preparing call with options:`, options);

            // ================================================================
            // Tools
            // ================================================================
            const tools = loadTools(toolNames);

            // ================================================================
            // Stop Conditions
            // ================================================================
            const stopWhen: StopCondition<any>[] = [
                stepCountIs(maxSteps), // Maximum steps
            ];

            // Add custom stop conditions here as needed

            return {
                ...callParams,
                tools,
                instructions,
                stopWhen,
            };
        },

        /**
         * Prepare step to handle context management and tool activation
         */
        prepareStep: async ({ model, stepNumber, steps, messages }: {
            model: LanguageModel;
            stepNumber: number;
            steps: StepResult<{}>[];
            messages: ModelMessage[]
        }) => {
            console.log(`[${modelName}][prepareStep] Step:`, stepNumber);

            // ================================================================
            // Active Tools
            // ================================================================
            // Determine which tools should be active for this step
            // Note: activeTools should be undefined to enable all tools, or an array of tool names to enable specific ones
            // For now, we'll enable all tools by not setting activeTools
            // Add logic here to selectively activate tools based on step number or context

            // ================================================================
            // Context Management
            // ================================================================
            // Add message compaction or context management logic here
            // For example: limit message history, compact old messages, etc.

            return {
                model,
                stepNumber,
                steps,
                messages,
            };
        },

        /**
         * Called after each step (LLM call or tool execution) completes
         */
        onStepFinish: async (stepResult) => {
            /*console.log('[onStepFinish] Step completed:', {
                text: stepResult.text?.substring(0, 100),
                toolCallsCount: stepResult.toolCalls?.length ?? 0,
                finishReason: stepResult.finishReason,
                usage: stepResult.usage,
            });
            */

            // Add logic here to:
            // - Log tool results
            // - Handle errors
            // - Track metrics
            // - etc.
        },

        /**
         * Called when all agent steps are finished and response is complete
         */
        onFinish: async (event) => {
            console.log(`[${modelName}][onFinish] Agent execution finished:`, {
                totalSteps: event.steps?.length ?? 0,
                //finalText: event.text?.substring(0, 100) || '',
                finishReason: event.finishReason,
                totalUsage: event.totalUsage?.totalTokens ?? 0,
            });

            // Add logic here to:
            // - Send notifications
            // - Save results
            // - Trigger post-processing
            // - etc.
        },
    });

    return {
        agent: toolLoopAgent,

        // Helper to generate with pre-filled options
        async generate(prompt: string, callOptions?: AgentCallOptions) {
            return toolLoopAgent.generate({
                prompt,
                options: callOptions as any,
            });
        },

        // Helper to stream with pre-filled options
        stream(prompt: string, callOptions?: AgentCallOptions) {
            return toolLoopAgent.stream({
                prompt,
                options: callOptions as any,
            });
        },
    };
}

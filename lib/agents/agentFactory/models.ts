import { openai } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';

// Create Google provider with safety settings
const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export const modelMap = {
    // openai models 
    'gpt-5-nano': {
        model_name: 'gpt-5-nano',
        model: openai('gpt-5-nano'),
        token_limit: 400000,
        display_name: 'gpt-5-nano',
        provider: 'openai',
        is_thinking: true,
        image_support: true,
    },
    'gpt-5-mini': {
        model_name: 'gpt-5-mini',
        model: openai('gpt-5-mini'),
        token_limit: 400000,
        display_name: 'gpt-5-mini',
        provider: 'openai',
        is_thinking: true,
        image_support: true,
    },
    'gpt-5': {
        model_name: 'gpt-5',
        model: openai('gpt-5'),
        token_limit: 400000,
        display_name: 'gpt-5',
        provider: 'openai',
        is_thinking: true,
        image_support: true,
    },


    // anthropic models 
    'claude-4.5-sonnet': {
        model_name: 'claude-4.5-sonnet',
        model: anthropic('claude-sonnet-4-5-20250929'),
        token_limit: 200000,
        display_name: 'Claude 4.5 Sonnet',
        provider: 'anthropic',
        is_thinking: true,
        image_support: true,
    },
    'claude-4.5-opus': {
        model_name: 'claude-4.5-opus',
        model: anthropic('claude-opus-4-5-20251101'),
        token_limit: 200000,
        display_name: 'Claude 4.5 Opus',
        provider: 'anthropic',
        is_thinking: true,
        image_support: true,
    },

    // google models
    'gemini-2.0-flash': {
        model_name: 'gemini-2.0-flash',
        model: google('gemini-2.0-flash'),
        token_limit: 1000000,
        display_name: 'Gemini 2.0 Flash',
        provider: 'google',
        is_thinking: false,
        image_support: true,
    },
    'gemini-2.5-flash-lite': {
        model_name: 'gemini-2.5-flash-lite',
        model: google('gemini-2.5-flash-lite'),
        token_limit: 1000000,
        display_name: 'Gemini Flash Lite',
        provider: 'google',
        is_thinking: true,
        image_support: true,
    },
    'gemini-2.5-flash': {
        model_name: 'gemini-2.5-flash',
        model: google('gemini-2.5-flash'),
        token_limit: 1000000,
        display_name: 'Gemini Flash',
        provider: 'google',
        is_thinking: true,
        image_support: true,
    },
    'gemini-2.5-pro': {
        model_name: 'gemini-2.5-pro',
        model: google('gemini-2.5-pro'),
        token_limit: 1000000,
        display_name: 'Gemini Pro',
        provider: 'google',
        is_thinking: true,
        image_support: true,
    },
    'gemini-3-flash': {
        model_name: 'gemini-3-flash',
        model: google('gemini-3-flash-preview'),
        token_limit: 1000000,
        display_name: 'Gemini 3 Flash',
        provider: 'google',
        is_thinking: true,
        image_support: true,
    },
    'gemini-3-pro': {
        model_name: 'gemini-3-pro',
        model: google('gemini-3-pro-preview'),
        token_limit: 1000000,
        display_name: 'Gemini Pro',
        provider: 'google',
        is_thinking: true,
        image_support: true,
    },
}
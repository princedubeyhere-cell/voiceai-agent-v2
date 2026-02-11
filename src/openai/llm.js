/**
 * OpenAI LLM Module (GPT-4o)
 * Handles chat completions with persona + conversation history.
 * Wrapped with timeout + retry for reliability.
 */

const OpenAI = require('openai');
const config = require('../config');
const { withTimeout } = require('../utils/timeoutPromise');
const { withRetry } = require('../utils/rateLimiter');

const openai = new OpenAI({ apiKey: config.openai.apiKey });
const TIMEOUT = config.openai.apiTimeout || 8000;

/**
 * Generate a chat completion response.
 * @param {string} systemPrompt - Full master prompt (persona + FAQs + script + rules)
 * @param {Array<{role: string, content: string}>} conversationHistory - Prior turns
 * @param {string} userMessage - Latest user message
 * @returns {Promise<string>} - Agent's reply text
 */
async function generateReply(systemPrompt, conversationHistory, userMessage) {
    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage },
    ];

    const result = await withRetry(async () => {
        return withTimeout(
            openai.chat.completions.create({
                model: config.openai.llmModel || 'gpt-4o',
                messages,
                temperature: 0.7,
                max_tokens: 300,
                top_p: 0.95,
            }),
            TIMEOUT,
            'llm-completion'
        );
    }, 'llm-completion');

    const reply = result.choices[0]?.message?.content?.trim() || '';
    console.log(`[LLM] Reply: "${reply.substring(0, 80)}..."`);
    return reply;
}

/**
 * Generate a call summary from full conversation.
 * @param {string} clientIndustry
 * @param {Array<{role: string, content: string}>} conversationHistory
 * @returns {Promise<Object>} - { qualification, budget, requirement, sentiment, nextAction, summary }
 */
async function generateSummary(clientIndustry, conversationHistory) {
    const summaryPrompt = `You are an AI call analyst for the ${clientIndustry} industry.
You MUST respond with a valid JSON object only. No explanations, no markdown.

Analyze the conversation and return exactly this JSON structure:
{
  "qualification": "qualified" or "not_qualified" or "needs_followup",
  "budget": "the budget discussed or not_discussed",
  "requirement": "one-line summary of what the lead needs",
  "sentiment": "positive" or "neutral" or "negative",
  "nextAction": "recommended next step",
  "summary": "2-3 sentence summary of the call"
}`;

    const messages = [
        { role: 'system', content: summaryPrompt },
        ...conversationHistory,
    ];

    const result = await withRetry(async () => {
        return withTimeout(
            openai.chat.completions.create({
                model: config.openai.llmModel || 'gpt-4o',
                messages,
                temperature: 0.3,
                max_tokens: 400,
                response_format: { type: 'json_object' },
            }),
            TIMEOUT * 2,
            'llm-summary'
        );
    }, 'llm-summary');

    const raw = result.choices[0]?.message?.content?.trim() || '{}';

    try {
        // Strip markdown code fences if present
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
    } catch {
        console.error('[LLM] Failed to parse summary JSON:', raw);
        return {
            qualification: 'needs_followup',
            budget: 'not_discussed',
            requirement: 'Unable to parse',
            sentiment: 'neutral',
            nextAction: 'Manual review needed',
            summary: raw,
        };
    }
}

module.exports = { generateReply, generateSummary };

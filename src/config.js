/**
 * Centralized Config — Environment Variables Only
 * No config.json dependency. All secrets come from process.env.
 */

const config = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        sttModel: process.env.STT_MODEL || 'whisper-1',
        llmModel: process.env.LLM_MODEL || 'gpt-4o',
        ttsModel: process.env.TTS_MODEL || 'tts-1',
        defaultVoice: process.env.DEFAULT_VOICE || 'nova',
        apiTimeout: parseInt(process.env.API_TIMEOUT) || 8000,
        maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
        retryBaseDelay: parseInt(process.env.RETRY_BASE_DELAY) || 1000,
    },
    server: {
        port: parseInt(process.env.SERVER_PORT) || 3000,
        host: process.env.SERVER_HOST || '0.0.0.0',
        requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000,
        publicUrl: process.env.PUBLIC_URL || 'https://voiceai-agent-v2-production.up.railway.app',
    },
    call: {
        maxDurationSeconds: parseInt(process.env.CALL_MAX_DURATION) || 90,
        maxConversationTurns: parseInt(process.env.CALL_MAX_TURNS) || 20,
        memoryWindowTurns: parseInt(process.env.MEMORY_WINDOW) || 6,
        defaultTone: process.env.DEFAULT_TONE || 'professional',
        defaultAggression: process.env.DEFAULT_AGGRESSION || 'normal',
        defaultLanguage: process.env.DEFAULT_LANGUAGE || 'English',
    },
    paths: {
        clients: 'src/clients',
        logs: 'src/logs',
        audio: 'src/logs/audio',
        database: 'src/data/voiceai.db',
    },
    fallback: {
        level1: 'Attempt a general helpful answer within industry context.',
        level2: "Redirect conversation back to the client's core services.",
        level3: "I'll note this down and have someone from the team call you back shortly.",
    },
    qualityScoring: {
        enabled: process.env.QUALITY_SCORING !== 'false',
        penaltyPerFallback: parseFloat(process.env.PENALTY_FALLBACK) || 1.5,
        penaltyPerInterrupt: parseFloat(process.env.PENALTY_INTERRUPT) || 0.5,
        bonusForCompletion: parseFloat(process.env.BONUS_COMPLETION) || 2.0,
    },
    exotel: {
        accountSid: process.env.EXOTEL_ACCOUNT_SID,
        apiKey: process.env.EXOTEL_API_KEY,
        apiToken: process.env.EXOTEL_API_TOKEN,
        fromNumber: process.env.EXOTEL_FROM_NUMBER,
    },
    production: {
        safeMode: process.env.SAFE_MODE === 'true',
        logLevel: process.env.LOG_LEVEL || 'info',
        enableMetrics: process.env.ENABLE_METRICS !== 'false',
    },
};

module.exports = config;

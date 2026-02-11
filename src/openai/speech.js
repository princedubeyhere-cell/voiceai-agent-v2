/**
 * OpenAI Whisper STT Module
 * Converts audio file → text transcript.
 * Wrapped with timeout + retry for reliability.
 */

const OpenAI = require('openai');
const fs = require('fs');
const config = require('../../config/config.json');
const { withTimeout } = require('../utils/timeoutPromise');
const { withRetry } = require('../utils/rateLimiter');

const openai = new OpenAI({ apiKey: config.openai.apiKey });
const TIMEOUT = config.openai.apiTimeout || 8000;

/**
 * Transcribe an audio file using Whisper.
 * @param {string} audioFilePath - Path to audio file (mp3, wav, etc.)
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribe(audioFilePath) {
    if (!fs.existsSync(audioFilePath)) {
        throw new Error(`[STT] Audio file not found: ${audioFilePath}`);
    }

    const result = await withRetry(async () => {
        return withTimeout(
            openai.audio.transcriptions.create({
                model: config.openai.sttModel || 'whisper-1',
                file: fs.createReadStream(audioFilePath),
                language: 'en',
            }),
            TIMEOUT,
            'whisper-stt'
        );
    }, 'whisper-stt');

    console.log(`[STT] Transcribed: "${result.text.substring(0, 80)}..."`);
    return result.text;
}

module.exports = { transcribe };

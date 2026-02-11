/**
 * OpenAI TTS Module
 * Converts text → speech audio file (MP3).
 * Uses UUID filenames to prevent collision.
 * Wrapped with timeout + retry for reliability.
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config/config.json');
const { withTimeout } = require('../utils/timeoutPromise');
const { withRetry } = require('../utils/rateLimiter');

const openai = new OpenAI({ apiKey: config.openai.apiKey });
const AUDIO_DIR = path.resolve(__dirname, '../../', config.paths.audio);
const TIMEOUT = config.openai.apiTimeout || 8000;

// Ensure audio directory exists
fs.mkdirSync(AUDIO_DIR, { recursive: true });

/**
 * Synthesize speech from text.
 * @param {string} text - Text to speak
 * @param {string} voice - Voice name (default from config)
 * @returns {Promise<{ filePath: string, filename: string }>}
 */
async function synthesize(text, voice) {
    const selectedVoice = voice || config.openai.defaultVoice || 'nova';
    const filename = `${uuidv4()}.mp3`;
    const filePath = path.join(AUDIO_DIR, filename);

    const response = await withRetry(async () => {
        return withTimeout(
            openai.audio.speech.create({
                model: config.openai.ttsModel || 'tts-1',
                voice: selectedVoice,
                input: text,
                response_format: 'mp3',
            }),
            TIMEOUT,
            'tts-synthesis'
        );
    }, 'tts-synthesis');

    // Write the audio buffer to file
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    console.log(`[TTS] Generated audio: ${filename} (${buffer.length} bytes)`);
    return { filePath, filename };
}

module.exports = { synthesize };

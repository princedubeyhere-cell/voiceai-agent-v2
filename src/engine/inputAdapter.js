/**
 * Input Adapter
 * Unified interface for both simulator and future telephony.
 * Abstracts input source so the call agent doesn't care where text comes from.
 */

const { transcribe } = require('../openai/speech');
const { synthesize } = require('../openai/tts');

/**
 * @typedef {Object} InputAdapter
 * @property {(prompt?: string) => Promise<string>} getInput - Get user input (text or audio)
 * @property {(text: string, voice?: string) => Promise<{filePath?: string}>} sendOutput - Send agent's reply
 * @property {string} type - Adapter type identifier
 */

/**
 * Create a simulator adapter — uses direct text input/output.
 * @param {string[]} scriptedInputs - Pre-scripted user messages for simulation
 * @returns {InputAdapter}
 */
function createSimulatorAdapter(scriptedInputs = []) {
    let inputIndex = 0;

    return {
        type: 'simulator',

        async getInput(_prompt) {
            if (inputIndex >= scriptedInputs.length) {
                return null; // No more input → signal end of call
            }
            const input = scriptedInputs[inputIndex];
            inputIndex++;
            console.log(`[Simulator] User says: "${input}"`);
            return input;
        },

        async sendOutput(text, voice) {
            console.log(`[Simulator] Agent says: "${text}"`);
            // In simulator mode, optionally generate TTS audio
            try {
                const audio = await synthesize(text, voice);
                return { filePath: audio.filePath, text };
            } catch (error) {
                console.warn(`[Simulator] TTS skipped (${error.message}), text-only mode.`);
                return { text };
            }
        },
    };
}

/**
 * Create an audio file adapter — reads audio from file, writes TTS to file.
 * Used for batch processing or testing with real audio.
 * @param {string} audioFilePath - Path to caller's audio
 * @returns {InputAdapter}
 */
function createAudioAdapter(audioFilePath) {
    let consumed = false;

    return {
        type: 'audio',

        async getInput(_prompt) {
            if (consumed) return null;
            consumed = true;
            return await transcribe(audioFilePath);
        },

        async sendOutput(text, voice) {
            const audio = await synthesize(text, voice);
            return { filePath: audio.filePath, text };
        },
    };
}

/**
 * Create a telephony adapter stub — placeholder for future Twilio/WebRTC integration.
 * @param {Object} connectionConfig
 * @returns {InputAdapter}
 */
function createTelephonyAdapter(connectionConfig = {}) {
    return {
        type: 'telephony',

        async getInput(_prompt) {
            // Future: Stream audio from WebSocket → Whisper STT → return text
            throw new Error('[Telephony] Not implemented. Integrate Twilio or WebRTC here.');
        },

        async sendOutput(text, voice) {
            // Future: TTS → stream audio to caller via WebSocket
            throw new Error('[Telephony] Not implemented. Integrate Twilio or WebRTC here.');
        },
    };
}

module.exports = { createSimulatorAdapter, createAudioAdapter, createTelephonyAdapter };

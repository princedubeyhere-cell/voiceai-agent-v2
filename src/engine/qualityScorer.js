/**
 * Quality Scorer
 * Auto-scores each call 1-10 based on multiple factors.
 * Stores results in SQLite for analytics.
 */

const config = require('../config');
const db = require('../utils/db');

const SCORING = config.qualityScoring || {};
const PENALTY_FALLBACK = SCORING.penaltyPerFallback || 1.5;
const PENALTY_INTERRUPT = SCORING.penaltyPerInterrupt || 0.5;
const BONUS_COMPLETION = SCORING.bonusForCompletion || 2.0;

/**
 * Calculate a quality score for a completed call.
 * @param {Object} params
 * @param {string} params.leadId
 * @param {number} params.fallbackCount - Times fallback was used
 * @param {number} params.interruptCount - Times user interrupted
 * @param {number} params.stateErrors - Invalid state transitions
 * @param {number} params.callLengthSeconds - Total call duration
 * @param {boolean} params.completedFlow - Did the call reach CLOSING state?
 * @param {string} params.sentiment - 'positive' | 'neutral' | 'negative'
 * @returns {Object} - { score, details }
 */
function scoreCall({ leadId, fallbackCount = 0, interruptCount = 0, stateErrors = 0, callLengthSeconds = 0, completedFlow = false, sentiment = 'neutral' }) {
    let score = 10; // Start at perfect
    const details = {};

    // Penalize fallback usage
    const fallbackPenalty = fallbackCount * PENALTY_FALLBACK;
    score -= fallbackPenalty;
    details.fallbackPenalty = -fallbackPenalty;

    // Penalize interrupts
    const interruptPenalty = interruptCount * PENALTY_INTERRUPT;
    score -= interruptPenalty;
    details.interruptPenalty = -interruptPenalty;

    // Penalize state errors
    const stateErrorPenalty = stateErrors * 1.0;
    score -= stateErrorPenalty;
    details.stateErrorPenalty = -stateErrorPenalty;

    // Bonus for completing the full call flow
    if (completedFlow) {
        score += BONUS_COMPLETION;
        details.completionBonus = BONUS_COMPLETION;
    }

    // Sentiment adjustment
    if (sentiment === 'positive') {
        score += 0.5;
        details.sentimentBonus = 0.5;
    } else if (sentiment === 'negative') {
        score -= 1.5;
        details.sentimentPenalty = -1.5;
    }

    // Penalize very short calls (< 15 seconds) or very long calls (> 120 seconds)
    if (callLengthSeconds > 0 && callLengthSeconds < 15) {
        score -= 1.0;
        details.tooShortPenalty = -1.0;
    } else if (callLengthSeconds > 120) {
        score -= 0.5;
        details.tooLongPenalty = -0.5;
    }

    // Clamp to 1-10
    score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));
    details.finalScore = score;

    // Store in database
    try {
        db.upsertQualityScore({
            leadId,
            score,
            fallbackCount,
            interruptCount,
            stateErrors,
            callLength: callLengthSeconds,
            completedFlow,
            details,
        });
    } catch (error) {
        console.error('[QualityScorer] DB write failed:', error.message);
    }

    console.log(`[QualityScorer] Lead ${leadId}: Score = ${score}/10`);
    return { score, details };
}

module.exports = { scoreCall };

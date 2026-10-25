// Single source of truth for which Gemini model the Cloud Functions use.
// gemini-2.0-flash is being retired, so we default to the current GA flash.
// Override with the GEMINI_MODEL env var without a code change if needed.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

module.exports = { GEMINI_MODEL };

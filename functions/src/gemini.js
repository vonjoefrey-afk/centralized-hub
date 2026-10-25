const { GoogleGenerativeAI } = require("@google/generative-ai");

// Which Gemini model works depends on the API key / project — a name that works
// for one key 404s for another, and this project's key also can't call the
// ListModels endpoint. So we try known flash model names in order (newest /
// non-deprecated first) and use the first the key actually accepts, caching it.
// Set GEMINI_MODEL to force a specific model and skip the probing.
const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
].filter(Boolean);

let cachedModel = null; // first model that worked, per function instance

// True when the error is "this model isn't available" (so we should try the
// next candidate) rather than a real failure like auth/quota/network.
function isModelUnavailable(err) {
  const msg = String((err && err.message) || "");
  return /\b404\b|not found|not supported|unsupported/i.test(msg);
}

/**
 * Generate a JSON response from Gemini, auto-selecting a model the key accepts.
 * @param {string} apiKey
 * @param {Array} contents - generateContent `contents` array
 * @returns {Promise<{ text: string, model: string }>}
 */
async function generateJson(apiKey, contents) {
  // Guard against a stray newline/space in the stored secret, which Google
  // rejects as API_KEY_INVALID even when the key itself is correct.
  const genAI = new GoogleGenerativeAI(String(apiKey || "").trim());
  const run = async (name) => {
    const model = genAI.getGenerativeModel({ model: name });
    const response = await model.generateContent({
      contents,
      generationConfig: { responseMimeType: "application/json" },
    });
    return { text: response.response.text(), model: name };
  };

  // Try the known-good model first, then the rest.
  const order = cachedModel
    ? [cachedModel, ...CANDIDATE_MODELS.filter((m) => m !== cachedModel)]
    : CANDIDATE_MODELS;

  let lastErr;
  for (const name of order) {
    try {
      const out = await run(name);
      if (cachedModel !== name) {
        cachedModel = name;
        console.log(`[gemini] Using model: ${name}`);
      }
      return out;
    } catch (err) {
      if (isModelUnavailable(err)) { lastErr = err; continue; } // try the next model
      throw err; // real error — surface it
    }
  }
  throw lastErr || new Error("No Gemini model is available for this API key.");
}

module.exports = { generateJson };

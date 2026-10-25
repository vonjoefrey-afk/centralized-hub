const { GoogleGenerativeAI } = require("@google/generative-ai");

// Which Gemini model to use varies by API key / project — a name that works for
// one key can 404 for another (e.g. gemini-2.5-flash is not enabled everywhere).
// So instead of hard-coding a name, we ask the key which models it actually has
// and pick the best available *flash* model. Set GEMINI_MODEL to override.

let cachedModel = null; // resolved once per function instance

// Higher score = preferred. Newer version wins; prefer the stable alias and full
// flash over lite/preview variants.
function rankModel(name) {
  let score = 0;
  const v = name.match(/gemini-(\d+)\.(\d+)/);
  if (v) score += parseInt(v[1], 10) * 100 + parseInt(v[2], 10) * 10;
  if (/flash-latest$/.test(name)) score += 5;
  if (/lite/.test(name)) score -= 3;
  if (/preview|exp|thinking|vision/.test(name)) score -= 2;
  return score;
}

/** Resolve a usable flash model name for this API key (cached). */
async function resolveModel(apiKey) {
  if (cachedModel) return cachedModel;
  if (process.env.GEMINI_MODEL) {
    cachedModel = process.env.GEMINI_MODEL;
    return cachedModel;
  }
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!resp.ok) {
    throw new Error(`Could not list Gemini models (HTTP ${resp.status}).`);
  }
  const data = await resp.json();
  const candidates = (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => (m.name || "").replace(/^models\//, ""))
    .filter((n) => /flash/i.test(n))
    .sort((a, b) => rankModel(b) - rankModel(a));

  if (candidates.length === 0) {
    throw new Error("No Gemini flash model supporting generateContent is available for this key.");
  }
  cachedModel = candidates[0];
  console.log(`[gemini] Using model: ${cachedModel}`);
  return cachedModel;
}

/**
 * Generate a JSON response from Gemini using an auto-resolved model.
 * @param {string} apiKey
 * @param {Array} contents - generateContent `contents` array
 * @returns {Promise<{ text: string, model: string }>}
 */
async function generateJson(apiKey, contents) {
  const model = await resolveModel(apiKey);
  const genAI = new GoogleGenerativeAI(apiKey);
  const m = genAI.getGenerativeModel({ model });
  const response = await m.generateContent({
    contents,
    generationConfig: { responseMimeType: "application/json" },
  });
  return { text: response.response.text(), model };
}

module.exports = { resolveModel, generateJson };

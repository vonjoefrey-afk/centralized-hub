const functions = require("firebase-functions");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const mammoth = require("mammoth");
const xlsx = require("xlsx");

exports.extractTemplatesFromFile = async (data, context) => {
  // Authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const { fileData, mimeType, fileName, googleUrl } = data;
  if (!fileData && !googleUrl) {
    throw new functions.https.HttpsError("invalid-argument", "Either fileData or googleUrl is required.");
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[extractTemplatesFromFile] GEMINI_API_KEY is missing.");
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // The prompt instructs Gemini to return a strict JSON array
    const prompt = `
You are an expert at extracting standardized communication templates from unstructured files.
I will provide you with the content of a file (which may be a document, spreadsheet, or text).
Your task is to identify and extract all communication templates (e.g., canned responses, escalation notes, welcome messages, standard replies).

For each template you find, extract:
1. "title": A short, descriptive title (maximum 6 words).
2. "description": The actual content/message of the template. Ensure you preserve the exact wording of the message.

Return ONLY a JSON array of objects. Do not include markdown code blocks or any other text.
Example format:
[
  {
    "title": "Welcome Message",
    "description": "Hi there, welcome to our service! We are glad to have you."
  }
]
`;

    let parts = [{ text: prompt }];

    if (googleUrl) {
      console.log("[extractTemplatesFromFile] Fetching Google URL:", googleUrl);
      const docMatch = googleUrl.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      const sheetMatch = googleUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      
      let exportUrl = "";
      if (docMatch) {
        exportUrl = `https://docs.google.com/document/d/${docMatch[1]}/export?format=txt`;
      } else if (sheetMatch) {
        exportUrl = `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=csv`;
      } else {
        throw new Error("Invalid Google Doc/Sheet URL.");
      }

      const res = await fetch(exportUrl);
      if (!res.ok) {
        throw new Error("Failed to fetch Google Document. Please ensure it is set to 'Anyone with the link can view'.");
      }
      
      const fileTextContent = await res.text();
      // If the document is private, it redirects to a login page and returns HTML
      if (fileTextContent.trim().toLowerCase().startsWith("<!doctype html>")) {
        throw new Error("Google Document is private. Please ensure it is set to 'Anyone with the link can view'.");
      }
      
      parts.push({ text: `\n\n--- FILE CONTENT START ---\n${fileTextContent}\n--- FILE CONTENT END ---` });
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      console.log("[extractTemplatesFromFile] Parsing DOCX with mammoth...");
      // fileData is expected to be a base64 string
      const buffer = Buffer.from(fileData, "base64");
      const result = await mammoth.extractRawText({ buffer: buffer });
      const text = result.value;
      if (!text || text.trim() === "") {
         throw new Error("Could not extract any text from the DOCX file.");
      }
      parts.push({ text: `\n\n--- FILE CONTENT START ---\n${text}\n--- FILE CONTENT END ---` });
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
      mimeType === "application/vnd.ms-excel"
    ) {
      console.log("[extractTemplatesFromFile] Parsing Excel with xlsx...");
      const buffer = Buffer.from(fileData, "base64");
      const workbook = xlsx.read(buffer, { type: "buffer" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const csvText = xlsx.utils.sheet_to_csv(worksheet);
      
      if (!csvText || csvText.trim() === "") {
         throw new Error("Could not extract any text from the Excel file.");
      }
      parts.push({ text: `\n\n--- FILE CONTENT START ---\n${csvText}\n--- FILE CONTENT END ---` });
    } else {
      // For PDF, TXT, CSV, etc., we can pass the inline data directly to Gemini 1.5
      console.log(`[extractTemplatesFromFile] Passing inline data for mimeType: ${mimeType}`);
      parts.push({
        inlineData: {
          data: fileData,
          mimeType: mimeType
        }
      });
    }

    console.log(`[extractTemplatesFromFile] Calling Gemini API...`);
    const response = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
         responseMimeType: "application/json"
      }
    });

    const responseText = response.response.text();
    console.log(`[extractTemplatesFromFile] Gemini API returned response of length: ${responseText.length}`);

    let templates = [];
    try {
      templates = JSON.parse(responseText);
      if (!Array.isArray(templates)) {
         throw new Error("Gemini did not return an array.");
      }
    } catch (parseError) {
      console.error("[extractTemplatesFromFile] Failed to parse JSON from Gemini:", responseText);
      throw new functions.https.HttpsError("internal", "AI returned invalid format. Please try again.");
    }

    return { success: true, templates };

  } catch (error) {
    console.error("[extractTemplatesFromFile] Error:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
};

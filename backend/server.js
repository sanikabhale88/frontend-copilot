const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function runCompilation(prompt) {
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
  });

  return response.text;
}

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, existingCode, instruction } = req.body;

    const isRefine =
      existingCode?.trim() && instruction?.trim();

    let finalPrompt = "";

    // ---------- REFINE ----------
    if (isRefine) {
      finalPrompt = `
You are a senior React engineer acting as a CODE EDITOR.

Your task is to MODIFY an existing React component.

STRICT RULES:
- DO NOT redesign the UI.
- DO NOT create a new component.
- Keep the SAME component name.
- Keep the SAME JSX structure unless the instruction requires otherwise.
- Preserve all existing functionality.
- Change ONLY what the user requested.
- Return the COMPLETE updated component.
- Return ONLY React JSX.
- No markdown.
- No explanation.
- No \`\`\`.

USER INSTRUCTION:
${instruction}

EXISTING COMPONENT:
${existingCode}
`;
    }

    // ---------- GENERATE ----------
    else {
      finalPrompt = `
You are an expert React developer.

Generate ONE production-ready React functional component.

Rules:
- Use React + Tailwind CSS only.
- Export default component.
- Do NOT use external libraries.
- Do NOT use react-icons, lucide-react or heroicons.
- Use inline SVG if icons are needed.
- Return ONLY JSX.
- No explanation.
- No markdown.

USER REQUEST:
${prompt}
`;
    }

    const result = await runCompilation(finalPrompt);

    res.json({
      success: true,
      result,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
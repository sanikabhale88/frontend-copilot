const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

const PORT = 5000;

// --------------------
// CORS
// --------------------

const corsOptions = {
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());

// --------------------
// Gemini
// --------------------

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

// --------------------
// Generate / Refine
// --------------------

app.post("/api/generate", async (req, res) => {
  try {
    const {
      prompt,
      existingCode,
      instruction,
    } = req.body;

    const isRefine =
      existingCode?.trim() &&
      instruction?.trim();

    let finalPrompt = "";

    // ====================
    // REFINE EXISTING CODE
    // ====================

    if (isRefine) {
      finalPrompt = `
You are a senior React engineer acting strictly as a CODE EDITOR.

Your task is to modify the EXISTING React component.

The user wants a specific change to the existing component.

STRICT RULES:

1. DO NOT create a new component.
2. DO NOT redesign the UI.
3. DO NOT change the overall layout.
4. DO NOT remove existing functionality.
5. DO NOT add unrelated features.
6. Keep the SAME component name.
7. Keep the SAME JSX structure wherever possible.
8. Apply ONLY the user's requested change.
9. If the user asks to change a color, change ONLY that color.
10. If the user asks to change text, change ONLY that text.
11. If the user asks to change spacing, change ONLY the relevant spacing.
12. Preserve all existing styling and functionality that the user did not ask to change.
13. Return the COMPLETE updated React component.
14. Return ONLY JSX code.
15. Do NOT return markdown.
16. Do NOT use code fences.
17. Do NOT explain your changes.

IMPORTANT:
If the instruction is:

"make the background color pink"

then ONLY change the relevant background color to pink.

Do NOT redesign the component.
Do NOT create a different page.
Do NOT change the component structure.

USER INSTRUCTION:
${instruction}

EXISTING COMPONENT:
${existingCode}
`;
    }

    // ====================
    // GENERATE NEW COMPONENT
    // ====================

    else {
      finalPrompt = `
You are an expert React developer.

Generate ONE production-ready React functional component.

RULES:

- Use React + Tailwind CSS only.
- Export a default React component.
- Do NOT use external libraries.
- Do NOT use react-icons.
- Do NOT use lucide-react.
- Do NOT use heroicons.
- Use inline SVG when icons are needed.
- Return ONLY JSX code.
- No markdown.
- No explanation.
- No code fences.

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
    console.error("Generation error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// --------------------
// Health Check
// --------------------

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Frontend Copilot API is running",
  });
});

// --------------------
// Vercel
// --------------------

module.exports = app;
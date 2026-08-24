const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

// --------------------
// Middleware
// --------------------

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

// --------------------
// Gemini AI
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
      Boolean(existingCode?.trim()) &&
      Boolean(instruction?.trim());

    let finalPrompt = "";

    // ==========================
    // REFINE EXISTING COMPONENT
    // ==========================

    if (isRefine) {
      finalPrompt = `
You are a senior React engineer acting strictly as a CODE EDITOR.

Your task is to modify the EXISTING React component.

The user wants a specific change to the existing component.

STRICT RULES:

1. Modify the existing component. Do NOT create a new component.
2. Keep the SAME component name.
3. Preserve the existing layout.
4. Preserve all existing functionality.
5. Do NOT redesign the UI.
6. Do NOT change unrelated parts of the component.
7. Apply ONLY the change requested by the user.
8. Keep the existing JSX structure wherever possible.
9. If the user asks to change a color, change ONLY the relevant color.
10. If the user asks to change text, change ONLY the relevant text.
11. If the user asks to change spacing, change ONLY the relevant spacing.
12. If the user asks to add something, add only that requested feature.
13. Do NOT remove existing functionality unless explicitly requested.
14. Return the COMPLETE updated React component.
15. Return ONLY JSX code.
16. Do NOT return markdown.
17. Do NOT use code fences.
18. Do NOT explain your changes.

IMPORTANT EXAMPLE:

User instruction:
"make the background color pink"

Expected behavior:
- Keep the exact same component.
- Keep the exact same layout.
- Keep the same buttons, text, inputs, icons and functionality.
- Change the relevant background color to pink.
- Do NOT create a different page.
- Do NOT redesign the component.

USER INSTRUCTION:
${instruction}

EXISTING COMPONENT:
${existingCode}
`;
    }

    // ==========================
    // GENERATE NEW COMPONENT
    // ==========================

    else {
      finalPrompt = `
You are an expert React developer.

Generate ONE production-ready React functional component.

RULES:

- Use React + Tailwind CSS only.
- Export a default React functional component.
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

    // --------------------------
    // Generate response
    // --------------------------

    const result = await runCompilation(finalPrompt);

    res.status(200).json({
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
  res.status(200).json({
    success: true,
    message: "Frontend Copilot API is running",
  });
});

// --------------------
// Vercel
// --------------------

module.exports = app;
# ✨ Frontend Copilot

AI-powered React component generator that turns natural-language prompts into React + Tailwind CSS components.

**Generate → Preview → Refine → Export**

## 🚀 Live Demo

[https://frontend-copilot.vercel.app/](https://frontend-copilot.vercel.app/)

## ✨ Features

- 🤖 Generate React components using Gemini AI
- 👀 Live Desktop / Tablet / Mobile preview
- ✨ Refine components using natural language
- ↶ Undo refinements
- 📋 Copy generated JSX
- ⬇️ Download `.jsx` components
- 🔄 Regenerate components
- 📱 Responsive UI

## 🛠️ Tech Stack

**Frontend:** React, JavaScript, Tailwind CSS, Axios, Vite

**Backend:** Node.js, Express.js, REST API, CORS

**AI:** Google Gemini API, Prompt Engineering

**Deployment:** Vercel + Render

## 🔄 How It Works

1. User describes the desired UI.
2. React frontend sends the prompt to the Express backend.
3. Backend sends the request to Gemini.
4. Gemini returns the React component.
5. The component is rendered in the Live Preview.
6. Users can refine, undo, copy, or download the generated code.

## 📂 Project Structure

```text
frontend-copilot/
├── frontend/
│   ├── src/
│   │   └── components/
│   └── package.json
├── backend/
│   ├── server.js
│   └── package.json
├── .gitignore
└── README.md
```

## ⚙️ Local Setup

### Prerequisites

- Node.js
- npm
- Google Gemini API key

### Backend

```bash
cd backend
npm install
```

Create a `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key
PORT=5000
```

Run the backend:

```bash
node server.js
```

### Frontend

Open another terminal:

```bash
cd frontend
npm install
```

Create a `.env` file:

```env
VITE_API_URL=http://localhost:5000
```

Run the frontend:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

## 🌐 Deployment

**Frontend:** [https://frontend-copilot.vercel.app/](https://frontend-copilot.vercel.app/)

**Backend:** [https://frontend-copilot-api.onrender.com/](https://frontend-copilot-api.onrender.com/)

## 🔮 Future Improvements

- Automatic JSX validation and repair
- Syntax-highlighted code editor
- Multi-file generation
- Saved projects
- Authentication
- Persistent project history

## 👩‍💻 Author

**Sanika Bhale**

[GitHub](https://github.com/sanikabhale88)

[LinkedIn](https://linkedin.com/in/sanikabhale)
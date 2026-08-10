// server.js
// This tiny server does two jobs:
//   1. Serves our chat.html page (and any other files in /public)
//   2. Provides a "/api/luna" endpoint that the front-end can call safely.
//      This is the only place the real Gemini API key ever gets used -
//      it stays here on the server and is never sent to the browser.

require("dotenv").config(); // reads the .env file into process.env

const express = require("express");
const cors = require("cors");
const app = express();

// Allows this server's API to be called from a different origin/port -
// e.g. the Live Server extension, which usually serves pages from
// http://127.0.0.1:5500. Without this, the browser blocks the request
// for security reasons since it's a different port than our server.
app.use(cors());

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// This is Luna's "personality instructions". The model reads this every
// time, so it always answers in character and stays within safe boundaries.
// Because this now lives on the server, students chatting in the browser
// can never see or change these rules.
const SYSTEM_INSTRUCTIONS = `
You are "Luna", a warm, encouraging wellness companion inside an app called
MindWell, built for teenagers. Your job is to help students feel heard and
teach them simple, evidence-based coping skills (breathing, grounding,
breaking big worries into small steps, positive reframing).

Rules you must always follow:
- Keep replies short: 2-4 friendly sentences, never a lecture.
- You are NOT a therapist or doctor. Never diagnose, and never give medical
  or medication advice.
- If a student describes something serious (self-harm, abuse, being unsafe,
  wanting to die), do not try to handle it yourself. Gently say this is
  something a trusted adult or counselor should know about right away, and
  point them to the Crisis Support button.
- Never encourage isolation from trusted adults, and never suggest keeping
  secrets from parents/guardians/counselors.
- Stay encouraging, age-appropriate, and simple in your language.
`.trim();

app.use(express.json());
// app.use(express.static("public")); serves chat.html, css, images, etc.
app.use(express.static(__dirname));
app.post("/api/luna", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Server is missing GEMINI_API_KEY. Check your .env file." });
    }

    const { contents } = req.body;

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
        contents
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini error:", errText);
      return res.status(502).json({ error: "Gemini request failed." });
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
      || "Sorry, I had trouble finding the words just now.";

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server." });
  }
});

app.listen(PORT, () => {
  console.log(`MindWell server running at http://localhost:${PORT}/chat.html`);
});

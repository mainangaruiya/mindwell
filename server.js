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
const path = require('path');

// Allows this server's API to be called from a different origin/port -
// e.g. the Live Server extension, which usually serves pages from
// http://127.0.0.1:5500. Without this, the browser blocks the request
// for security reasons since it's a different port than our server.
app.use(cors());

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Optional Anthropic fallback (set ANTHROPIC_API_KEY in your .env)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-2.1';
const ANTHROPIC_URL = `https://api.anthropic.com/v1/complete`;

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
// Serve static files from the project root (so Chat.html, css, images, etc. are available)
app.use(express.static(__dirname));

// Friendly redirects: many links expect lowercase `/chat.html` or `/`.
app.get('/chat.html', (req, res) => res.sendFile(path.join(__dirname, 'Chat.html')));
app.get('/', (req, res) => res.redirect('/Chat.html'));
app.post("/api/luna", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Server is missing GEMINI_API_KEY. Check your .env file." });
    }

    const { contents } = req.body;
    console.log(`/api/luna request received; conversation length: ${ (contents || []).length }`);
    // First: try Gemini
    let geminiReply = null;
    try {
      console.log(`Attempting Gemini model: ${GEMINI_MODEL}`);
      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
          contents
        })
      });

      if (response.ok) {
        const data = await response.json();
        geminiReply = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        if (geminiReply) console.log('Gemini reply received (truncated):', geminiReply.slice(0,120).replace(/\n/g,' '));
      } else {
        const errText = await response.text();
        console.error("Gemini error:", errText);
      }
    } catch (gErr) {
      console.error('Gemini request failed:', gErr);
    }

    // If Gemini produced a reply, use it
    if (geminiReply) {
      return res.json({ reply: geminiReply });
    }

    // Otherwise, attempt Anthropic fallback if key provided
    if (ANTHROPIC_API_KEY) {
      try {
        console.log(`Falling back to Anthropic model: ${ANTHROPIC_MODEL}`);
        // Build a simple prompt from the conversation contents
        const convoText = (contents || []).map(turn => {
          const role = turn.role || 'user';
          const text = (turn.parts || []).map(p => p.text).join('\n') || '';
          return `${role.toUpperCase()}: ${text}`;
        }).join('\n');

        const prompt = `${SYSTEM_INSTRUCTIONS}\n\n${convoText}\nASSISTANT:`;

        const aResp = await fetch(ANTHROPIC_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY
          },
          body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            prompt,
            max_tokens_to_sample: 300,
            temperature: 0.7
          })
        });

        if (aResp.ok) {
          const aData = await aResp.json();
          const anthropicReply = aData.completion || aData.result || null;
          if (anthropicReply) {
            console.log('Anthropic reply received (truncated):', anthropicReply.slice(0,120).replace(/\n/g,' '));
            return res.json({ reply: anthropicReply.trim() });
          }
        } else {
          const errText = await aResp.text();
          console.error('Anthropic error:', errText);
        }
      } catch (aErr) {
        console.error('Anthropic request failed:', aErr);
      }
    }

    // Final fallback answer if both services failed or no key provided
    return res.json({ reply: "Sorry, I'm having trouble connecting to the AI service right now. Please try again in a moment." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server." });
  }
});

// Avoid 404s for favicon requests
app.get('/favicon.ico', (req, res) => res.status(204).end());

app.listen(PORT, () => {
  console.log(`MindWell server running at http://localhost:${PORT}/Chat.html`);
  console.log(`Gemini model: ${GEMINI_MODEL} | Gemini key: ${GEMINI_API_KEY ? 'present' : 'missing'}`);
  console.log(`Anthropic model: ${ANTHROPIC_MODEL} | Anthropic key: ${ANTHROPIC_API_KEY ? 'present' : 'missing'}`);
});

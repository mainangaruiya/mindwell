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

// Anthropic fallback. Either key on its own is enough to run the chat:
// if Gemini's key is missing (or Gemini errors), we go straight to Anthropic.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
const ANTHROPIC_URL = `https://api.anthropic.com/v1/messages`;

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
// The browser sends the conversation in Gemini's shape:
//   [{ role: "user" | "model", parts: [{ text }] }, ...]
// Anthropic wants [{ role: "user" | "assistant", content }] where the first
// turn is from the user and the roles alternate, so translate and tidy up.
function toAnthropicMessages(contents) {
  const messages = [];
  for (const turn of contents || []) {
    const text = (turn.parts || []).map(p => p.text || '').join('\n').trim();
    if (!text) continue;
    const role = turn.role === 'model' ? 'assistant' : 'user';
    // Skip an assistant greeting before the student has said anything.
    if (messages.length === 0 && role === 'assistant') continue;
    const last = messages[messages.length - 1];
    if (last && last.role === role) {
      last.content += `\n${text}`;
    } else {
      messages.push({ role, content: text });
    }
  }
  return messages;
}

app.post("/api/luna", async (req, res) => {
  try {
    if (!GEMINI_API_KEY && !ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "Server has no AI key. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in your .env file." });
    }

    const { contents } = req.body;
    console.log(`/api/luna request received; conversation length: ${ (contents || []).length }`);
    // First: try Gemini, but only if we actually have a key for it.
    let geminiReply = null;
    if (!GEMINI_API_KEY) {
      console.log('No GEMINI_API_KEY set - skipping Gemini and using Anthropic.');
    } else {
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
    }

    // If Gemini produced a reply, use it
    if (geminiReply) {
      return res.json({ reply: geminiReply });
    }

    // Otherwise, attempt Anthropic fallback if key provided
    if (ANTHROPIC_API_KEY) {
      try {
        console.log(`Falling back to Anthropic model: ${ANTHROPIC_MODEL}`);
        const messages = toAnthropicMessages(contents);
        if (messages.length === 0) {
          console.error('Anthropic skipped: conversation had no usable messages.');
        } else {
          const aResp = await fetch(ANTHROPIC_URL, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: ANTHROPIC_MODEL,
              // Luna's replies are short, but max_tokens covers thinking as well
              // as the reply, so leave headroom or the answer gets cut off.
              max_tokens: 2048,
              system: SYSTEM_INSTRUCTIONS,
              thinking: { type: 'adaptive' },
              output_config: { effort: 'low' },
              messages
            })
          });

          if (aResp.ok) {
            const aData = await aResp.json();
            if (aData.stop_reason === 'refusal') {
              console.error('Anthropic declined the request:', aData.stop_details?.category);
            } else {
              const anthropicReply = (aData.content || [])
                .filter(block => block.type === 'text')
                .map(block => block.text)
                .join('')
                .trim();
              if (anthropicReply) {
                console.log('Anthropic reply received (truncated):', anthropicReply.slice(0,120).replace(/\n/g,' '));
                return res.json({ reply: anthropicReply });
              }
            }
          } else {
            const errText = await aResp.text();
            console.error('Anthropic error:', errText);
          }
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

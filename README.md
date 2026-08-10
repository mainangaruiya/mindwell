This repo is for students aged 12-18 who know basic HTML/CSS, some JavaScript,
and can use an AI coding assistant for small code generation and debugging
tasks.

# MindWell Chat — Setup

This little project has two parts:
- `public/chat.html` — the page you see and click around in
- `server.js` — a small helper server that keeps the Gemini API key secret

## One-time setup

1. Install [Node.js](https://nodejs.org/) if you don't have it already.
2. In this folder, install the dependencies:
   ```
   npm install
   ```
3. Get a free Gemini API key: https://aistudio.google.com/apikey
4. Copy `.env.example` to a new file named `.env`:
   ```
   cp .env.example .env
   ```
5. Open `.env` and paste your real key after `GEMINI_API_KEY=`.

## Running it

```
npm start
```

Then open your browser to:
```
http://localhost:3000/chat.html
```

## Why two files instead of one?

Browsers can only run HTML/CSS/JS — they can't read a `.env` file, and
anything typed directly into the HTML is visible to anyone who views the
page source. So the secret key lives in `server.js` (which only runs on
your computer, never in the browser), and the browser just asks *our*
server for Luna's replies instead of asking Gemini directly.

## Important note

`.env` is listed in `.gitignore` on purpose — never commit your real API
key to GitHub or share it with anyone. If you're working on this as a team,
each person should create their own `.env` file locally using their own key.

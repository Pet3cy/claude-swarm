# OBESSU Advocacy Command Centre — Local Edition

A local, self-hosted replica of the OBESSU Advocacy Command Centre: Next Best
Action (NBA) scoring, opportunity workflows, stakeholder intelligence, audio
debrief transcription, and strategic advocacy drafting — with optional Google
Workspace (Calendar/Gmail/Drive/Tasks) integration.

This edition replaces the original's cloud Gemini API with a **free,
open-source local model served by [Ollama](https://ollama.com)**, and swaps
Google's Speech-to-Text/Search grounding for a **local Whisper transcriber**
and a **free, keyless web search**. Nothing leaves your machine except the
optional Google Workspace calls you explicitly opt into.

## Why this is efficient & secure

- **No API keys, no per-request cost.** All AI generation runs on your own
  hardware through Ollama; there's nothing to leak and nothing to bill.
- **Data stays local.** Advocacy notes, stakeholder intel, and audio debriefs
  never leave your machine unless you sign in to Google Workspace yourself.
- **Hardened server.** `helmet` security headers, response `compression`,
  rate limiting on AI routes, and strict request validation/size caps guard
  against accidental resource exhaustion from a buggy client or runaway loop.
- **Warm model, fast responses.** Ollama keeps the model resident in memory
  between requests (`OLLAMA_KEEP_ALIVE`) instead of reloading it every call.

## Prerequisites

1. **Node.js** 20+
2. **[Ollama](https://ollama.com)** installed and running (`ollama serve`),
   with a model pulled:
   ```bash
   ollama pull llama3.1
   ```
   Any reasonably capable instruction-tuned model works (e.g. `qwen2.5`,
   `mistral`) — set `OLLAMA_MODEL` in `.env.local` to match.
3. **ffmpeg** is bundled automatically via the `ffmpeg-static` npm package —
   no separate install needed. It's used to convert recorded voice memos to
   the format the local Whisper model expects.

## Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and adjust if needed (defaults work
   for a standard local Ollama install):
   ```bash
   cp .env.example .env.local
   ```
3. Start the app:
   ```bash
   npm run dev
   ```
4. Open http://localhost:3000

The first time you use the voice-debrief feature, the Whisper speech-to-text
model (`WHISPER_MODEL`, ~150MB by default) downloads once and is cached for
fully offline use afterward.

## Optional: Google Workspace integration

Calendar/Gmail/Drive/Tasks sync is optional and only activates when you sign
in with Google from the app (Workspace Auth). Without signing in, the app
runs in local **Sandbox Demo Mode** with no external calls at all. See
`firebase-applet-config.json` for the OAuth client configuration; the API key
in that file is a public Firebase *web* key (safe to ship client-side by
design — access is governed by Firebase project/OAuth consent, not secrecy
of that value).

## Architecture notes

- `server.ts` — Express app: security middleware, rate limiting, and the
  `/api/ai/*` routes.
- `server/localAi.ts` — thin Ollama client wrapper (text + structured JSON
  generation).
- `server/transcribe.ts` — local Whisper transcription via
  `@xenova/transformers`, with `ffmpeg-static` handling audio format
  conversion.
- `server/webSearch.ts` — free, keyless DuckDuckGo HTML search used for the
  "Live EU Policy Radar" feature.
- `server/validate.ts` — request validation/size guardrails shared by all AI
  routes.

## Known dependency advisories

`npm audit` reports advisories in `onnxruntime-node`'s bundled `adm-zip` (used
only during its own native-binary install step, not at runtime on user data)
and in `sharp` (pulled in transitively by the local transcription library for
image-model support this app never uses). Both currently have no upstream fix
available. Neither is reachable through this app's own request handling —
audio you record never passes through `sharp` or zip extraction — but keep an
eye on `npm audit` and update `@huggingface/transformers` when a patched
release lands.

## Build for production

```bash
npm run build
npm start
```

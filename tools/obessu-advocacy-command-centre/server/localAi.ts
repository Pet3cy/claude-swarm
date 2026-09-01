import { Ollama } from 'ollama';

/**
 * Local, free LLM provider backed by Ollama (https://ollama.com).
 * Replaces the original Gemini-backed implementation so the app can run
 * fully offline with zero API keys and zero per-request cost.
 *
 * Prerequisites (documented in README.md):
 *   1. Install Ollama and run `ollama serve`.
 *   2. Pull a model, e.g. `ollama pull llama3.1`.
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';
// Keep the model resident in memory between requests so repeated calls
// don't pay the multi-second model-load cost every time.
const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m';

const client = new Ollama({ host: OLLAMA_HOST });

export class LocalAiUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      `Could not reach the local Ollama server at ${OLLAMA_HOST}. ` +
        'Install Ollama (https://ollama.com), run `ollama serve`, and pull a model ' +
        `with \`ollama pull ${DEFAULT_MODEL}\`.`,
    );
    this.name = 'LocalAiUnavailableError';
    if (cause instanceof Error) this.cause = cause;
  }
}

function isConnectionError(error: any): boolean {
  const code = error?.cause?.code || error?.code;
  return code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET';
}

interface ChatOptions {
  system?: string;
  model?: string;
  temperature?: number;
  /** JSON schema for structured output. When omitted, plain text is returned. */
  schema?: Record<string, unknown>;
  images?: string[];
}

async function chat(prompt: string, opts: ChatOptions = {}): Promise<string> {
  try {
    const response = await client.chat({
      model: opts.model || DEFAULT_MODEL,
      messages: [
        ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
        { role: 'user', content: prompt, images: opts.images },
      ],
      format: opts.schema as any,
      options: {
        temperature: opts.temperature ?? 0.6,
      },
      keep_alive: KEEP_ALIVE,
      stream: false,
    });
    return response.message.content;
  } catch (error: any) {
    if (isConnectionError(error)) {
      throw new LocalAiUnavailableError(error);
    }
    throw error;
  }
}

/** Free-form text generation (e.g. long-form drafting). */
export async function generateText(prompt: string, opts: ChatOptions = {}): Promise<string> {
  return chat(prompt, opts);
}

/** Structured JSON generation, validated against a JSON schema. */
export async function generateJSON<T>(
  prompt: string,
  schema: Record<string, unknown>,
  opts: ChatOptions = {},
): Promise<T> {
  const raw = await chat(prompt, { ...opts, schema });
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`Local model returned invalid JSON: ${(error as Error).message}`);
  }
}

export const localAiConfig = {
  host: OLLAMA_HOST,
  defaultModel: DEFAULT_MODEL,
};

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

const execFileAsync = promisify(execFile);

// Multilingual by default so it handles the mix of English/French/other EU
// languages typical of Brussels advocacy work. Override with WHISPER_MODEL.
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'Xenova/whisper-base';

const MIME_TO_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

/** Lazily loads the Whisper model once and reuses it for every request. */
async function getTranscriber(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!transcriberPromise) {
    transcriberPromise = import('@huggingface/transformers').then(({ pipeline }) =>
      pipeline('automatic-speech-recognition', WHISPER_MODEL) as Promise<AutomaticSpeechRecognitionPipeline>,
    );
  }
  return transcriberPromise;
}

/** Parses a canonical PCM WAV buffer into a normalized mono Float32Array. */
function decodeWavPcm16(buffer: Buffer): Float32Array {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Unexpected audio conversion output (not a RIFF/WAVE file).');
  }

  let offset = 12;
  let dataOffset = -1;
  let dataLength = 0;
  let bitsPerSample = 16;
  let numChannels = 1;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === 'fmt ') {
      numChannels = buffer.readUInt16LE(chunkStart + 2);
      bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
    } else if (chunkId === 'data') {
      dataOffset = chunkStart;
      dataLength = chunkSize;
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (dataOffset === -1) throw new Error('No PCM data chunk found in converted audio.');
  if (bitsPerSample !== 16) throw new Error(`Unsupported PCM bit depth: ${bitsPerSample}`);

  const sampleCount = Math.min(dataLength, buffer.length - dataOffset) / 2;
  const samples = new Float32Array(Math.floor(sampleCount / numChannels));

  for (let i = 0; i < samples.length; i++) {
    // Downmix to mono by averaging channels (input is already forced to mono via ffmpeg,
    // but this stays correct if that ever changes).
    let sum = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const sampleIndex = dataOffset + (i * numChannels + ch) * 2;
      sum += buffer.readInt16LE(sampleIndex) / 32768;
    }
    samples[i] = sum / numChannels;
  }

  return samples;
}

async function convertToWav16kMono(inputPath: string, outputPath: string): Promise<void> {
  if (!ffmpegPath) throw new Error('ffmpeg-static binary not found for this platform.');
  await execFileAsync(ffmpegPath, [
    '-y',
    '-i', inputPath,
    '-ac', '1',
    '-ar', '16000',
    '-f', 'wav',
    outputPath,
  ]);
}

export interface TranscriptionResult {
  transcription: string;
  durationHint?: number;
}

/**
 * Decodes base64 audio of an arbitrary browser-recorded MIME type, converts it
 * to 16kHz mono PCM via ffmpeg, and transcribes it locally with Whisper
 * (through transformers.js). Entirely offline after the model is first downloaded.
 */
export async function transcribeAudio(base64Audio: string, mimeType: string): Promise<TranscriptionResult> {
  const ext = MIME_TO_EXT[mimeType] || 'webm';
  const dir = await mkdtemp(path.join(tmpdir(), 'obessu-audio-'));
  const inputPath = path.join(dir, `input.${ext}`);
  const outputPath = path.join(dir, 'output.wav');

  try {
    await writeFile(inputPath, Buffer.from(base64Audio, 'base64'));
    await convertToWav16kMono(inputPath, outputPath);
    const wavBuffer = await readFile(outputPath);
    const pcm = decodeWavPcm16(wavBuffer);

    const transcriber = await getTranscriber();
    const output = await transcriber(pcm, { chunk_length_s: 30, stride_length_s: 5 });
    const text = Array.isArray(output) ? output.map((o: any) => o.text).join(' ') : (output as any).text;

    return { transcription: (text || '').trim() };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Replicate MusicGen service — implements MusicGenerationService.
// Uses Meta MusicGen with melody conditioning when a reference sample is provided.
//
// Security note: the API key travels in request headers and is visible in
// DevTools network tab. For production, route calls through a Supabase Edge
// Function (or any server proxy) so the key stays server-side.

import type { MusicGenerationService, GenerationParams, GenerationResult } from './generationService';

// Replicate's official MusicGen deployment — no version hash needed
const MUSICGEN_ENDPOINT = 'https://api.replicate.com/v1/models/meta/musicgen/predictions';

export class ReplicateMusicGenService implements MusicGenerationService {
  readonly modelName = 'Meta MusicGen (Replicate)';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey.trim();
  }

  isConfigured(): boolean {
    return this.apiKey.length > 10;
  }

  async generate(
    params: GenerationParams,
    onProgress?: (status: string, pct: number) => void
  ): Promise<GenerationResult> {
    const { prompt, referenceAudioUrl, duration, bpm, key, mode } = params;

    // Build a richer prompt that incorporates the detected musical analysis
    let enrichedPrompt = prompt.trim();
    const tags: string[] = [];
    if (bpm) tags.push(`${bpm} BPM`);
    if (key) tags.push(`${key} ${mode ?? 'major'}`);
    if (tags.length) enrichedPrompt += `. ${tags.join(', ')}.`;

    const usesMelody = !!referenceAudioUrl;
    // "melody" model version supports audio conditioning; "large" is highest quality without it
    const modelVersion = usesMelody ? 'melody' : 'large';

    const input: Record<string, unknown> = {
      prompt: enrichedPrompt,
      model_version: modelVersion,
      // MusicGen cap is 30s per generation; use continuation for longer clips in the future
      duration: Math.min(Math.max(Math.round(duration), 5), 30),
      normalization_strategy: 'peak',
      top_k: 250,
      temperature: 1.0,
      output_format: 'wav',
    };

    if (usesMelody && referenceAudioUrl) {
      onProgress?.('Encoding reference audio…', 5);
      try {
        input.melody = await this.toDataUri(referenceAudioUrl);
      } catch (e) {
        // If encoding fails (e.g. URL expired), fall back to text-only generation
        console.warn('Could not encode reference audio; falling back to text-only generation', e);
      }
    }

    onProgress?.('Starting generation on Replicate…', 10);

    const createRes = await fetch(MUSICGEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as Record<string, unknown>;
      const detail = typeof err.detail === 'string' ? err.detail : '';
      throw new Error(detail || `Replicate error ${createRes.status}: ${createRes.statusText}`);
    }

    let prediction = await createRes.json() as ReplicatePrediction;

    // Poll for completion (max 3 minutes)
    let attempts = 0;
    while (
      prediction.status !== 'succeeded' &&
      prediction.status !== 'failed' &&
      prediction.status !== 'canceled' &&
      attempts < 90
    ) {
      await sleep(2000);
      attempts++;
      const elapsed = attempts * 2;
      onProgress?.(`Generating… ${elapsed}s elapsed`, Math.min(10 + elapsed * 2, 90));

      const pollRes = await fetch(prediction.urls.get, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!pollRes.ok) continue;
      prediction = await pollRes.json() as ReplicatePrediction;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(
        typeof prediction.error === 'string'
          ? prediction.error
          : 'Generation failed on Replicate'
      );
    }

    if (prediction.status !== 'succeeded') {
      throw new Error('Generation timed out after 3 minutes. Try a shorter duration.');
    }

    onProgress?.('Complete!', 100);

    const raw = prediction.output;
    const audioUrl = Array.isArray(raw) ? (raw as string[])[0] : (raw as string);
    return {
      audioUrl,
      enrichedPrompt,
      duration: Math.round(duration),
      model: this.modelName,
      usedReference: usesMelody && !!input.melody,
    };
  }

  private async toDataUri(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not fetch reference audio: ${res.status}`);
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: unknown;
  error?: unknown;
  urls: { get: string; cancel: string };
}

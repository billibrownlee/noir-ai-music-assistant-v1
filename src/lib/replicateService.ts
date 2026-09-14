// Replicate MusicGen service — implements MusicGenerationService.
// Uses Meta MusicGen with melody conditioning when a reference sample is provided.
//
// Dev:  requests go through the Vite dev-server proxy (/api/replicate → replicate.com)
// Prod: requests go through the Supabase Edge Function so the API key stays server-side.

import type { MusicGenerationService, GenerationParams, GenerationResult } from './generationService';
import { supabase } from '@/integrations/supabase/client';

// Dev-only proxy (see vite.config.ts)
const BASE = '/api/replicate';
const MODEL_INFO_URL = `${BASE}/v1/models/meta/musicgen`;
const PREDICTIONS_URL = `${BASE}/v1/predictions`;

// Cache the version hash so we only look it up once per session.
let cachedVersion: string | null = null;

export class ReplicateMusicGenService implements MusicGenerationService {
  readonly modelName = 'Meta MusicGen (Replicate)';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey.trim();
  }

  isConfigured(): boolean {
    // In production the key lives server-side in the Edge Function environment
    if (import.meta.env.PROD) return true;
    return this.apiKey.length > 10;
  }

  // Fetch the latest public version hash for meta/musicgen.
  private async getVersion(): Promise<string> {
    if (cachedVersion) return cachedVersion;

    const res = await fetch(MODEL_INFO_URL, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Could not look up MusicGen version (${res.status}): ${body.slice(0, 200)}`);
    }

    const data = await res.json() as Record<string, any>;
    const version: string | undefined = data?.latest_version?.id;
    if (!version) throw new Error('MusicGen model info did not contain a version ID.');

    cachedVersion = version;
    return version;
  }

  async generate(
    params: GenerationParams,
    onProgress?: (status: string, pct: number) => void
  ): Promise<GenerationResult> {
    const { prompt, referenceAudioUrl, duration, bpm, key, mode } = params;

    // Enrich the text prompt with detected musical context
    let enrichedPrompt = prompt.trim();
    const tags: string[] = [];
    if (bpm) tags.push(`${bpm} BPM`);
    if (key) tags.push(`${key} ${mode ?? 'major'}`);
    if (tags.length) enrichedPrompt += `. ${tags.join(', ')}.`;

    const safeDuration = Math.min(Math.max(Math.round(duration), 5), 30);

    // ── Production: route through Edge Function (key stays server-side) ──────
    if (import.meta.env.PROD) {
      onProgress?.('Starting generation…', 10);
      const publicRefUrl =
        typeof referenceAudioUrl === 'string' && referenceAudioUrl.startsWith('http')
          ? referenceAudioUrl
          : undefined;

      const { data, error } = await supabase.functions.invoke('generate-music', {
        body: {
          prompt: enrichedPrompt,
          duration: safeDuration,
          style: '',              // style already baked into enrichedPrompt
          referenceAudioUrl: publicRefUrl,
        },
      });

      if (error) throw new Error(error.message ?? 'Edge Function error');
      if (data?.error) throw new Error(data.error);
      if (!data?.audioUrl) throw new Error('No audio URL returned from Edge Function');

      onProgress?.('Complete!', 100);
      return {
        audioUrl: data.audioUrl as string,
        enrichedPrompt,
        duration: safeDuration,
        model: this.modelName,
        usedReference: !!publicRefUrl,
      };
    }

    const usesMelody = !!referenceAudioUrl;
    // melody-large supports audio conditioning; large is highest quality without it
    let modelVersion = usesMelody ? 'melody-large' : 'large';

    const input: Record<string, unknown> = {
      prompt: enrichedPrompt,
      model_version: modelVersion,
      duration: safeDuration,
      normalization_strategy: 'peak',
      top_k: 250,
      temperature: 1.0,
      output_format: 'wav',
    };

    if (usesMelody && referenceAudioUrl) {
      onProgress?.('Encoding reference audio…', 5);
      try {
        const dataUri = await this.toDataUri(referenceAudioUrl);
        // Base64 inflates by ~33%; skip melody conditioning if result is huge
        if (dataUri.length * 0.75 > 80 * 1024 * 1024) {
          console.warn('Reference audio >80 MB encoded — skipping melody conditioning');
          onProgress?.('Reference too large — using text-only…', 8);
          input.model_version = 'large';
        } else {
          input.melody = dataUri;
        }
      } catch (e) {
        console.warn('Could not encode reference audio — falling back to text-only:', e);
        input.model_version = 'large';
      }
    }

    onProgress?.('Looking up MusicGen version…', 8);
    const version = await this.getVersion();

    onProgress?.('Starting generation on Replicate…', 10);

    const createRes = await fetch(PREDICTIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({ version, input }),
    });

    if (!createRes.ok) {
      const body = await createRes.json().catch(() => ({})) as Record<string, unknown>;
      const msg =
        (typeof body.detail === 'string' ? body.detail : '') ||
        (typeof body.error === 'string' ? body.error : '') ||
        (Array.isArray(body.detail)
          ? (body.detail as any[]).map((d: any) => d?.msg ?? JSON.stringify(d)).join('; ')
          : '');
      throw new Error(msg || `Replicate ${createRes.status}: ${createRes.statusText}`);
    }

    let prediction = await createRes.json() as ReplicatePrediction;

    // Poll for completion (max 3 minutes, 2 s interval)
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

      // Rewrite the absolute Replicate URL through our local proxy
      const pollUrl = prediction.urls.get.replace('https://api.replicate.com', BASE);
      const pollRes = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!pollRes.ok) continue;
      prediction = await pollRes.json() as ReplicatePrediction;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(
        typeof prediction.error === 'string'
          ? prediction.error
          : 'Generation failed on Replicate.'
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
      duration: safeDuration,
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

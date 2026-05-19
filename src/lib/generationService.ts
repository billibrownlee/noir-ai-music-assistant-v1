// Abstract music generation interface.
// Today: Replicate (MusicGen). Tomorrow: swap in your own trained model
// by implementing this interface and updating the service factory below.

export interface GenerationParams {
  prompt: string;
  /** Blob URL or remote URL of an uploaded sample to use as melodic reference */
  referenceAudioUrl?: string;
  referenceAudioName?: string;
  style: string;
  duration: number;
  bpm?: number;
  key?: string;
  mode?: 'major' | 'minor';
  instrumental?: boolean;
}

export interface GenerationResult {
  audioUrl: string;
  enrichedPrompt: string;
  duration: number;
  /** Human-readable model name shown in the UI */
  model: string;
  usedReference: boolean;
}

export interface MusicGenerationService {
  readonly modelName: string;
  isConfigured(): boolean;
  generate(
    params: GenerationParams,
    onProgress?: (status: string, pct: number) => void
  ): Promise<GenerationResult>;
}

// ----- Key management (stored in localStorage, never sent to your backend) -----

const STORAGE_KEY = 'noir_replicate_api_key';

export function getStoredApiKey(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? ''; } catch { return ''; }
}

export function saveApiKey(key: string): void {
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

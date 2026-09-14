import { supabase } from '@/integrations/supabase/client';

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const SCALE_PATTERNS: Record<string, number[]> = {
  pentatonic_minor: [0,3,5,7,10],
  minor:            [0,2,3,5,7,8,10],
  major:            [0,2,4,5,7,9,11],
  pentatonic_major: [0,2,4,7,9],
  blues:            [0,3,5,6,7,10],
  dorian:           [0,2,3,5,7,9,10],
};

export const GENRE_OPTIONS = [
  'trap','hip-hop','r&b','drill','pop','soul','funk','lo-fi','afrobeats',
];

export const KEY_OPTIONS = NOTES;

export const SCALE_OPTIONS = [
  { value: 'pentatonic_minor', label: 'Pentatonic Minor' },
  { value: 'minor',            label: 'Natural Minor' },
  { value: 'major',            label: 'Major' },
  { value: 'pentatonic_major', label: 'Pentatonic Major' },
  { value: 'blues',            label: 'Blues' },
  { value: 'dorian',           label: 'Dorian' },
];

export interface MelodyNote {
  note: string;
  beats: number;
  time: number;
  velocity: number;
}

export interface GeneratorParams {
  genre: string;
  key: string;
  scale: string;
  bpm: number;
  bars: number;
  prompt: string;
}

export interface StyleProfile {
  sampleCount: number;
  primaryGenre: string;
  genreBreakdown: { genre: string; count: number; pct: number }[];
  estimatedBpm: number;
  primaryKey: string;
  hasEnoughData: boolean;
}

export function getScaleNotes(root: string, scale: string): string[] {
  const rootIdx = NOTES.indexOf(root);
  if (rootIdx === -1) return [];
  const pattern = SCALE_PATTERNS[scale] ?? SCALE_PATTERNS.minor;
  const result: string[] = [];
  for (const oct of [3, 4, 5]) {
    for (const interval of pattern) {
      const noteIdx = (rootIdx + interval) % 12;
      result.push(`${NOTES[noteIdx]}${oct}`);
    }
  }
  return result;
}

export function noteToMidi(name: string): number {
  const m = name.match(/([A-G]#?)(\d+)/);
  if (!m) return 60;
  const idx = NOTES.indexOf(m[1]);
  return (parseInt(m[2]) + 1) * 12 + (idx === -1 ? 0 : idx);
}

export function buildStyleProfile(samples: any[]): StyleProfile {
  if (!samples || samples.length === 0) {
    return {
      sampleCount: 0, primaryGenre: 'trap', genreBreakdown: [],
      estimatedBpm: 140, primaryKey: 'C', hasEnoughData: false,
    };
  }

  const genreCounts: Record<string, number> = {};
  let bpmSum = 0, bpmCount = 0;
  const keyCounts: Record<string, number> = {};

  for (const s of samples) {
    const raw = (s.genre || s.tags?.[0] || 'general').toLowerCase().trim();
    genreCounts[raw] = (genreCounts[raw] ?? 0) + 1;

    if (s.bpm && s.bpm > 40 && s.bpm < 300) {
      bpmSum += s.bpm; bpmCount++;
    }

    if (s.key && typeof s.key === 'string') {
      const root = s.key.trim().replace(/m$/, '').replace(/\s.*/, '');
      if (NOTES.includes(root)) {
        keyCounts[root] = (keyCounts[root] ?? 0) + 1;
      }
    }
  }

  const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
  const total = samples.length;
  const genreBreakdown = sortedGenres.map(([genre, count]) => ({
    genre, count, pct: Math.round((count / total) * 100),
  }));

  const primaryGenre = sortedGenres[0]?.[0] ?? 'trap';
  const estimatedBpm = bpmCount > 0 ? Math.round(bpmSum / bpmCount) : 140;
  const primaryKey = Object.entries(keyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'C';

  return {
    sampleCount: samples.length,
    primaryGenre,
    genreBreakdown,
    estimatedBpm,
    primaryKey,
    hasEnoughData: samples.length >= 3,
  };
}

const GENRE_TIPS: Record<string, string> = {
  trap:      'sparse rhythmic runs, lots of 16th rests, emotional high notes on beats 1 and 3',
  'hip-hop': 'soulful mid-range phrases, call-and-response 2-bar motifs',
  'r&b':     'smooth legato lines, ornamental grace notes, chord-tone landing notes',
  drill:     'dark repetitive hook, minor tension, descending phrases',
  pop:       'catchy singable contour, stepwise motion, strong downbeat arrivals',
  soul:      'expressive wide dynamics, gospel-influenced scalar runs',
  funk:      'syncopated rhythmic stabs, groove-first over melody',
  'lo-fi':   'simple nostalgic phrases, gentle dynamics, sparse and breathing',
  afrobeats: 'bright pentatonic, polyrhythmic syncopation, call-and-response',
};

export async function generateMelodyWithAI(
  params: GeneratorParams,
  openaiKey: string,
  styleProfile: StyleProfile | null,
): Promise<MelodyNote[]> {
  const scaleNotes = getScaleNotes(params.key, params.scale);
  const totalBeats = params.bars * 4;

  const libraryCtx = styleProfile?.hasEnoughData
    ? `\nNoir's analysis of the user's sample library (${styleProfile.sampleCount} samples):
- Dominant style: ${styleProfile.primaryGenre}
- Common key: ${styleProfile.primaryKey}
- Avg BPM: ${styleProfile.estimatedBpm}
- Style mix: ${styleProfile.genreBreakdown.slice(0, 3).map(g => `${g.genre} ${g.pct}%`).join(', ')}`
    : '';

  const tip = GENRE_TIPS[params.genre.toLowerCase()] ?? 'expressive and musical';

  const systemPrompt =
    `You are an expert music composer who generates melodies as JSON. ` +
    `Return ONLY valid JSON — no markdown, no explanation.`;

  const userPrompt =
    `Generate a ${params.bars}-bar ${params.genre} melody in ${params.key} ${params.scale} at ${params.bpm} BPM.` +
    (params.prompt ? `\nStyle notes: ${params.prompt}` : '') +
    libraryCtx +
    `\n\nAvailable notes (use ONLY these): ${scaleNotes.join(', ')}` +
    `\n\nReturn {"notes": [...]} where each note is:` +
    `\n{"note":"C4","beats":0.5,"time":0.0,"velocity":0.8}` +
    `\n- beats: 0.25 (16th) | 0.5 (8th) | 1 (quarter) | 1.5 (dotted quarter) | 2 (half)` +
    `\n- time: start beat, 0 to ${totalBeats - 0.25}, no two notes starting at same time` +
    `\n- velocity: 0.3–1.0, vary for dynamics` +
    `\n- Total span: ${totalBeats} beats; cover at least ${Math.round(totalBeats * 0.55)} beats` +
    `\n- Style tip for ${params.genre}: ${tip}`;

  const requestBody = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.88,
    max_tokens: 2048,
    response_format: { type: 'json_object' },
  };

  let data: any;

  if (import.meta.env.PROD) {
    // Production: route through Supabase Edge Function — key stays server-side
    const { data: fnData, error: fnError } = await supabase.functions.invoke('openai-chat', {
      body: requestBody,
    });
    if (fnError) throw new Error(fnError.message ?? 'openai-chat Edge Function error');
    if (fnData?.error) throw new Error(fnData.error.message ?? fnData.error);
    data = fnData;
  } else {
    // Dev: route through Vite proxy (/api/openai → api.openai.com)
    const res = await fetch('/api/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as any;
      throw new Error(err?.error?.message ?? `OpenAI ${res.status}: ${res.statusText}`);
    }
    data = await res.json();
  }

  const content: string = data.choices?.[0]?.message?.content ?? '{}';

  let parsed: any;
  try { parsed = JSON.parse(content); } catch {
    throw new Error('Could not parse melody from AI response');
  }

  const raw: any[] = parsed.notes ?? parsed.melody ?? [];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('AI returned an empty melody — try adjusting the prompt and regenerating');
  }

  return raw
    .filter(n => typeof n.note === 'string' && typeof n.beats === 'number' && typeof n.time === 'number')
    .map(n => ({
      note: n.note,
      beats: Math.max(0.25, Math.min(4, n.beats)),
      time: Math.max(0, n.time),
      velocity: Math.max(0.1, Math.min(1.0, n.velocity ?? 0.7)),
    }))
    .sort((a, b) => a.time - b.time);
}

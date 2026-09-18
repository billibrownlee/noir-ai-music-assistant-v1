import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Music, Volume2, Download, Play, Pause, Sparkles, Mic, Key,
  ChevronDown, ChevronUp, CheckCircle, AudioLines, Pencil,
  Trash2, Bookmark, BookmarkCheck,
} from 'lucide-react';
import { VocalEditor } from './VocalEditor';
import { saveSampleToDB } from '@/lib/sampleStorage';
import { useToast } from '@/hooks/use-toast';
import { useGlobalAudio } from '@/hooks/useGlobalAudio';
import { getStoredApiKey } from '@/lib/generationService';

// ── Proxied endpoints ─────────────────────────────────────────────────────────
const OPENAI_TTS      = '/api/openai/v1/audio/speech';
const REPLICATE_BASE  = '/api/replicate';
const REPLICATE_PREDS = `${REPLICATE_BASE}/v1/predictions`;

// ── LocalStorage ──────────────────────────────────────────────────────────────
const OAI_KEY = 'noir_openai_api_key';
function loadKey(k: string) { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } }
function storeKey(k: string, v: string) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} }

// ── Version cache (XTTS-v2) ───────────────────────────────────────────────────
let xttsVersion: string | null = null;
async function getXttsVersion(apiKey: string): Promise<string> {
  if (xttsVersion) return xttsVersion;
  const res = await fetch(`${REPLICATE_BASE}/v1/models/lucataco/xtts-v2`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Could not fetch XTTS-v2 model info (${res.status})`);
  const data = await res.json() as any;
  const v = data?.latest_version?.id;
  if (!v) throw new Error('XTTS-v2 version not found in model info');
  xttsVersion = v;
  return v;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Types ─────────────────────────────────────────────────────────────────────
interface UploadedSample { id: string; name: string; audioUrl?: string; }
interface GeneratedAudio {
  id: string; text: string; voice: string; model: string; audioUrl: string; timestamp: Date;
}
interface AudioGeneratorProps {
  onAudioGenerated?: (audio: GeneratedAudio) => void;
  uploadedSamples?: UploadedSample[];
}

const PRESET_VOICES = [
  { value: 'nova',    label: 'Nova',    description: 'Bright, energetic female' },
  { value: 'alloy',   label: 'Alloy',   description: 'Neutral, balanced' },
  { value: 'echo',    label: 'Echo',    description: 'Deep, resonant male' },
  { value: 'fable',   label: 'Fable',   description: 'Warm, storytelling' },
  { value: 'onyx',    label: 'Onyx',    description: 'Rich, authoritative male' },
  { value: 'shimmer', label: 'Shimmer', description: 'Clear, soft female' },
];

const OAI_MODELS = [
  { value: 'tts-1-hd', label: 'TTS-1-HD', description: 'Highest quality' },
  { value: 'tts-1',    label: 'TTS-1',    description: 'Faster, standard quality' },
];

// ─────────────────────────────────────────────────────────────────────────────

export const AudioGenerator: React.FC<AudioGeneratorProps> = ({
  onAudioGenerated,
  uploadedSamples = [],
}) => {
  const [mode, setMode] = useState<'preset' | 'clone'>('preset');
  const [text, setText] = useState('');
  const [speed, setSpeed] = useState([1.0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [generatedAudios, setGeneratedAudios] = useState<GeneratedAudio[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keptIds, setKeptIds] = useState<Set<string>>(new Set());

  // OpenAI preset
  const [oaiKey, setOaiKey]           = useState(() => loadKey(OAI_KEY));
  const [oaiKeyInput, setOaiKeyInput] = useState('');
  const [showOaiSettings, setShowOaiSettings] = useState(!loadKey(OAI_KEY));
  const [voice, setVoice]             = useState('nova');
  const [oaiModel, setOaiModel]       = useState('tts-1-hd');

  // Replicate voice clone
  const replicateKey = getStoredApiKey(); // same key the user set up for MusicGen
  const [selectedSampleId, setSelectedSampleId] = useState('none');

  const { toast } = useToast();
  const { currentTrack, isPlaying, playTrack } = useGlobalAudio();
  const samplesWithAudio = uploadedSamples.filter(s => s.audioUrl);

  // ── Key helpers ──────────────────────────────────────────────────────────────
  const saveOaiKey = () => {
    const k = oaiKeyInput.trim();
    if (!k.startsWith('sk-')) {
      toast({ title: 'Invalid key', description: 'OpenAI keys start with "sk-"', variant: 'destructive' });
      return;
    }
    storeKey(OAI_KEY, k); setOaiKey(k); setOaiKeyInput(''); setShowOaiSettings(false);
    toast({ title: 'OpenAI key saved' });
  };

  // ── Generate (preset — OpenAI TTS) ──────────────────────────────────────────
  const generatePreset = async () => {
    const res = await fetch(OPENAI_TTS, {
      method: 'POST',
      headers: { Authorization: `Bearer ${oaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: oaiModel, input: text.trim(), voice, speed: speed[0], response_format: 'mp3' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as any;
      throw new Error(err?.error?.message ?? `OpenAI ${res.status}: ${res.statusText}`);
    }
    const buf = await res.arrayBuffer();
    return { audioUrl: URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' })), voiceLabel: voice, modelLabel: oaiModel };
  };

  // ── Generate (clone — Replicate XTTS-v2) ────────────────────────────────────
  const generateClone = async () => {
    const sample = samplesWithAudio.find(s => s.id === selectedSampleId);
    if (!sample?.audioUrl) throw new Error('No reference sample selected');
    if (!replicateKey) throw new Error('No Replicate API key — set it up in the Generate tab first');

    setProgressMsg('Encoding voice reference…');
    const audioRes = await fetch(sample.audioUrl);
    if (!audioRes.ok) throw new Error('Could not read reference audio');
    const blob = await audioRes.blob();
    const dataUri = await blobToDataUri(blob);

    setProgressMsg('Looking up XTTS-v2 version…');
    const version = await getXttsVersion(replicateKey);

    setProgressMsg('Starting voice synthesis on Replicate…');
    const createRes = await fetch(REPLICATE_PREDS, {
      method: 'POST',
      headers: { Authorization: `Bearer ${replicateKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version,
        input: {
          text: text.trim(),
          speaker: dataUri,
          language: 'en',
          cleanup_voice: true,
        },
      }),
    });
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as any;
      const msg = err?.detail ?? err?.error ?? `Replicate ${createRes.status}: ${createRes.statusText}`;
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }

    let prediction = await createRes.json() as any;

    // Poll
    let attempts = 0;
    while (!['succeeded', 'failed', 'canceled'].includes(prediction.status) && attempts < 90) {
      await sleep(2000);
      attempts++;
      setProgressMsg(`Synthesizing… ${attempts * 2}s`);
      const pollUrl = prediction.urls.get.replace('https://api.replicate.com', REPLICATE_BASE);
      const pollRes = await fetch(pollUrl, { headers: { Authorization: `Bearer ${replicateKey}` } });
      if (pollRes.ok) prediction = await pollRes.json();
    }

    if (prediction.status !== 'succeeded') {
      throw new Error(prediction.error ?? 'Voice synthesis failed or timed out');
    }

    const outputUrl: string = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    return { audioUrl: outputUrl, voiceLabel: sample.name, modelLabel: 'XTTS-v2 (Replicate)' };
  };

  // ── Main generate handler ────────────────────────────────────────────────────
  const generate = async () => {
    if (!text.trim()) {
      toast({ title: 'Lyrics required', variant: 'destructive' }); return;
    }
    if (mode === 'preset' && !oaiKey) {
      toast({ title: 'OpenAI key required', variant: 'destructive' }); return;
    }
    if (mode === 'clone' && selectedSampleId === 'none') {
      toast({ title: 'Select a voice reference', description: 'Pick one of your uploaded samples.', variant: 'destructive' }); return;
    }

    setIsGenerating(true);
    setProgressMsg(mode === 'preset' ? 'Generating vocal…' : 'Preparing…');
    try {
      const { audioUrl, voiceLabel, modelLabel } =
        mode === 'preset' ? await generatePreset() : await generateClone();

      const generated: GeneratedAudio = {
        id: crypto.randomUUID(), text: text.trim(), voice: voiceLabel,
        model: modelLabel, audioUrl, timestamp: new Date(),
      };
      setGeneratedAudios(prev => [generated, ...prev]);
      setText('');
      onAudioGenerated?.(generated);
      toast({ title: 'Vocal generated!', description: `${voiceLabel} · ${modelLabel}` });
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
      setProgressMsg('');
    }
  };

  const playAudio = (a: GeneratedAudio) =>
    playTrack({ id: a.id, name: `Vocal: ${a.text.substring(0, 40)}`, audioUrl: a.audioUrl }).catch(console.error);

  const downloadAudio = (a: GeneratedAudio) => {
    const el = document.createElement('a');
    el.href = a.audioUrl;
    el.download = `vocal_${a.voice.replace(/\s+/g, '_')}_${Date.now()}.mp3`;
    el.click();
  };

  const deleteAudio = (id: string) => {
    setGeneratedAudios(prev => prev.filter(a => a.id !== id));
    if (editingId === id) setEditingId(null);
    setKeptIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const keepAudio = async (a: GeneratedAudio) => {
    try {
      const res = await fetch(a.audioUrl);
      if (!res.ok) throw new Error('Could not read audio');
      const buf = await res.arrayBuffer();
      const ext = a.model.includes('WAV') ? 'wav' : 'mp3';
      const mime = ext === 'wav' ? 'audio/wav' : 'audio/mpeg';
      const fileName = `${a.voice.replace(/\s+/g, '_')}_${Date.now()}.${ext}`;
      const file = new File([buf], fileName, { type: mime });
      await saveSampleToDB(
        { id: a.id, name: `${a.voice} vocal`, genre: 'vocal', tags: ['vocal', 'generated'] },
        file,
      );
      setKeptIds(prev => new Set(prev).add(a.id));
      toast({ title: 'Saved to library', description: 'Find it in the Upload & Library tab.' });
    } catch (err: any) {
      toast({ title: 'Could not save', description: err.message, variant: 'destructive' });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  const replicateReady = replicateKey.length > 10;

  return (
    <Card className="w-full glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          <Mic className="w-5 h-5 text-neon-blue" />
          Lyrics Voice Generator
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* Mode switcher */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={mode === 'preset' ? 'default' : 'outline'}
            className={mode === 'preset' ? 'bg-neon-blue hover:bg-neon-blue/80 text-white' : ''}
            onClick={() => setMode('preset')}
          >
            <Sparkles className="w-4 h-4 mr-2" /> AI Preset Voice
          </Button>
          <Button
            variant={mode === 'clone' ? 'default' : 'outline'}
            className={mode === 'clone' ? 'bg-primary hover:bg-primary/80 text-white' : ''}
            onClick={() => setMode('clone')}
          >
            <AudioLines className="w-4 h-4 mr-2" /> Clone My Voice
          </Button>
        </div>

        {/* ── PRESET MODE ────────────────────────────────────────────────── */}
        {mode === 'preset' && (
          <>
            <Collapsible open={showOaiSettings} onOpenChange={setShowOaiSettings}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full flex justify-between items-center p-3 h-auto bg-studio-surface/30 rounded-lg border border-border/30">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Key className="w-4 h-4 text-neon-blue" />
                    {oaiKey ? 'OpenAI connected' : 'Connect OpenAI'}
                  </span>
                  {showOaiSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-3 p-3 bg-studio-surface/20 rounded-lg border border-border/30">
                {oaiKey ? (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-neon-green flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Connected
                    </p>
                    <Button size="sm" variant="outline" className="text-red-400 border-red-400/30"
                      onClick={() => { storeKey(OAI_KEY, ''); setOaiKey(''); setShowOaiSettings(true); }}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Get a key at <span className="text-neon-blue">platform.openai.com/api-keys</span> (starts with sk-)
                    </p>
                    <div className="flex gap-2">
                      <Input type="password" placeholder="sk-••••••••••••" value={oaiKeyInput}
                        onChange={e => setOaiKeyInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveOaiKey()}
                        className="font-mono text-sm" />
                      <Button onClick={saveOaiKey} className="bg-primary hover:bg-primary/80 shrink-0">Save</Button>
                    </div>
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={oaiModel} onValueChange={setOaiModel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OAI_MODELS.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        <div><div className="font-medium">{m.label}</div><div className="text-xs text-muted-foreground">{m.description}</div></div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Voice</Label>
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRESET_VOICES.map(v => (
                      <SelectItem key={v.value} value={v.value}>
                        <div><div className="font-medium">{v.label}</div><div className="text-xs text-muted-foreground">{v.description}</div></div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}

        {/* ── CLONE MODE ─────────────────────────────────────────────────── */}
        {mode === 'clone' && (
          <div className="space-y-3 p-3 bg-studio-surface/20 rounded-lg border border-primary/30">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <AudioLines className="w-4 h-4 text-primary" />
                Voice Reference
              </Label>
              {replicateReady
                ? <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30 text-xs"><CheckCircle className="w-3 h-3 mr-1" />Replicate ready</Badge>
                : <Badge variant="destructive" className="text-xs">No Replicate key — set up in Generate tab</Badge>
              }
            </div>

            {samplesWithAudio.length === 0 ? (
              <p className="text-xs text-amber-400">
                Upload a song in the Upload &amp; Library tab first, then pick it here as your voice reference.
              </p>
            ) : (
              <>
                <Select value={selectedSampleId} onValueChange={setSelectedSampleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a sample as your voice…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pick a sample…</SelectItem>
                    {samplesWithAudio.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>XTTS-v2 reads the vocal style from your sample and synthesizes your lyrics in that voice — no separate clone step, no extra account.</p>
                  <p className="text-amber-400/80">Tip: an isolated vocal stem clones cleaner than a full mix. Even 10–30 sec of clean vocals works well.</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Lyrics input ───────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label htmlFor="lyrics-input">
            Lyrics / Text
            <span className="text-xs text-muted-foreground ml-2 font-normal">{text.length}/4096</span>
          </Label>
          <Textarea
            id="lyrics-input"
            placeholder={"Type your lyrics here…\n\nVerse 1:\nI been in the zone all night…"}
            value={text}
            onChange={e => setText(e.target.value)}
            rows={6}
            className="resize-none font-mono text-sm"
          />
        </div>

        {/* Speed (preset only — XTTS doesn't expose speed) */}
        {mode === 'preset' && (
          <div className="space-y-2">
            <Label>Speed: {speed[0].toFixed(2)}×</Label>
            <Slider value={speed} onValueChange={setSpeed} min={0.25} max={4.0} step={0.05} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.25× slow</span><span>1.0× normal</span><span>4.0× fast</span>
            </div>
          </div>
        )}

        {/* Generate button */}
        <Button
          onClick={generate}
          disabled={
            isGenerating || !text.trim() ||
            (mode === 'preset' && !oaiKey) ||
            (mode === 'clone' && (selectedSampleId === 'none' || !replicateReady))
          }
          className={`w-full text-white ${mode === 'clone' ? 'bg-primary hover:bg-primary/80' : 'bg-neon-blue hover:bg-neon-blue/80'}`}
          size="lg"
        >
          {isGenerating
            ? <><Volume2 className="w-4 h-4 mr-2 animate-pulse" />{progressMsg || 'Generating…'}</>
            : <><Sparkles className="w-4 h-4 mr-2" />{mode === 'clone' ? 'Generate in My Voice' : 'Generate Vocal'}</>}
        </Button>

        {/* Generated list */}
        {generatedAudios.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <Music className="w-4 h-4" /> Generated Vocals ({generatedAudios.length})
            </h3>
            <div className="space-y-3 overflow-y-auto pr-1">
              {generatedAudios.map(audio => {
                const isCurrent = currentTrack?.id === audio.id;
                const isEditing = editingId === audio.id;
                return (
                  <div key={audio.id} className="space-y-2">
                    <div className="p-3 border border-border/40 rounded-lg space-y-2 bg-card/30">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">{audio.voice}</Badge>
                          <Badge variant="outline" className="text-xs">{audio.model}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{audio.timestamp.toLocaleTimeString()}</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 font-mono">{audio.text}</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline" size="sm"
                          className={`flex-1 ${isCurrent && isPlaying ? 'border-neon-green text-neon-green' : ''}`}
                          onClick={() => playAudio(audio)}
                        >
                          {isCurrent && isPlaying
                            ? <><Pause className="w-3 h-3 mr-1" />Playing</>
                            : <><Play className="w-3 h-3 mr-1" />Play</>}
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className={isEditing ? 'border-primary text-primary' : ''}
                          onClick={() => setEditingId(isEditing ? null : audio.id)}
                          title="Edit vocal"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className={keptIds.has(audio.id) ? 'border-neon-green text-neon-green' : ''}
                          onClick={() => keepAudio(audio)}
                          title={keptIds.has(audio.id) ? 'Saved to library' : 'Keep — save to library'}
                        >
                          {keptIds.has(audio.id)
                            ? <BookmarkCheck className="w-3 h-3" />
                            : <Bookmark className="w-3 h-3" />}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadAudio(audio)} title="Download">
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                          onClick={() => deleteAudio(audio.id)}
                          title="Delete generation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {isEditing && (
                      <VocalEditor
                        audioUrl={audio.audioUrl}
                        trackName={`${audio.voice} – ${audio.text.substring(0, 30)}`}
                        onClose={() => setEditingId(null)}
                        onExported={(url, name) => {
                          const exported: GeneratedAudio = {
                            id: crypto.randomUUID(),
                            text: audio.text,
                            voice: name,
                            model: 'Edited WAV',
                            audioUrl: url,
                            timestamp: new Date(),
                          };
                          setGeneratedAudios(prev => [exported, ...prev]);
                          setEditingId(null);
                          toast({ title: 'Edited vocal added to list' });
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
};

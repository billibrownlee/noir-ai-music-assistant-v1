import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  Music, Play, Pause, Download, Sparkles, Zap, Volume2, Trash2, AlertTriangle,
  MoreHorizontal, Save, Key, ChevronDown, ChevronUp, Link, CheckCircle, AudioLines,
  Wand2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGlobalAudio } from '@/hooks/useGlobalAudio';
import { MusicGenerationEngine } from '@/lib/musicGenerationEngine';
import { ReplicateMusicGenService } from '@/lib/replicateService';
import { getStoredApiKey, saveApiKey } from '@/lib/generationService';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UploadedSample {
  id: string;
  name: string;
  audioUrl?: string;
  genre?: string;
  bpm?: number;
  key?: string;
  mode?: 'major' | 'minor';
  duration?: number;
  tags?: string[];
}

interface GeneratedMusic {
  id: string;
  prompt: string;
  originalPrompt: string;
  audioUrl: string;
  duration: number;
  style: string;
  instrumental: boolean;
  referenceUsed?: string;
  model: string;
  metadata: { bpm: number; key: string; genre: string; energy: number };
  generationTime: number;
  timestamp: Date;
}

interface MusicGeneratorProps {
  uploadedSamples?: UploadedSample[];
  onMusicGenerated?: (music: GeneratedMusic) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MUSIC_STYLES = [
  { value: 'hip-hop', label: 'Hip-Hop / Trap', description: '808s, hard drums, urban vibes' },
  { value: 'rnb', label: 'R&B / Soul', description: 'Smooth, rich harmonies, soulful rhythms' },
  { value: 'pop', label: 'Pop', description: 'Catchy melodies, mainstream appeal' },
  { value: 'electronic', label: 'Electronic / EDM', description: 'Synthesizers, digital beats' },
  { value: 'rock', label: 'Rock', description: 'Guitars, drums, energetic rhythms' },
  { value: 'jazz', label: 'Jazz', description: 'Complex harmonies, improvisation' },
  { value: 'classical', label: 'Classical', description: 'Orchestral, formal structure' },
  { value: 'ambient', label: 'Ambient / Chill', description: 'Atmospheric, relaxing soundscapes' },
  { value: 'funk', label: 'Funk / Soul', description: 'Groovy basslines, rhythmic patterns' },
  { value: 'experimental', label: 'Experimental', description: 'Unique sounds, creative exploration' },
];

const KEY_DEFAULTS: Record<string, string> = {
  'electronic': 'C minor', 'hip-hop': 'F minor', 'rnb': 'Bb major',
  'pop': 'C major', 'rock': 'A minor', 'jazz': 'Bb major',
  'classical': 'C major', 'ambient': 'D minor', 'funk': 'E minor', 'experimental': 'F# minor',
};

const BPM_RANGES: Record<string, { min: number; max: number }> = {
  'electronic': { min: 120, max: 140 }, 'hip-hop': { min: 70, max: 100 },
  'rnb': { min: 70, max: 110 }, 'pop': { min: 100, max: 130 },
  'rock': { min: 110, max: 150 }, 'jazz': { min: 80, max: 120 },
  'classical': { min: 60, max: 100 }, 'ambient': { min: 60, max: 90 },
  'funk': { min: 100, max: 130 }, 'experimental': { min: 80, max: 140 },
};

// ─── Component ───────────────────────────────────────────────────────────────

export const MusicGenerator: React.FC<MusicGeneratorProps> = ({
  uploadedSamples = [],
  onMusicGenerated,
}) => {
  // Core generation state
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('hip-hop');
  const [duration, setDuration] = useState([30]);
  const [instrumental, setInstrumental] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{ status: string; pct: number } | null>(null);
  const [generatedTracks, setGeneratedTracks] = useState<GeneratedMusic[]>([]);

  // Reference audio (melody conditioning) — "none" means no reference selected
  const [referenceId, setReferenceId] = useState<string>('none');

  // API key management
  const [apiKey, setApiKeyState] = useState(() => getStoredApiKey());
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiSettings, setShowApiSettings] = useState(!getStoredApiKey());

  // User / Supabase
  const [user, setUser] = useState<any>(null);
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const { toast } = useToast();
  const { currentTrack, isPlaying, playTrack } = useGlobalAudio();
  const [synthEngine] = useState(() => new MusicGenerationEngine());

  // Samples that have a playable audio URL (usable as reference)
  const referenceCandidates = useMemo(
    () => uploadedSamples.filter(s => s.audioUrl),
    [uploadedSamples]
  );

  const selectedReference = referenceId !== 'none'
    ? (referenceCandidates.find(s => s.id === referenceId) ?? null)
    : null;

  // Auto-suggest prompt when a reference is selected
  const autoPrompt = useMemo(() => {
    if (!selectedReference) return '';
    const parts: string[] = [];
    if (selectedReference.genre) parts.push(selectedReference.genre);
    if (selectedReference.bpm) parts.push(`${selectedReference.bpm} BPM`);
    if (selectedReference.key) parts.push(`key of ${selectedReference.key}${selectedReference.mode === 'minor' ? 'm' : ''}`);
    return parts.length
      ? `Music inspired by "${selectedReference.name}": ${parts.join(', ')}`
      : `Music inspired by "${selectedReference.name}"`;
  }, [selectedReference]);

  // Save API key
  const handleSaveKey = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed.startsWith('r8_')) {
      toast({ title: 'Invalid API key', description: 'Replicate keys start with "r8_"', variant: 'destructive' });
      return;
    }
    saveApiKey(trimmed);
    setApiKeyState(trimmed);
    setApiKeyInput('');
    setShowApiSettings(false);
    toast({ title: 'API key saved', description: 'Noir will now use Replicate for generation.' });
  };

  const handleRemoveKey = () => {
    saveApiKey('');
    setApiKeyState('');
    setShowApiSettings(true);
    toast({ title: 'API key removed', description: 'Noir will use the built-in synthesizer.' });
  };

  // ─── Generate ─────────────────────────────────────────────────────────────

  const generateMusic = async () => {
    const promptText = prompt.trim() || autoPrompt;
    if (!promptText) {
      toast({ title: 'Prompt required', description: 'Describe the music you want to generate.', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    setProgress({ status: 'Starting…', pct: 0 });

    try {
      const startTime = Date.now();
      const bpmRange = BPM_RANGES[style] ?? { min: 80, max: 140 };
      // Prefer BPM from reference sample, fall back to style default
      const bpm = selectedReference?.bpm
        ?? (Math.floor(Math.random() * (bpmRange.max - bpmRange.min + 1)) + bpmRange.min);
      const key = selectedReference?.key ?? (KEY_DEFAULTS[style] ?? 'C major');
      const mode = selectedReference?.mode ?? undefined;

      let audioUrl: string;
      let modelName: string;
      let usedReference = false;

      if (apiKey) {
        // ── Real AI generation via Replicate ────────────────────────────────
        const service = new ReplicateMusicGenService(apiKey);
        const result = await service.generate(
          {
            prompt: promptText,
            referenceAudioUrl: selectedReference?.audioUrl,
            referenceAudioName: selectedReference?.name,
            style,
            duration: duration[0],
            bpm,
            key: key.split(' ')[0],
            mode: mode ?? (key.includes('minor') ? 'minor' : 'major'),
            instrumental,
          },
          (status, pct) => setProgress({ status, pct })
        );
        audioUrl = result.audioUrl;
        modelName = result.model;
        usedReference = result.usedReference;
      } else {
        // ── Fallback: browser-side synthesis ────────────────────────────────
        setProgress({ status: 'Synthesizing locally…', pct: 30 });
        const track = await synthEngine.generateMusic({
          prompt: promptText, style, duration: duration[0], bpm, key, instrumental,
        });
        audioUrl = track.audioUrl;
        modelName = 'Built-in synthesizer';
      }

      const generationTime = (Date.now() - startTime) / 1000;

      const newTrack: GeneratedMusic = {
        id: `gen_${Date.now()}`,
        prompt: promptText,
        originalPrompt: prompt.trim() || autoPrompt,
        audioUrl,
        duration: duration[0],
        style,
        instrumental,
        referenceUsed: usedReference ? selectedReference?.name : undefined,
        model: modelName,
        metadata: { bpm, key, genre: style, energy: Math.random() * 0.5 + 0.5 },
        generationTime,
        timestamp: new Date(),
      };

      setGeneratedTracks(prev => [newTrack, ...prev]);
      setPrompt('');
      onMusicGenerated?.(newTrack);

      toast({
        title: usedReference ? '🎵 Generated with reference!' : '🎵 Music generated!',
        description: `${duration[0]}s ${style} track in ${generationTime.toFixed(1)}s via ${modelName}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Generation failed', description: msg, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  // ─── Track actions ────────────────────────────────────────────────────────

  const playTrackById = (track: GeneratedMusic) => {
    playTrack({ id: track.id, name: track.originalPrompt, audioUrl: track.audioUrl }).catch(console.error);
  };

  const downloadTrack = (track: GeneratedMusic) => {
    const a = document.createElement('a');
    a.href = track.audioUrl;
    a.download = `${track.originalPrompt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: 'Download started', description: track.originalPrompt });
  };

  const deleteTrack = (id: string) => {
    const track = generatedTracks.find(t => t.id === id);
    if (!track) return;
    if (track.audioUrl.startsWith('blob:')) URL.revokeObjectURL(track.audioUrl);
    setGeneratedTracks(prev => prev.filter(t => t.id !== id));
    toast({ title: 'Track deleted', description: track.originalPrompt });
  };

  const saveTrack = async (track: GeneratedMusic) => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Sign in to save tracks.', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from('saved_generated_music').insert({
        user_id: user.id, original_id: track.id, prompt: track.prompt,
        original_prompt: track.originalPrompt, audio_url: track.audioUrl,
        duration: track.duration, style: track.style, instrumental: track.instrumental,
        metadata: track.metadata, generation_time: track.generationTime,
      });
      if (error) throw error;
      toast({ title: 'Saved', description: track.originalPrompt });
    } catch {
      toast({ title: 'Save failed', description: 'Try again.', variant: 'destructive' });
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const selectedStyle = MUSIC_STYLES.find(s => s.value === style);
  const isConfigured = apiKey.length > 10;

  return (
    <Card className="w-full glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          <Music className="w-5 h-5 text-neon-blue" />
          Noir Generate
          {isConfigured ? (
            <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30">
              <CheckCircle className="w-3 h-3 mr-1" /> Replicate AI
            </Badge>
          ) : (
            <Badge variant="secondary">Built-in Synth</Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* ── API Key Setup ─────────────────────────────────────────────── */}
        <Collapsible open={showApiSettings} onOpenChange={setShowApiSettings}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex justify-between items-center p-3 h-auto bg-studio-surface/30 rounded-lg border border-border/30 hover:bg-studio-surface/50">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Key className="w-4 h-4 text-neon-purple" />
                {isConfigured ? 'AI Model: Replicate MusicGen' : 'Connect Replicate for real AI generation'}
              </span>
              {showApiSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            {isConfigured ? (
              <div className="p-3 bg-neon-green/10 border border-neon-green/30 rounded-lg space-y-2">
                <p className="text-sm text-neon-green font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Connected — Meta MusicGen (Replicate)
                </p>
                <p className="text-xs text-muted-foreground">
                  Generating real AI audio with melody conditioning from your uploaded samples. ~$0.02–0.05 per track.
                </p>
                <Button variant="outline" size="sm" onClick={handleRemoveKey} className="text-red-400 border-red-400/30 hover:bg-red-400/10">
                  Remove API key
                </Button>
              </div>
            ) : (
              <div className="space-y-3 p-3 bg-studio-surface/20 rounded-lg border border-border/30">
                <p className="text-sm text-muted-foreground">
                  Enter your Replicate API key to generate real AI music. Without it, Noir uses the browser synthesizer.
                </p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Go to <span className="text-neon-blue">replicate.com</span> → sign up (free)</li>
                  <li>Account → API tokens → Create token</li>
                  <li>Paste your token below (starts with <code>r8_</code>)</li>
                </ol>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="r8_••••••••••••••••••••••••"
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
                    className="font-mono text-sm"
                  />
                  <Button onClick={handleSaveKey} className="bg-neon-purple hover:bg-neon-purple/80 shrink-0">
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Key is stored in your browser only — never sent to Noir's servers.
                </p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* ── Reference Audio (melody conditioning) ────────────────────── */}
        {referenceCandidates.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <AudioLines className="w-4 h-4 text-neon-purple" />
              Reference Sample <span className="text-xs text-muted-foreground font-normal">(melody conditioning)</span>
            </Label>
            <Select value={referenceId} onValueChange={setReferenceId}>
              <SelectTrigger>
                <SelectValue placeholder="None — text-only generation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None — text-only</SelectItem>
                {referenceCandidates.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      {s.name}
                      {s.bpm && <span className="text-xs text-muted-foreground">{s.bpm} BPM</span>}
                      {s.key && <span className="text-xs text-muted-foreground">{s.key}</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedReference && (
              <div className="flex flex-wrap gap-2 mt-1">
                {selectedReference.bpm && <Badge variant="outline" className="text-xs text-neon-green">{selectedReference.bpm} BPM</Badge>}
                {selectedReference.key && <Badge variant="outline" className="text-xs text-neon-purple">{selectedReference.key}{selectedReference.mode === 'minor' ? 'm' : ''}</Badge>}
                {selectedReference.genre && <Badge variant="outline" className="text-xs">{selectedReference.genre}</Badge>}
                {isConfigured && (
                  <Badge className="text-xs bg-neon-blue/20 text-neon-blue border-neon-blue/30">
                    Melody conditioning active
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Prompt ───────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="music-prompt">Describe your track</Label>
            {selectedReference && autoPrompt && !prompt && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-neon-blue h-auto py-0"
                onClick={() => setPrompt(autoPrompt)}
              >
                <Wand2 className="w-3 h-3 mr-1" /> Use auto-prompt
              </Button>
            )}
          </div>
          <Textarea
            id="music-prompt"
            placeholder={
              selectedReference
                ? autoPrompt || 'Describe the vibe you want...'
                : 'e.g. "Dark trap beat with 808 bass and haunting piano melody"'
            }
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={3}
            className="resize-none"
          />
          {!isConfigured && (
            <p className="text-xs text-amber-400">
              No API key — will use browser synthesizer. Add a Replicate key above for real AI audio.
            </p>
          )}
        </div>

        {/* ── Style ────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label>Style</Label>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MUSIC_STYLES.map(s => (
                <SelectItem key={s.value} value={s.value}>
                  <div>
                    <div className="font-medium">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedStyle && <p className="text-xs text-muted-foreground">{selectedStyle.description}</p>}
        </div>

        {/* ── Duration ─────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label>
            Duration: {duration[0]}s
            {isConfigured && duration[0] > 30 && (
              <span className="text-xs text-amber-400 ml-2">(capped at 30s per Replicate limit)</span>
            )}
          </Label>
          <Slider value={duration} onValueChange={setDuration} min={10} max={120} step={5} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>10s</span><span>60s</span><span>120s</span>
          </div>
        </div>

        {/* ── Instrumental toggle ───────────────────────────────────────── */}
        <div className="flex items-center space-x-2">
          <Switch id="instrumental" checked={instrumental} onCheckedChange={setInstrumental} />
          <Label htmlFor="instrumental" className="text-sm">Instrumental only (no vocals)</Label>
        </div>

        {/* ── Generate button ───────────────────────────────────────────── */}
        <Button
          onClick={generateMusic}
          disabled={isGenerating || (!prompt.trim() && !autoPrompt)}
          className="w-full bg-neon-purple hover:bg-neon-purple/80 text-white"
          size="lg"
        >
          {isGenerating ? (
            <><Zap className="w-4 h-4 mr-2 animate-pulse" />Generating…</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />Generate{selectedReference && isConfigured ? ' with Reference' : ''}</>
          )}
        </Button>

        {/* ── Progress ─────────────────────────────────────────────────── */}
        {progress && (
          <div className="space-y-2">
            <Progress value={progress.pct} className="h-2" />
            <p className="text-xs text-muted-foreground text-center animate-pulse">{progress.status}</p>
          </div>
        )}

        {/* ── Generated tracks ──────────────────────────────────────────── */}
        {generatedTracks.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <Volume2 className="w-4 h-4" /> Generated ({generatedTracks.length})
            </h3>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {generatedTracks.map(track => {
                const isCurrent = currentTrack?.id === track.id;
                return (
                  <div key={track.id} className="p-3 border border-border/40 rounded-lg space-y-2 bg-card/30">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{track.originalPrompt}</p>
                        {track.referenceUsed && (
                          <p className="text-xs text-neon-purple truncate">
                            <AudioLines className="w-3 h-3 inline mr-1" />Reference: {track.referenceUsed}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-xs">{track.metadata.bpm} BPM</Badge>
                          <Badge variant="outline" className="text-xs">{track.metadata.key}</Badge>
                          <Badge variant="outline" className="text-xs">{track.style}</Badge>
                          <Badge variant="outline" className="text-xs">{track.duration}s</Badge>
                          <span className="text-xs text-muted-foreground">{track.model}</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {track.generationTime.toFixed(1)}s
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`flex-1 ${isCurrent && isPlaying ? 'border-neon-green text-neon-green' : ''}`}
                        onClick={() => playTrackById(track)}
                      >
                        {isCurrent && isPlaying
                          ? <><Pause className="w-3 h-3 mr-1" />Playing</>
                          : <><Play className="w-3 h-3 mr-1" />Play</>}
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreHorizontal className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => saveTrack(track)}>
                            <Save className="w-4 h-4 mr-2" /> Save to Collection
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadTrack(track)}>
                            <Download className="w-4 h-4 mr-2" /> Download WAV
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                onSelect={e => e.preventDefault()}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <AlertTriangle className="w-5 h-5 text-red-400" /> Delete track?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{track.originalPrompt}" will be permanently removed.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteTrack(track.id)}
                                  className="bg-red-500 hover:bg-red-600 text-white"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Architecture note ─────────────────────────────────────────── */}
        <div className="p-3 bg-studio-surface/20 border border-border/30 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Architecture:</strong> Generation engine is pluggable —
            today it calls Replicate MusicGen. When you're ready to train your own model, swap in a
            custom endpoint here without changing any other code.
            {!isConfigured && (
              <span className="text-amber-400"> Currently using browser synthesizer (no API key).</span>
            )}
          </p>
        </div>

      </CardContent>
    </Card>
  );
};

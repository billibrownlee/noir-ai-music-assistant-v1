import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sparkles, Play, Square, Download, Loader2,
  Music2, Library, Cpu,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  buildStyleProfile, generateMelodyWithAI, noteToMidi,
  GENRE_OPTIONS, KEY_OPTIONS, SCALE_OPTIONS,
  type MelodyNote, type GeneratorParams, type StyleProfile,
} from '@/lib/melodyEngine';

// ── LocalStorage key (same as AudioGenerator) ─────────────────────────────────
const OAI_KEY = 'noir_openai_api_key';
function loadOaiKey() { try { return localStorage.getItem(OAI_KEY) ?? ''; } catch { return ''; } }

// ── Piano roll renderer ────────────────────────────────────────────────────────

function drawPianoRoll(
  canvas: HTMLCanvasElement,
  notes: MelodyNote[],
  bars: number,
  bpm: number,
  playheadSec = -1,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || notes.length === 0) return;

  const W = canvas.width;
  const H = canvas.height;
  const totalBeats = bars * 4;
  const secPerBeat = 60 / bpm;
  const totalSec = totalBeats * secPerBeat;

  const midiVals = notes.map(n => noteToMidi(n.note));
  const minMidi = Math.min(...midiVals) - 1;
  const maxMidi = Math.max(...midiVals) + 2;
  const midiRange = Math.max(maxMidi - minMidi, 12);

  // Background
  ctx.fillStyle = '#07070f';
  ctx.fillRect(0, 0, W, H);

  // Horizontal rows (black keys subtle tint)
  for (let midi = minMidi; midi <= maxMidi; midi++) {
    const isBlack = [1,3,6,8,10].includes(midi % 12);
    if (isBlack) {
      const y = H - ((midi - minMidi) / midiRange) * H;
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(0, y - H / midiRange, W, H / midiRange);
    }
  }

  // Vertical beat grid
  for (let beat = 0; beat <= totalBeats; beat++) {
    const x = (beat / totalBeats) * W;
    const isBar = beat % 4 === 0;
    ctx.strokeStyle = isBar ? '#252540' : '#0f0f20';
    ctx.lineWidth = isBar ? 1.5 : 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Notes
  notes.forEach(note => {
    const midi = noteToMidi(note.note);
    const x = (note.time / totalBeats) * W;
    const nW = Math.max(3, (note.beats / totalBeats) * W - 1.5);
    const rowH = H / (midiRange + 1);
    const y = H - ((midi - minMidi + 0.5) / midiRange) * H;

    // Body
    const bright = 35 + note.velocity * 40;
    ctx.fillStyle = `hsla(270,85%,${bright}%,${0.6 + note.velocity * 0.4})`;
    const r = Math.min(3, nW / 5, rowH / 5);
    ctx.beginPath();
    ctx.roundRect(x, y - rowH * 0.82, nW, rowH * 0.78, r);
    ctx.fill();

    // Highlight stripe on top edge
    ctx.fillStyle = `hsla(285,100%,${bright + 22}%,0.85)`;
    ctx.fillRect(x, y - rowH * 0.82, nW, Math.min(2, rowH * 0.15));

    // Label
    if (nW > 24 && rowH > 9) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = `${Math.min(9, rowH * 0.65)}px monospace`;
      ctx.fillText(note.note, x + 2.5, y - rowH * 0.12);
    }
  });

  // Playhead
  if (playheadSec >= 0 && playheadSec <= totalSec + 0.05) {
    const x = Math.min(W - 1, (playheadSec / totalSec) * W);
    ctx.save();
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, H);
    ctx.stroke();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────

interface MidiGeneratorProps {
  uploadedSamples?: any[];
  seedNotes?: MelodyNote[];
  seedKey?: string;
  seedScale?: string;
}

interface HistoryEntry {
  id: string;
  notes: MelodyNote[];
  params: GeneratorParams;
}

export const MidiGenerator: React.FC<MidiGeneratorProps> = ({
  uploadedSamples = [],
  seedNotes,
  seedKey,
  seedScale,
}) => {
  const styleProfile: StyleProfile = useMemo(
    () => buildStyleProfile(uploadedSamples),
    [uploadedSamples],
  );

  const [params, setParams] = useState<GeneratorParams>({
    genre: 'trap', key: 'C', scale: 'pentatonic_minor', bpm: 140, bars: 4, prompt: '',
  });
  const [profileApplied, setProfileApplied] = useState(false);

  // Once library has enough data, pre-fill params once
  useEffect(() => {
    if (styleProfile.hasEnoughData && !profileApplied) {
      setParams(p => ({
        ...p,
        genre: styleProfile.primaryGenre,
        key: styleProfile.primaryKey || p.key,
        bpm: Math.round(styleProfile.estimatedBpm / 5) * 5,
      }));
      setProfileApplied(true);
    }
  }, [styleProfile.hasEnoughData, styleProfile.primaryGenre, styleProfile.primaryKey, styleProfile.estimatedBpm, profileApplied]);

  const [notes, setNotes] = useState<MelodyNote[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(-1);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const prevSeedRef = useRef<MelodyNote[] | undefined>();

  // Load melodies from the Public Domain Bank when parent pushes new seed notes
  useEffect(() => {
    if (!seedNotes?.length || seedNotes === prevSeedRef.current) return;
    prevSeedRef.current = seedNotes;
    setNotes(seedNotes);
    setPlayheadSec(-1);
    if (seedKey) setParams(p => ({ ...p, key: seedKey }));
    if (seedScale) setParams(p => ({ ...p, scale: seedScale }));
  }, [seedNotes, seedKey, seedScale]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const synthRef = useRef<any>(null);
  const partRef = useRef<any>(null);
  const animRef = useRef<number>(0);
  const toneRef = useRef<any>(null);

  const { toast } = useToast();
  const openaiKey = useMemo(() => loadOaiKey(), []);

  // Redraw whenever notes/params/playhead change
  useEffect(() => {
    if (canvasRef.current && notes.length > 0) {
      drawPianoRoll(canvasRef.current, notes, params.bars, params.bpm, playheadSec);
    }
  }, [notes, params.bars, params.bpm, playheadSec]);

  // ── Generate ───────────────────────────────────────────────────────────────
  const generate = async () => {
    if (!openaiKey) {
      toast({
        title: 'OpenAI key required',
        description: 'Add your key in the AI Audio Generator section.',
        variant: 'destructive',
      });
      return;
    }
    setIsGenerating(true);
    try {
      const generated = await generateMelodyWithAI(params, openaiKey, styleProfile);
      setNotes(generated);
      setPlayheadSec(-1);
      setHistory(prev => [
        { id: crypto.randomUUID(), notes: generated, params: { ...params } },
        ...prev,
      ].slice(0, 8));
      toast({
        title: 'Melody generated!',
        description: `${generated.length} notes · ${params.bars} bars · ${params.key} ${params.scale}`,
      });
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Playback ───────────────────────────────────────────────────────────────
  const stopPlayback = useCallback(async () => {
    cancelAnimationFrame(animRef.current);
    try { partRef.current?.stop(); partRef.current?.dispose(); } catch {}
    try { synthRef.current?.dispose(); } catch {}
    if (toneRef.current) {
      try {
        const t = toneRef.current.getTransport?.() ?? toneRef.current.Transport;
        t.stop(); t.cancel();
      } catch {}
    }
    partRef.current = null;
    synthRef.current = null;
    setIsPlaying(false);
    setPlayheadSec(-1);
  }, []);

  const startPlayback = useCallback(async () => {
    if (!notes.length) return;
    await stopPlayback();

    const Tone = toneRef.current ?? await import('tone');
    toneRef.current = Tone;
    await Tone.start();

    const transport = Tone.getTransport?.() ?? Tone.Transport;
    transport.bpm.value = params.bpm;

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: { attack: 0.01, decay: 0.08, sustain: 0.55, release: 0.7 },
      volume: -8,
    }).toDestination();
    synthRef.current = synth;

    const secPerBeat = 60 / params.bpm;

    const part = new Tone.Part((time: number, val: MelodyNote) => {
      synth.triggerAttackRelease(val.note, val.beats * secPerBeat, time, val.velocity);
    }, notes.map(n => [n.time * secPerBeat, n]));

    part.start(0);
    partRef.current = part;

    const totalSec = params.bars * 4 * secPerBeat;
    transport.start('+0.05');
    setIsPlaying(true);

    const startWall = performance.now() / 1000;
    const animate = () => {
      const elapsed = performance.now() / 1000 - startWall;
      setPlayheadSec(elapsed);
      if (elapsed < totalSec + 0.2) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        stopPlayback();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [notes, params.bpm, params.bars, stopPlayback]);

  useEffect(() => () => { stopPlayback(); }, [stopPlayback]);

  // ── Export MIDI ────────────────────────────────────────────────────────────
  const exportMidi = async () => {
    if (!notes.length) return;
    try {
      const { Midi } = await import('@tonejs/midi');
      const midi = new Midi();
      midi.header.setTempo(params.bpm);
      const track = midi.addTrack();
      const secPerBeat = 60 / params.bpm;
      notes.forEach(n => {
        track.addNote({
          name: n.note,
          time: n.time * secPerBeat,
          duration: n.beats * secPerBeat,
          velocity: n.velocity,
        });
      });
      const blob = new Blob([midi.toArray()], { type: 'audio/midi' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `noir_${params.key}_${params.genre}_${params.bpm}bpm_${Date.now()}.mid`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'MIDI exported!', description: 'Open in FL Studio, Ableton, Logic, or any DAW.' });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    }
  };

  const set = <K extends keyof GeneratorParams>(k: K) =>
    (v: GeneratorParams[K]) => setParams(p => ({ ...p, [k]: v }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Card className="w-full glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music2 className="w-5 h-5 text-neon-purple" />
          Noir Melody Generator
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* ── Style Profile ───────────────────────────────────────────────── */}
        {styleProfile.sampleCount > 0 ? (
          <div className="p-3 rounded-lg border border-neon-purple/30 bg-neon-purple/5 space-y-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-neon-purple" />
              <span className="text-sm font-medium">Noir has analyzed your library</span>
              <Badge variant="outline" className="text-xs ml-auto">
                {styleProfile.sampleCount} sample{styleProfile.sampleCount !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center p-2 bg-card/40 rounded">
                <div className="text-neon-purple font-semibold capitalize">{styleProfile.primaryGenre}</div>
                <div className="text-muted-foreground">Primary Style</div>
              </div>
              <div className="text-center p-2 bg-card/40 rounded">
                <div className="text-neon-blue font-semibold">{styleProfile.primaryKey || '—'}</div>
                <div className="text-muted-foreground">Key Detected</div>
              </div>
              <div className="text-center p-2 bg-card/40 rounded">
                <div className="text-neon-green font-semibold">{styleProfile.estimatedBpm} BPM</div>
                <div className="text-muted-foreground">Avg Tempo</div>
              </div>
            </div>
            {styleProfile.genreBreakdown.length > 1 && (
              <div className="flex gap-1 flex-wrap">
                {styleProfile.genreBreakdown.slice(0, 5).map(g => (
                  <Badge key={g.genre} variant="outline" className="text-xs capitalize">
                    {g.genre} {g.pct}%
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-lg border border-border/30 bg-card/20 flex items-start gap-2 text-sm text-muted-foreground">
            <Library className="w-4 h-4 shrink-0 mt-0.5 text-neon-purple/60" />
            <span>
              Upload and tag samples in the Library tab — Noir will learn your style (genre, key, BPM)
              and automatically pre-fill these settings.
            </span>
          </div>
        )}

        {/* ── Genre chips ─────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Genre</Label>
          <div className="flex flex-wrap gap-1.5">
            {GENRE_OPTIONS.map(g => (
              <button
                key={g}
                onClick={() => set('genre')(g)}
                className={[
                  'px-2.5 py-1 text-xs rounded-full border transition-colors capitalize',
                  params.genre === g
                    ? 'border-neon-purple bg-neon-purple/20 text-neon-purple'
                    : 'border-border/40 text-muted-foreground hover:border-neon-purple/40 hover:text-foreground',
                ].join(' ')}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* ── Key + Scale ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Key</Label>
            <Select value={params.key} onValueChange={set('key')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KEY_OPTIONS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Scale</Label>
            <Select value={params.scale} onValueChange={set('scale')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCALE_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── BPM + Bars ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 items-end">
          <div className="space-y-2">
            <Label>BPM: {params.bpm}</Label>
            <Slider
              value={[params.bpm]} min={60} max={200} step={1}
              onValueChange={([v]) => set('bpm')(v)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>60</span><span>130</span><span>200</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Bars</Label>
            <div className="grid grid-cols-4 gap-1">
              {[2, 4, 8, 16].map(b => (
                <button
                  key={b}
                  onClick={() => set('bars')(b)}
                  className={[
                    'py-2 text-xs rounded border transition-colors',
                    params.bars === b
                      ? 'border-neon-purple bg-neon-purple/20 text-neon-purple font-semibold'
                      : 'border-border/40 text-muted-foreground hover:border-neon-purple/40',
                  ].join(' ')}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Style prompt ────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="mel-prompt">
            Style Prompt
            <span className="ml-2 font-normal text-xs text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="mel-prompt"
            placeholder="dark, hypnotic, emotional hook… or: heavy 808 vibe, sad minor key, rising tension"
            value={params.prompt}
            onChange={e => set('prompt')(e.target.value)}
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        {/* ── Generate button ─────────────────────────────────────────────── */}
        <Button
          onClick={generate}
          disabled={isGenerating || !openaiKey}
          className="w-full bg-neon-purple hover:bg-neon-purple/80 text-white"
          size="lg"
        >
          {isGenerating
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Composing with AI…</>
            : <><Sparkles className="w-4 h-4 mr-2" />Generate Melody</>}
        </Button>

        {!openaiKey && (
          <p className="text-xs text-amber-400 text-center -mt-2">
            Add your OpenAI key in the AI Audio Generator section to enable this.
          </p>
        )}

        {/* ── Piano Roll ──────────────────────────────────────────────────── */}
        {notes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Music2 className="w-3 h-3" /> Piano Roll
                <Badge variant="outline" className="text-xs">{notes.length} notes</Badge>
              </Label>
              <span className="text-xs text-muted-foreground">
                {params.bars} bars · {params.key} {params.scale} · {params.bpm} BPM
              </span>
            </div>

            <canvas
              ref={canvasRef}
              width={580}
              height={150}
              className="w-full rounded-lg border border-neon-purple/20"
            />

            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                className={`flex-1 ${isPlaying ? 'border-neon-green text-neon-green' : ''}`}
                onClick={isPlaying ? stopPlayback : startPlayback}
              >
                {isPlaying
                  ? <><Square className="w-3 h-3 mr-1.5 fill-current" />Stop</>
                  : <><Play className="w-3 h-3 mr-1.5" />Preview</>}
              </Button>
              <Button
                variant="outline" size="sm"
                className="flex-1 border-neon-blue/40 text-neon-blue hover:bg-neon-blue/10"
                onClick={exportMidi}
              >
                <Download className="w-3 h-3 mr-1.5" /> Export .mid
              </Button>
            </div>
          </div>
        )}

        {/* ── History ─────────────────────────────────────────────────────── */}
        {history.length > 1 && (
          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Recent Generations
            </Label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {history.slice(1).map((h, i) => (
                <button
                  key={h.id}
                  onClick={() => { setNotes(h.notes); setParams(h.params); setPlayheadSec(-1); }}
                  className="w-full text-left p-2 rounded border border-border/30 hover:border-neon-purple/40 text-xs flex items-center justify-between bg-card/20 transition-colors"
                >
                  <span className="text-muted-foreground capitalize">
                    #{history.length - i - 1} · {h.params.key} {h.params.scale} · {h.params.genre} · {h.params.bars} bars
                  </span>
                  <Badge variant="outline" className="text-xs shrink-0">{h.notes.length} notes</Badge>
                </button>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
};

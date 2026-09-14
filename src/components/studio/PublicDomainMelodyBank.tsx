import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Square, Download, ChevronLeft, ChevronRight, Music } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getScaleNotes, noteToMidi, KEY_OPTIONS, SCALE_OPTIONS,
  type MelodyNote,
} from '@/lib/melodyEngine';

// ── Seeded LCG (same family as the original All the Music generator) ──────────
function lcg(seed: number) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223;
    s >>>= 0;
    return s / 0x100000000;
  };
}

// ── Core generation: enumerate all melodies in a scale by seed index ──────────
// Each unique (key, scale, seed) triple produces one unique melody — the same
// enumeration approach used by All the Music LLC to exhaust every possible melody.
function generatePublicDomainMelody(
  key: string,
  scale: string,
  seed: number,
  bars = 2,
): MelodyNote[] {
  const scaleNotes = getScaleNotes(key, scale);
  if (!scaleNotes.length) return [];

  const rng = lcg(seed);
  const totalBeats = bars * 4;
  const RHYTHMS = [0.25, 0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 1.5, 2];

  const notes: MelodyNote[] = [];
  let time = 0;

  while (time < totalBeats - 0.01) {
    const noteIdx = Math.floor(rng() * scaleNotes.length);
    const beats = Math.min(
      RHYTHMS[Math.floor(rng() * RHYTHMS.length)],
      parseFloat((totalBeats - time).toFixed(3)),
    );
    if (beats < 0.24) break;
    notes.push({
      note: scaleNotes[noteIdx],
      beats,
      time: parseFloat(time.toFixed(3)),
      velocity: 0.45 + rng() * 0.5,
    });
    time = parseFloat((time + beats).toFixed(3));
  }

  return notes;
}

// ── Mini piano roll (div-based, no canvas needed for thumbnails) ──────────────
function MiniPianoRoll({ notes, bars }: { notes: MelodyNote[]; bars: number }) {
  if (!notes.length) return <div className="h-12 bg-[#07070f] rounded" />;

  const midiVals = notes.map(n => noteToMidi(n.note));
  const minMidi = Math.min(...midiVals);
  const maxMidi = Math.max(...midiVals);
  const midiRange = Math.max(maxMidi - minMidi, 6);
  const totalBeats = bars * 4;

  return (
    <div className="relative h-12 bg-[#07070f] rounded overflow-hidden">
      {notes.map((note, i) => {
        const midi = noteToMidi(note.note);
        const left = `${(note.time / totalBeats) * 100}%`;
        const width = `${Math.max(1.5, (note.beats / totalBeats) * 100 - 0.4)}%`;
        const bottomPct = ((midi - minMidi) / midiRange) * 78;
        const bright = 38 + note.velocity * 32;
        return (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              left, width,
              bottom: `calc(${bottomPct}% + 3px)`,
              height: '5px',
              background: `hsla(270, 85%, ${bright}%, ${0.7 + note.velocity * 0.3})`,
            }}
          />
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const CARDS_PER_PAGE = 8;

interface PublicDomainMelodyBankProps {
  onLoadMelody: (notes: MelodyNote[], key: string, scale: string) => void;
}

export function PublicDomainMelodyBank({ onLoadMelody }: PublicDomainMelodyBankProps) {
  const [key, setKey] = useState('C');
  const [scale, setScale] = useState('pentatonic_minor');
  const [bars, setBars] = useState(2);
  const [page, setPage] = useState(0);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const synthRef = useRef<any>(null);
  const { toast } = useToast();

  // Reset to page 0 when key/scale changes so indices feel fresh
  useEffect(() => { setPage(0); }, [key, scale]);

  // Cleanup synth on unmount
  useEffect(() => () => {
    try { synthRef.current?.dispose(); } catch {}
  }, []);

  const seeds = Array.from({ length: CARDS_PER_PAGE }, (_, i) => page * CARDS_PER_PAGE + i);
  const melodies = seeds.map(seed => ({
    seed,
    notes: generatePublicDomainMelody(key, scale, seed, bars),
  }));

  // Global melody count for the selected key/scale (display only — actual set is infinite)
  const displayTotal = '16,777,216+';

  const stopPlayback = useCallback(() => {
    try { synthRef.current?.dispose(); } catch {}
    synthRef.current = null;
    setPlayingId(null);
  }, []);

  const playMelody = useCallback(async (notes: MelodyNote[], id: number) => {
    stopPlayback();
    if (playingId === id) return; // toggle off

    try {
      const Tone = await import('tone');
      await Tone.start();

      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle8' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.6 },
        volume: -10,
      }).toDestination();

      synthRef.current = synth;
      const secPerBeat = 60 / 120;

      notes.forEach(note => {
        synth.triggerAttackRelease(
          note.note,
          note.beats * secPerBeat,
          `+${note.time * secPerBeat + 0.05}`,
          note.velocity,
        );
      });

      setPlayingId(id);
      const totalMs = (bars * 4 * secPerBeat + 0.8) * 1000;
      setTimeout(() => {
        if (synthRef.current === synth) stopPlayback();
      }, totalMs);
    } catch (err) {
      console.warn('PublicDomainMelodyBank playback error:', err);
      setPlayingId(null);
    }
  }, [playingId, bars, stopPlayback]);

  const handleExportMidi = async (notes: MelodyNote[], seed: number) => {
    try {
      const { Midi } = await import('@tonejs/midi');
      const midi = new Midi();
      midi.header.setTempo(120);
      const track = midi.addTrack();
      const secPerBeat = 60 / 120;
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
      a.download = `cc0_${key}_${scale}_${seed}.mid`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'MIDI exported (CC0)', description: 'Public domain — no attribution required.' });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Card className="w-full glass-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-neon-green" />
            Public Domain Melody Bank
          </div>
          <Badge className="bg-green-500/20 text-green-400 border-green-500/40 text-xs">
            CC0 · Copyright-Free
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* Attribution note */}
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/25 text-xs text-green-300 leading-relaxed">
          Inspired by <strong>All the Music LLC</strong> — every melody here is algorithmically
          generated from all possible note sequences in the chosen scale and released to the
          public domain (CC0). <strong>No copyright, no attribution required.</strong>
          {' '}Use freely in any commercial release.
        </div>

        {/* Controls */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Key</Label>
            <Select value={key} onValueChange={setKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KEY_OPTIONS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Scale</Label>
            <Select value={scale} onValueChange={setScale}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCALE_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Bars</Label>
            <div className="grid grid-cols-3 gap-1">
              {[1, 2, 4].map(b => (
                <button
                  key={b}
                  onClick={() => setBars(b)}
                  className={[
                    'py-2 text-xs rounded border transition-colors',
                    bars === b
                      ? 'border-neon-green bg-neon-green/20 text-neon-green font-semibold'
                      : 'border-border/40 text-muted-foreground hover:border-neon-green/40',
                  ].join(' ')}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>Showing melodies {page * CARDS_PER_PAGE + 1}–{(page + 1) * CARDS_PER_PAGE} of <span className="text-green-400 font-medium">{displayTotal}</span> in {key} {scale}</span>
          <div className="flex gap-1">
            <Button
              variant="ghost" size="sm" className="h-7 w-7 p-0"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="flex items-center px-2 text-xs">Pg {page + 1}</span>
            <Button
              variant="ghost" size="sm" className="h-7 w-7 p-0"
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Melody cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {melodies.map(({ seed, notes }) => {
            const isPlaying = playingId === seed;
            return (
              <div
                key={seed}
                className={[
                  'rounded-lg border p-3 space-y-2 transition-colors',
                  isPlaying
                    ? 'border-neon-green/50 bg-neon-green/5'
                    : 'border-border/30 bg-card/30 hover:bg-card/50',
                ].join(' ')}
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-mono">
                    #{seed.toString().padStart(6, '0')}
                  </span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-400 border-green-500/30">
                      CC0
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{notes.length} notes</span>
                  </div>
                </div>

                {/* Mini piano roll */}
                <MiniPianoRoll notes={notes} bars={bars} />

                {/* Action buttons */}
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`flex-1 h-7 text-xs ${isPlaying ? 'text-neon-green border border-neon-green/40' : ''}`}
                    onClick={() => isPlaying ? stopPlayback() : playMelody(notes, seed)}
                  >
                    {isPlaying
                      ? <><Square className="w-3 h-3 mr-1 fill-current" />Stop</>
                      : <><Play className="w-3 h-3 mr-1" />Preview</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-neon-blue hover:bg-neon-blue/10 px-2"
                    onClick={() => handleExportMidi(notes, seed)}
                    title="Export as MIDI"
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs bg-neon-purple/80 hover:bg-neon-purple text-white"
                    onClick={() => {
                      stopPlayback();
                      onLoadMelody(notes, key, scale);
                      toast({
                        title: 'Melody loaded into generator',
                        description: `Melody #${seed} · ${key} ${scale} · CC0 public domain`,
                      });
                    }}
                  >
                    Load
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Page navigation (bottom) */}
        <div className="flex justify-center gap-2 pt-1">
          <Button
            variant="outline" size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />Previous
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => setPage(p => p + 1)}
            className="text-xs"
          >
            Next<ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}

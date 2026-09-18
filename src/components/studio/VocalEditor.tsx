import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  X, Play, Square, Download, RotateCcw, Wand2, Loader2,
  Music2, Waves, Sliders,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VocalEditorProps {
  audioUrl: string;
  trackName: string;
  onClose: () => void;
  onExported?: (url: string, name: string) => void;
}

interface FX {
  pitch: number;      // semitones  -12 → +12
  speed: number;      // multiplier  0.5 → 2.0
  volume: number;     // multiplier  0.0 → 2.0
  eqLow: number;      // dB  -12 → +12
  eqMid: number;
  eqHigh: number;
  reverb: number;     // wet ratio  0 → 1
  echoAmount: number; // feedback   0 → 0.8
  echoTime: number;   // seconds    0.05 → 0.6
  reversed: boolean;
  trimStart: number;  // seconds
  trimEnd: number;    // seconds (0 = use full length)
}

const DEFAULT_FX: FX = {
  pitch: 0, speed: 1, volume: 1,
  eqLow: 0, eqMid: 0, eqHigh: 0,
  reverb: 0, echoAmount: 0, echoTime: 0.3,
  reversed: false, trimStart: 0, trimEnd: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeIR(ctx: BaseAudioContext, dur = 1.5, decay = 3): AudioBuffer {
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function bufferToWav(ab: AudioBuffer): Blob {
  const nc = ab.numberOfChannels;
  const len = ab.length * nc * 2;
  const buf = new ArrayBuffer(44 + len);
  const v = new DataView(buf);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + len, true); ws(8, 'WAVE');
  ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, nc, true); v.setUint32(24, ab.sampleRate, true);
  v.setUint32(28, ab.sampleRate * nc * 2, true); v.setUint16(32, nc * 2, true);
  v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, len, true);
  let off = 44;
  for (let i = 0; i < ab.length; i++)
    for (let ch = 0; ch < nc; ch++) {
      const s = Math.max(-1, Math.min(1, ab.getChannelData(ch)[i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  return new Blob([buf], { type: 'audio/wav' });
}

function reverseBuffer(src: AudioBuffer, ctx: BaseAudioContext): AudioBuffer {
  const out = ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const sd = src.getChannelData(ch);
    const od = out.getChannelData(ch);
    for (let i = 0; i < sd.length; i++) od[i] = sd[sd.length - 1 - i];
  }
  return out;
}

function buildChain(
  ctx: BaseAudioContext,
  source: AudioBufferSourceNode,
  fx: FX,
  audioBuf: AudioBuffer,
) {
  const ir = makeIR(ctx);

  const lowEQ = ctx.createBiquadFilter();
  lowEQ.type = 'lowshelf'; lowEQ.frequency.value = 250; lowEQ.gain.value = fx.eqLow;

  const midEQ = ctx.createBiquadFilter();
  midEQ.type = 'peaking'; midEQ.frequency.value = 1500; midEQ.Q.value = 1.0; midEQ.gain.value = fx.eqMid;

  const highEQ = ctx.createBiquadFilter();
  highEQ.type = 'highshelf'; highEQ.frequency.value = 6000; highEQ.gain.value = fx.eqHigh;

  const convolver = ctx.createConvolver();
  convolver.buffer = ir;
  const dryG = ctx.createGain(); dryG.gain.value = 1 - fx.reverb * 0.8;
  const wetG = ctx.createGain(); wetG.gain.value = fx.reverb * 0.6;

  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = fx.echoTime;
  const fbG = ctx.createGain(); fbG.gain.value = fx.echoAmount;
  const echoSendG = ctx.createGain(); echoSendG.gain.value = fx.echoAmount > 0 ? 0.5 : 0;

  const master = ctx.createGain(); master.gain.value = fx.volume;

  // source → EQ chain
  source.connect(lowEQ);
  lowEQ.connect(midEQ);
  midEQ.connect(highEQ);

  // EQ → dry / reverb / echo
  highEQ.connect(dryG);
  highEQ.connect(convolver);
  highEQ.connect(echoSendG);

  convolver.connect(wetG);

  echoSendG.connect(delay);
  delay.connect(fbG);
  fbG.connect(delay);  // feedback loop
  delay.connect(master);

  dryG.connect(master);
  wetG.connect(master);
  master.connect(ctx.destination);

  // Source settings
  source.playbackRate.value = fx.speed;
  source.detune.value = fx.pitch * 100; // semitones → cents

  const trimEnd = fx.trimEnd > 0 ? fx.trimEnd : audioBuf.duration;
  const trimDur = (trimEnd - fx.trimStart) / fx.speed;
  source.start(0, fx.trimStart, trimDur);
}

// ─────────────────────────────────────────────────────────────────────────────

export const VocalEditor: React.FC<VocalEditorProps> = ({ audioUrl, trackName, onClose, onExported }) => {
  const [audioBuf, setAudioBuf] = useState<AudioBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [fx, setFx] = useState<FX>(DEFAULT_FX);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const { toast } = useToast();

  // ── Load audio ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const tmpCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    fetch(audioUrl)
      .then(r => r.arrayBuffer())
      .then(ab => tmpCtx.decodeAudioData(ab))
      .then(decoded => {
        setAudioBuf(decoded);
        setFx(prev => ({ ...prev, trimEnd: decoded.duration }));
      })
      .catch(() => toast({ title: 'Could not load audio for editing', variant: 'destructive' }))
      .finally(() => { setLoading(false); tmpCtx.close(); });
  }, [audioUrl]);

  // ── Draw waveform ───────────────────────────────────────────────────────────
  const drawWaveform = useCallback(() => {
    if (!audioBuf || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width; const H = canvas.height;
    const data = audioBuf.getChannelData(0);
    const step = Math.ceil(data.length / W);
    const mid = H / 2;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, W, H);

    const trimEndSec = fx.trimEnd > 0 ? fx.trimEnd : audioBuf.duration;
    const startX = (fx.trimStart / audioBuf.duration) * W;
    const endX = (trimEndSec / audioBuf.duration) * W;

    // Waveform
    for (let i = 0; i < W; i++) {
      let min = 1, max = -1;
      for (let j = 0; j < step; j++) {
        const s = data[i * step + j] ?? 0;
        if (s < min) min = s; if (s > max) max = s;
      }
      const inRange = i >= startX && i <= endX;
      ctx.strokeStyle = inRange ? '#7c3aed' : '#3b0764';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(i, (1 + min) * mid);
      ctx.lineTo(i, (1 + max) * mid);
      ctx.stroke();
    }

    // Trim shading
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, startX, H);
    ctx.fillRect(endX, 0, W - endX, H);

    // Trim lines
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, 0); ctx.lineTo(startX, H);
    ctx.moveTo(endX, 0); ctx.lineTo(endX, H);
    ctx.stroke();
  }, [audioBuf, fx.trimStart, fx.trimEnd]);

  useEffect(() => { drawWaveform(); }, [drawWaveform]);

  // ── Preview ─────────────────────────────────────────────────────────────────
  const stopPreview = useCallback(() => {
    try { sourceRef.current?.stop(); } catch {}
    try { previewCtxRef.current?.close(); } catch {}
    sourceRef.current = null;
    previewCtxRef.current = null;
    setIsPlaying(false);
  }, []);

  const startPreview = useCallback(async () => {
    if (!audioBuf) return;
    stopPreview();

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    previewCtxRef.current = ctx;

    const buf = fx.reversed ? reverseBuffer(audioBuf, ctx) : audioBuf;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    buildChain(ctx, src, fx, buf);
    sourceRef.current = src;
    setIsPlaying(true);

    src.onended = () => { setIsPlaying(false); };
  }, [audioBuf, fx, stopPreview]);

  // ── Export ──────────────────────────────────────────────────────────────────
  const exportAudio = useCallback(async () => {
    if (!audioBuf) return;
    setIsExporting(true);
    try {
      const trimEndSec = fx.trimEnd > 0 ? fx.trimEnd : audioBuf.duration;
      const trimDur = (trimEndSec - fx.trimStart) / fx.speed;
      const samples = Math.ceil(trimDur * audioBuf.sampleRate);

      const offCtx = new OfflineAudioContext(audioBuf.numberOfChannels, samples, audioBuf.sampleRate);
      const buf = fx.reversed ? reverseBuffer(audioBuf, offCtx) : audioBuf;
      const src = offCtx.createBufferSource();
      src.buffer = buf;
      buildChain(offCtx, src, fx, buf);

      const rendered = await offCtx.startRendering();
      const wavBlob = bufferToWav(rendered);
      const url = URL.createObjectURL(wavBlob);

      const a = document.createElement('a');
      a.href = url; a.download = `${trackName.replace(/[^a-z0-9]/gi, '_')}_edited.wav`;
      a.click();

      onExported?.(url, `${trackName} (edited)`);
      toast({ title: 'Exported!', description: 'Edited vocal downloaded as WAV.' });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  }, [audioBuf, fx, trackName, onExported, toast]);

  const reset = () => {
    stopPreview();
    setFx(audioBuf ? { ...DEFAULT_FX, trimEnd: audioBuf.duration } : DEFAULT_FX);
  };

  const set = (k: keyof FX) => (v: number[] | boolean) =>
    setFx(prev => ({ ...prev, [k]: Array.isArray(v) ? v[0] : v }));

  const dur = audioBuf?.duration ?? 0;
  const trimEndSec = fx.trimEnd > 0 ? fx.trimEnd : dur;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Card className="glass-card border border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            Editing: <span className="text-primary truncate max-w-[180px]">{trackName}</span>
            {audioBuf && (
              <Badge variant="outline" className="text-xs">{dur.toFixed(1)}s</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => { stopPreview(); onClose(); }}>
            <X className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading audio…
          </div>
        ) : (
          <>
            {/* Waveform */}
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Waves className="w-3 h-3" /> Waveform</Label>
              <canvas
                ref={canvasRef}
                width={560}
                height={72}
                className="w-full rounded-md border border-border/30"
              />
            </div>

            {/* Trim */}
            <div className="space-y-2 p-3 bg-studio-surface/20 rounded-lg border border-border/30">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trim</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs w-16 text-muted-foreground">Start: {fx.trimStart.toFixed(2)}s</span>
                  <Slider className="flex-1" value={[fx.trimStart]} min={0} max={Math.max(0, trimEndSec - 0.1)} step={0.01}
                    onValueChange={set('trimStart')} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs w-16 text-muted-foreground">End: {trimEndSec.toFixed(2)}s</span>
                  <Slider className="flex-1" value={[trimEndSec]} min={Math.min(dur, fx.trimStart + 0.1)} max={dur} step={0.01}
                    onValueChange={set('trimEnd')} />
                </div>
              </div>
            </div>

            {/* Pitch & Speed */}
            <div className="space-y-3 p-3 bg-studio-surface/20 rounded-lg border border-border/30">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pitch &amp; Tempo</Label>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs w-24 text-muted-foreground">Pitch: {fx.pitch > 0 ? '+' : ''}{fx.pitch} st</span>
                  <Slider className="flex-1" value={[fx.pitch]} min={-12} max={12} step={1} onValueChange={set('pitch')} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs w-24 text-muted-foreground">Speed: {fx.speed.toFixed(2)}×</span>
                  <Slider className="flex-1" value={[fx.speed]} min={0.5} max={2.0} step={0.05} onValueChange={set('speed')} />
                </div>
              </div>
            </div>

            {/* EQ */}
            <div className="space-y-3 p-3 bg-studio-surface/20 rounded-lg border border-border/30">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">EQ</Label>
              <div className="space-y-3">
                {([
                  { key: 'eqLow'  as const, label: 'Low  (250 Hz)', color: 'text-blue-400' },
                  { key: 'eqMid'  as const, label: 'Mid (1.5 kHz)', color: 'text-yellow-400' },
                  { key: 'eqHigh' as const, label: 'High  (6 kHz)', color: 'text-neon-pink' },
                ]).map(({ key, label, color }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className={`text-xs w-28 ${color}`}>{label}: {fx[key] > 0 ? '+' : ''}{fx[key]} dB</span>
                    <Slider className="flex-1" value={[fx[key]]} min={-12} max={12} step={0.5} onValueChange={set(key)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Reverb & Echo */}
            <div className="space-y-3 p-3 bg-studio-surface/20 rounded-lg border border-border/30">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reverb &amp; Echo</Label>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs w-24 text-muted-foreground">Reverb: {Math.round(fx.reverb * 100)}%</span>
                  <Slider className="flex-1" value={[fx.reverb]} min={0} max={1} step={0.01} onValueChange={set('reverb')} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs w-24 text-muted-foreground">Echo: {Math.round(fx.echoAmount * 100)}%</span>
                  <Slider className="flex-1" value={[fx.echoAmount]} min={0} max={0.8} step={0.01} onValueChange={set('echoAmount')} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs w-24 text-muted-foreground">Delay: {Math.round(fx.echoTime * 1000)}ms</span>
                  <Slider className="flex-1" value={[fx.echoTime]} min={0.05} max={0.6} step={0.01} onValueChange={set('echoTime')} />
                </div>
              </div>
            </div>

            {/* Volume & Reverse */}
            <div className="flex items-center gap-4 p-3 bg-studio-surface/20 rounded-lg border border-border/30">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xs w-28 text-muted-foreground">Volume: {Math.round(fx.volume * 100)}%</span>
                <Slider className="flex-1" value={[fx.volume]} min={0} max={2} step={0.05} onValueChange={set('volume')} />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Label className="text-xs text-muted-foreground">Reverse</Label>
                <Switch
                  checked={fx.reversed}
                  onCheckedChange={(v) => { stopPreview(); setFx(p => ({ ...p, reversed: v })); }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={isPlaying ? stopPreview : startPreview}
                className={isPlaying ? 'border-neon-green text-neon-green' : ''}
              >
                {isPlaying
                  ? <><Square className="w-4 h-4 mr-2 fill-current" />Stop</>
                  : <><Play className="w-4 h-4 mr-2" />Preview</>}
              </Button>
              <Button variant="outline" onClick={reset} className="text-muted-foreground">
                <RotateCcw className="w-4 h-4 mr-2" /> Reset All
              </Button>
            </div>

            <Button
              className="w-full bg-primary hover:bg-primary/80 text-white"
              onClick={exportAudio}
              disabled={isExporting}
              size="lg"
            >
              {isExporting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rendering…</>
                : <><Download className="w-4 h-4 mr-2" />Export &amp; Download WAV</>}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

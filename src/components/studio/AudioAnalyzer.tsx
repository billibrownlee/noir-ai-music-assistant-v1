import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, Square, Upload, Activity, Disc3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Music theory constants ───────────────────────────────────────────────────

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const CAMELOT_MAJOR: Record<number,string> = {
  0:'8B',1:'3B',2:'10B',3:'5B',4:'12B',5:'7B',6:'2B',7:'9B',8:'4B',9:'11B',10:'6B',11:'1B',
};
const CAMELOT_MINOR: Record<number,string> = {
  0:'5A',1:'12A',2:'7A',3:'2A',4:'9A',5:'4A',6:'11A',7:'6A',8:'1A',9:'8A',10:'3A',11:'10A',
};

// Krumhansl-Schmuckler key profiles
const KP_MAJOR = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const KP_MINOR = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

// Every Noise at Once genre space — x: organic→mechanical, y: dense→bouncy
const GENRE_COORDS: Record<string,{x:number;y:number}> = {
  classical:  {x:0.10,y:0.20}, jazz:      {x:0.18,y:0.35},
  blues:      {x:0.22,y:0.28}, gospel:    {x:0.20,y:0.55},
  soul:       {x:0.28,y:0.42}, 'lo-fi':   {x:0.32,y:0.30},
  'r&b':      {x:0.40,y:0.48}, country:   {x:0.30,y:0.52},
  reggae:     {x:0.28,y:0.68}, funk:      {x:0.48,y:0.62},
  pop:        {x:0.50,y:0.72}, 'hip-hop': {x:0.55,y:0.55},
  afrobeats:  {x:0.45,y:0.78}, dancehall: {x:0.50,y:0.82},
  rock:       {x:0.62,y:0.58}, trap:      {x:0.68,y:0.60},
  drill:      {x:0.72,y:0.52}, electronic:{x:0.75,y:0.72},
  house:      {x:0.70,y:0.78}, techno:    {x:0.82,y:0.65},
  metal:      {x:0.80,y:0.50},
};

// ─── DSP helpers ──────────────────────────────────────────────────────────────

function goertzel(data: Float32Array, start: number, N: number, freq: number, sr: number): number {
  const k = Math.round(N * freq / sr);
  const coeff = 2 * Math.cos(2 * Math.PI * k / N);
  let s0 = 0, s1 = 0, s2 = 0;
  const end = Math.min(start + N, data.length);
  for (let i = start; i < end; i++) { s0 = data[i] + coeff*s1 - s2; s2 = s1; s1 = s0; }
  return s1*s1 + s2*s2 - coeff*s1*s2;
}

function computeChroma(data: Float32Array, sr: number): number[] {
  const chroma = new Array(12).fill(0);
  const C4 = 261.63;
  const frameSize = 4096, hopSize = 2048;
  const maxFrames = Math.min(25, Math.floor((data.length - frameSize) / hopSize));
  for (let frame = 0; frame < maxFrames; frame++) {
    const start = frame * hopSize;
    for (let pc = 0; pc < 12; pc++) {
      let e = 0;
      for (let oct = 2; oct <= 6; oct++) {
        const freq = C4 * Math.pow(2, pc/12 + (oct-4));
        if (freq > 60 && freq < sr/2 - 1) e += goertzel(data, start, frameSize, freq, sr);
      }
      chroma[pc] += e;
    }
  }
  const mx = Math.max(...chroma, 1e-10);
  return chroma.map(c => c/mx);
}

function detectKey(chroma: number[]): { keyIdx: number; mode: 0|1 } {
  let best = -Infinity, bestKey = 0, bestMode: 0|1 = 1;
  for (let root = 0; root < 12; root++) {
    const maj = KP_MAJOR.reduce((a,v,i) => a + v*chroma[(i+root)%12], 0);
    const min = KP_MINOR.reduce((a,v,i) => a + v*chroma[(i+root)%12], 0);
    if (maj > best) { best = maj; bestKey = root; bestMode = 1; }
    if (min > best) { best = min; bestKey = root; bestMode = 0; }
  }
  return { keyIdx: bestKey, mode: bestMode };
}

function detectBPM(data: Float32Array, sr: number): number {
  const slice = data.slice(0, Math.min(data.length, sr * 30));
  const hop = 128, frame = 512;
  const frames = Math.floor((slice.length - frame) / hop);
  const energy: number[] = [];
  for (let i = 0; i < frames; i++) {
    let e = 0;
    for (let j = 0; j < frame; j++) e += slice[i*hop+j] ** 2;
    energy.push(e/frame);
  }
  const w = 5;
  const smooth = energy.map((_,i) => {
    const s = energy.slice(Math.max(0,i-w), i+w+1);
    return s.reduce((a,b)=>a+b,0)/s.length;
  });
  const diff = smooth.map((v,i) => i>0 ? Math.max(0, v-smooth[i-1]) : 0);
  const minLag = Math.floor(60/220 * sr/hop);
  const maxLag = Math.min(Math.floor(60/50 * sr/hop), Math.floor(diff.length/2));
  let bestLag = minLag, bestCorr = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i+lag < diff.length; i++) corr += diff[i]*diff[i+lag];
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }
  return Math.max(50, Math.min(220, Math.round(60 / (bestLag*hop/sr))));
}

function computeEnergy(data: Float32Array): number {
  const step = Math.max(1, Math.floor(data.length/50000));
  let sum = 0, count = 0;
  for (let i = 0; i < data.length; i += step) { sum += data[i]*data[i]; count++; }
  return Math.min(1, Math.sqrt(sum/count) / 0.18);
}

function inferGenres(bpm: number, _keyIdx: number, mode: 0|1, energy: number): string[] {
  const s: Record<string,number> = {};
  const add = (g: string, n: number) => { s[g] = (s[g]??0)+n; };
  const minor = mode===0;

  if (bpm >= 125 && bpm <= 175) { add('trap',3); add('drill',2); }
  if (bpm >= 155 && bpm <= 200) { add('electronic',2); add('techno',2); }
  if (bpm >= 118 && bpm <= 135) { add('house',2); add('pop',2); }
  if (bpm >= 80  && bpm <= 112) { add('hip-hop',3); add('r&b',2); add('soul',1); }
  if (bpm >= 100 && bpm <= 128) { add('afrobeats',3); add('dancehall',2); add('funk',2); }
  if (bpm < 80)  { add('lo-fi',3); add('jazz',2); add('soul',1); }
  if (bpm >= 60  && bpm <= 95)  { add('blues',1); add('country',1); }

  if (minor)  { add('trap',2); add('drill',3); add('metal',2); add('blues',1); }
  else        { add('pop',2); add('afrobeats',1); add('funk',2); add('gospel',1); add('reggae',1); }

  if (energy > 0.70) { add('trap',1); add('electronic',1); add('rock',2); add('metal',1); }
  if (energy < 0.40) { add('lo-fi',2); add('jazz',1); add('classical',1); add('soul',1); }

  return Object.entries(s).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([g])=>g);
}

function inferMood(bpm: number, mode: 0|1, energy: number, dance: number): string {
  if (mode===0) {
    if (energy>0.7) return 'Dark & Intense';
    if (bpm>120)   return 'Aggressive';
    if (energy>0.4) return 'Melancholic';
    return 'Introspective';
  }
  if (bpm>130 && energy>0.6) return 'Euphoric';
  if (dance>0.7)  return 'Energetic';
  if (energy<0.35) return 'Peaceful';
  return 'Uplifting';
}

function tempoLabel(bpm: number): string {
  if (bpm<60)  return 'Largo';
  if (bpm<76)  return 'Adagio';
  if (bpm<108) return 'Andante';
  if (bpm<120) return 'Moderato';
  if (bpm<156) return 'Allegro';
  if (bpm<176) return 'Vivace';
  return 'Presto';
}

async function identifySong(file: File): Promise<{title:string;artist:string;album?:string}|null> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('return', 'spotify');
    const res = await fetch('https://api.audd.io/', { method:'POST', body: formData });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status==='success' && data.result) {
      return { title: data.result.title, artist: data.result.artist, album: data.result.album };
    }
    return null;
  } catch { return null; }
}

// ─── Genre Map ────────────────────────────────────────────────────────────────

function GenreMap({ detected }: { detected: string[] }) {
  return (
    <div className="relative h-44 bg-[#07070f] rounded-lg border border-border/20 overflow-hidden select-none">
      <span className="absolute top-1.5 left-2 text-[9px] text-muted-foreground/35 font-mono">organic</span>
      <span className="absolute top-1.5 right-2 text-[9px] text-muted-foreground/35 font-mono">mechanical</span>
      <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground/35 font-mono">dense</span>
      {Object.entries(GENRE_COORDS).map(([genre, {x, y}]) => {
        const hit = detected.includes(genre);
        return (
          <span
            key={genre}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
            style={{ left:`${x*100}%`, top:`${(1-y)*100}%` }}
          >
            <span className={hit
              ? 'text-primary font-bold text-[11px] drop-shadow-[0_0_6px_hsl(24_95%_56%_/_0.8)]'
              : 'text-muted-foreground/25 text-[9px]'
            }>
              {genre}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ─── Meter Bar ────────────────────────────────────────────────────────────────

function MeterBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full bg-border/20 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width:`${Math.round(value*100)}%`, background: color }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AnalysisResult {
  bpm: number;
  key: string;
  mode: 'major'|'minor';
  camelot: string;
  energy: number;
  danceability: number;
  mood: string;
  genres: string[];
  songId: {title:string;artist:string;album?:string}|null;
}

export function AudioAnalyzer() {
  const [audioFile, setAudioFile] = useState<File|null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [result, setResult] = useState<AnalysisResult|null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder|null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const { toast } = useToast();

  const log = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('en', {hour12:false});
    setLogLines(prev => [...prev, `[${ts}] ${msg}`]);
  }, []);

  const tick = useCallback(() => {
    setLogLines(prev => [...prev]);
  }, []);
  void tick;

  const runAnalysis = useCallback(async (file: File) => {
    setResult(null);
    setLogLines([]);
    setIsAnalyzing(true);

    try {
      log('Preparing audio...');
      const ab = await file.arrayBuffer();

      log('Decoding waveform...');
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 22050 });
      const buf = await ctx.decodeAudioData(ab);
      await ctx.close();
      const data = buf.getChannelData(0);

      log('Measuring energy level...');
      await new Promise(r => setTimeout(r, 60));
      const energy = computeEnergy(data);

      log('Detecting tempo (BPM)...');
      await new Promise(r => setTimeout(r, 60));
      const bpm = detectBPM(data, buf.sampleRate);

      log('Analysing harmonic content (key)...');
      await new Promise(r => setTimeout(r, 60));
      const chroma = computeChroma(data, buf.sampleRate);
      const { keyIdx, mode } = detectKey(chroma);
      const key = NOTES[keyIdx];
      const modeName: 'major'|'minor' = mode===1 ? 'major' : 'minor';
      const camelot = mode===1 ? CAMELOT_MAJOR[keyIdx] : CAMELOT_MINOR[keyIdx];

      log('Estimating danceability & mood...');
      await new Promise(r => setTimeout(r, 60));
      const danceability = Math.min(1, Math.max(0, 0.5*(1-Math.abs(bpm-110)/80) + 0.5*energy));
      const mood = inferMood(bpm, mode, energy, danceability);
      const genres = inferGenres(bpm, keyIdx, mode, energy);

      log('Projecting into genre space...');
      await new Promise(r => setTimeout(r, 60));

      log('Sending to song recognition...');
      const songId = await identifySong(file);
      if (songId) {
        log(`Matched: "${songId.title}" — ${songId.artist}`);
      } else {
        log('No match found (original / unrecognised content)');
      }

      log('Analysis complete ✓');
      setResult({ bpm, key, mode: modeName, camelot, energy, danceability, mood, genres, songId });
    } catch (err: any) {
      log(`Error: ${err.message}`);
      toast({ title: 'Analysis failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  }, [log, toast]);

  const handleFile = useCallback((file: File) => {
    const ok = ['audio/mpeg','audio/wav','audio/mp4','audio/ogg','audio/x-m4a','audio/aac','audio/flac'].includes(file.type)
      || /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(file.name);
    if (!ok) { toast({ title: 'Unsupported format', description: 'Use MP3, WAV, M4A, OGG, or FLAC', variant: 'destructive' }); return; }
    setAudioFile(file);
    runAnalysis(file);
  }, [runAnalysis, toast]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => { if (e.data.size>0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type:'audio/webm' });
        const file = new File([blob], 'recording.webm', { type:'audio/webm' });
        setAudioFile(file);
        runAnalysis(file);
      };
      mr.start(100);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds(s => {
          if (s >= 59) { stopRecording(); return 60; }
          return s+1;
        });
      }, 1000);
    } catch (err: any) {
      toast({ title: 'Microphone error', description: err.message, variant: 'destructive' });
    }
  }, [runAnalysis, toast]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <Card className="w-full glass-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Audio Analyzer
          </div>
          <div className="flex gap-2">
            <Badge className="bg-primary/20 text-primary border-primary/40 text-xs">Key · BPM · Camelot</Badge>
            <Badge className="bg-primary/20 text-primary border-primary/40 text-xs">Shazam-Style ID</Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* Input zone */}
        <div
          className={[
            'relative rounded-lg border-2 border-dashed p-6 text-center transition-colors',
            isDragging ? 'border-primary bg-primary/10' : 'border-border/30 hover:border-border/60',
            isAnalyzing ? 'pointer-events-none opacity-60' : '',
          ].join(' ')}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Upload className="w-5 h-5" />
              <span className="text-sm">Drop audio file or</span>
              <label className="cursor-pointer text-primary hover:underline text-sm">
                click to upload
                <input
                  type="file"
                  accept=".mp3,.wav,.m4a,.ogg,.flac,.aac,audio/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if(f) handleFile(f); e.target.value=''; }}
                />
              </label>
              <span className="text-sm text-muted-foreground">MP3 · WAV · M4A · OGG</span>
            </div>

            <div className="text-xs text-muted-foreground">— or —</div>

            {isRecording ? (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm text-destructive-foreground">Recording {recordSeconds}s / 60s</span>
                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={stopRecording}>
                  <Square className="w-3 h-3 mr-1 fill-current" /> Stop & Analyze
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
                onClick={startRecording}
                disabled={isAnalyzing}
              >
                <Mic className="w-3.5 h-3.5 mr-1.5" />
                Sing, hum, or record (up to 60s)
              </Button>
            )}

            {audioFile && (
              <p className="text-xs text-muted-foreground truncate max-w-xs">
                {audioFile.name}
              </p>
            )}
          </div>
        </div>

        {/* Live analysis log */}
        {logLines.length > 0 && (
          <div className="rounded-lg bg-[#07070f] border border-border/20 p-3 font-mono text-[11px] space-y-0.5 max-h-36 overflow-y-auto">
            {logLines.map((line, i) => (
              <div
                key={i}
                className={line.includes('✓') ? 'text-primary' : 'text-muted-foreground'}
              >
                {line}
              </div>
            ))}
            {isAnalyzing && (
              <div className="text-primary animate-pulse">▋</div>
            )}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">

            {/* Song ID card */}
            {result.songId && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30">
                <Disc3 className="w-8 h-8 text-primary flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-foreground">{result.songId.title}</p>
                  <p className="text-xs text-muted-foreground">{result.songId.artist}{result.songId.album ? ` · ${result.songId.album}` : ''}</p>
                </div>
                <Badge className="ml-auto bg-primary/20 text-primary border-primary/40 text-xs flex-shrink-0">Identified</Badge>
              </div>
            )}

            {/* Metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

              {/* Key */}
              <div className="rounded-lg bg-card/40 border border-border/20 p-3 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Key</p>
                <p className="text-xl font-bold text-primary">{result.key}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{result.mode}</p>
              </div>

              {/* Camelot */}
              <div className="rounded-lg bg-card/40 border border-border/20 p-3 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Camelot</p>
                <p className="text-xl font-bold text-primary">{result.camelot}</p>
                <p className="text-[10px] text-muted-foreground">wheel position</p>
              </div>

              {/* BPM */}
              <div className="rounded-lg bg-card/40 border border-border/20 p-3 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">BPM</p>
                <p className="text-xl font-bold text-primary">{result.bpm}</p>
                <p className="text-[10px] text-muted-foreground">{tempoLabel(result.bpm)}</p>
              </div>

              {/* Mood */}
              <div className="rounded-lg bg-card/40 border border-border/20 p-3 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mood</p>
                <p className="text-sm font-semibold text-foreground leading-tight">{result.mood}</p>
                <p className="text-[10px] text-muted-foreground">detected vibe</p>
              </div>
            </div>

            {/* Energy / Danceability bars */}
            <div className="rounded-lg bg-card/40 border border-border/20 p-3 space-y-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Energy</span>
                <span className="text-primary font-mono">{Math.round(result.energy*100)}%</span>
              </div>
              <MeterBar value={result.energy} color="hsl(142,76%,56%)" />

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Danceability</span>
                <span className="text-primary font-mono">{Math.round(result.danceability*100)}%</span>
              </div>
              <MeterBar value={result.danceability} color="hsl(24,95%,56%)" />
            </div>

            {/* Genre tags */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Nearest Genres</p>
              <div className="flex flex-wrap gap-2">
                {result.genres.map(g => (
                  <Badge
                    key={g}
                    className="bg-primary/15 text-primary border-primary/30 text-xs capitalize"
                  >
                    {g}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Genre map */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Genre Space (Every Noise)</p>
              <GenreMap detected={result.genres} />
            </div>

          </div>
        )}

        {!result && !isAnalyzing && logLines.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm space-y-1">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Upload or record audio to detect key, BPM, Camelot,</p>
            <p>energy, mood, genre tags, and identify the song.</p>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

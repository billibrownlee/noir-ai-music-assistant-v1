import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, X, Volume2, Music2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const NOTE_NAMES = [
  'C1','D1','E1','F1','G1','A1','B1',
  'C2','D2','E2','F2','G2','A2','B2',
  'C3','D3','E3','F3','G3','A3','B3',
  'C4','D4','E4','F4','G4','A4','B4',
  'C5','D5','E5','F5','G5','A5','B5',
];

interface SampleEntry {
  id: string;
  file: File;
  url: string;
  rootNote: string;
  name: string;
}

interface CustomSampleInstrumentProps {
  /** Called with a ready Tone.Sampler, or null when all samples removed */
  onSamplerChange: (sampler: any | null) => void;
}

export function CustomSampleInstrument({ onSamplerChange }: CustomSampleInstrumentProps) {
  const [samples, setSamples] = useState<SampleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const samplerRef = useRef<any>(null);
  const { toast } = useToast();

  // Rebuild sampler whenever samples change
  useEffect(() => {
    if (samples.length === 0) {
      try { samplerRef.current?.dispose(); } catch {}
      samplerRef.current = null;
      onSamplerChange(null);
      return;
    }

    setIsLoading(true);

    import('tone').then(Tone => {
      try { samplerRef.current?.dispose(); } catch {}

      const urls: Record<string, string> = {};
      samples.forEach(s => { urls[s.rootNote] = s.url; });

      const sampler = new Tone.Sampler({
        urls,
        release: 0.8,
        onload: () => {
          setIsLoading(false);
          samplerRef.current = sampler;
          onSamplerChange(sampler);
        },
      }).toDestination();

      samplerRef.current = sampler;
    }).catch(err => {
      console.warn('Sampler load error:', err);
      setIsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples]);

  // Cleanup on unmount
  useEffect(() => () => {
    try { samplerRef.current?.dispose(); } catch {}
    samples.forEach(s => { try { URL.revokeObjectURL(s.url); } catch {} });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const audio = files.filter(
      f => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.name)
    );
    if (!audio.length) {
      toast({ title: 'No audio files', description: 'Upload MP3, WAV, OGG, M4A, or FLAC', variant: 'destructive' });
      return;
    }
    setSamples(prev => {
      const next = [
        ...prev,
        ...audio.map(f => ({
          id: crypto.randomUUID(),
          file: f,
          url: URL.createObjectURL(f),
          rootNote: 'C4',
          name: f.name.replace(/\.[^/.]+$/, ''),
        })),
      ].slice(0, 8);
      return next;
    });
  }, [toast]);

  const updateRoot = useCallback((id: string, note: string) => {
    setSamples(prev => prev.map(s => s.id === id ? { ...s, rootNote: note } : s));
  }, []);

  const remove = useCallback((id: string) => {
    setSamples(prev => {
      const entry = prev.find(s => s.id === id);
      try { if (entry) URL.revokeObjectURL(entry.url); } catch {}
      return prev.filter(s => s.id !== id);
    });
  }, []);

  return (
    <div className="space-y-2.5 p-3 rounded-lg border border-primary/25 bg-primary/5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Custom Sound</span>
          <span className="text-[10px] text-muted-foreground">(replaces default synth)</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isLoading && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />Loading
            </Badge>
          )}
          {!isLoading && samples.length > 0 && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
              Active
            </Badge>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <label
        className={[
          'flex items-center gap-2 p-2.5 rounded border border-dashed cursor-pointer text-xs transition-colors',
          isDragging
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border/40 text-muted-foreground hover:border-primary/50 hover:text-primary',
        ].join(' ')}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          addFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <Upload className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Upload your sound sample — drop or click (MP3, WAV, OGG)</span>
        <input
          type="file"
          multiple
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac"
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) addFiles(files);
            e.target.value = '';
          }}
        />
      </label>

      {/* Uploaded samples list */}
      {samples.length > 0 && (
        <div className="space-y-1.5">
          {samples.map(s => (
            <div key={s.id} className="flex items-center gap-2 px-1">
              <Volume2 className="w-3 h-3 text-primary flex-shrink-0" />
              <span className="text-[11px] text-foreground truncate flex-1 min-w-0">{s.name}</span>
              <span className="text-[10px] text-muted-foreground flex-shrink-0">root:</span>
              <Select value={s.rootNote} onValueChange={v => updateRoot(s.id, v)}>
                <SelectTrigger className="h-6 w-[3.5rem] text-[10px] px-1.5 py-0 flex-shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_NAMES.map(n => (
                    <SelectItem key={n} value={n} className="text-xs py-0.5">{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-muted-foreground hover:text-red-400 flex-shrink-0"
                onClick={() => remove(s.id)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {samples.length === 0 && (
        <p className="text-[10px] text-muted-foreground/50 pl-1">
          No custom sound — using default triangle synth. Upload any sound to replace it.
        </p>
      )}

      <p className="text-[10px] text-muted-foreground/40 pl-1 leading-relaxed">
        Tip: upload a single note of your sound (e.g. a one-shot piano key or vocal chop)
        and set its root note. The melody will pitch-shift your sample across all notes.
      </p>
    </div>
  );
}

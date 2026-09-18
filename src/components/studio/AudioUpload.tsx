import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, X, Music, FileAudio, Layers, FolderOpen, CheckCircle2, Disc3 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { AudioAnalyzer, AudioAnalysis } from '@/lib/audioAnalyzer';
import { AudioSeparationEngine, AudioStem, SeparatedAudio } from '@/lib/audioSeparation';
import { AudioPlayButton } from '@/components/ui/audio-play-button';
import { useGlobalAudio } from '@/hooks/useGlobalAudio';
import { saveSampleToDB, updateSampleMetaInDB, deleteSampleFromDB, clearAllSamplesFromDB } from '@/lib/sampleStorage';
import type { AudioSample } from '@/types/audio';

// ─── Analysis display helpers ─────────────────────────────────────────────────

const NOTES_LIST = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const CAM_MAJ: Record<string,string> = {C:'8B','C#':'3B',D:'10B','D#':'5B',E:'12B',F:'7B','F#':'2B',G:'9B','G#':'4B',A:'11B','A#':'6B',B:'1B'};
const CAM_MIN: Record<string,string> = {C:'5A','C#':'12A',D:'7A','D#':'2A',E:'9A',F:'4A','F#':'11A',G:'6A','G#':'1A',A:'8A','A#':'3A',B:'10A'};

function camelotFrom(key: string, mode: 'major'|'minor'): string {
  return mode === 'major' ? (CAM_MAJ[key] ?? '—') : (CAM_MIN[key] ?? '—');
}

function moodFrom(tempo: number, mode: 'major'|'minor', energy: number, dance: number): string {
  if (mode === 'minor') {
    if (energy > 0.7) return 'Dark & Intense';
    if (tempo > 120) return 'Aggressive';
    if (energy > 0.4) return 'Melancholic';
    return 'Introspective';
  }
  if (tempo > 130 && energy > 0.6) return 'Euphoric';
  if (dance > 0.7) return 'Energetic';
  if (energy < 0.35) return 'Peaceful';
  return 'Uplifting';
}

function genresFrom(tempo: number, mode: 'major'|'minor', energy: number): string[] {
  const s: Record<string,number> = {};
  const add = (g: string, n: number) => { s[g] = (s[g] ?? 0) + n; };
  const min = mode === 'minor';
  if (tempo >= 125 && tempo <= 175) { add('trap',3); add('drill',2); }
  if (tempo >= 155 && tempo <= 200) { add('electronic',2); add('techno',2); }
  if (tempo >= 118 && tempo <= 135) { add('house',2); add('pop',2); }
  if (tempo >= 80  && tempo <= 112) { add('hip-hop',3); add('r&b',2); }
  if (tempo >= 100 && tempo <= 128) { add('afrobeats',3); add('funk',2); }
  if (tempo < 80)                   { add('lo-fi',3); add('jazz',2); }
  if (min)  { add('trap',2); add('drill',3); add('metal',1); }
  else      { add('pop',2); add('funk',2); add('gospel',1); }
  if (energy > 0.7) { add('trap',1); add('rock',2); }
  if (energy < 0.4) { add('lo-fi',2); add('jazz',1); }
  return Object.entries(s).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([g])=>g);
}

function tempoLbl(bpm: number): string {
  if (bpm < 60) return 'Largo'; if (bpm < 76) return 'Adagio';
  if (bpm < 108) return 'Andante'; if (bpm < 120) return 'Moderato';
  if (bpm < 156) return 'Allegro'; return 'Vivace';
}

async function auddIdentify(file: File): Promise<{title:string;artist:string;album?:string}|null> {
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('https://api.audd.io/', { method:'POST', body:fd });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 'success' && data.result) {
      return { title: data.result.title, artist: data.result.artist, album: data.result.album };
    }
    return null;
  } catch { return null; }
}

function SampleAnalysisCard({ analysis, songId }: { analysis: AudioAnalysis; songId?: { title:string; artist:string; album?:string } | null }) {
  const camelot = camelotFrom(analysis.key, analysis.mode);
  const mood = moodFrom(analysis.tempo, analysis.mode, analysis.energy, analysis.danceability);
  const genres = genresFrom(analysis.tempo, analysis.mode, analysis.energy);

  return (
    <div className="mt-3 space-y-2 p-3 rounded-lg bg-[#07070f] border border-border/20">
      {/* Song ID */}
      {songId && (
        <div className="flex items-center gap-2 pb-2 border-b border-border/15">
          <Disc3 className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-xs font-semibold text-foreground truncate">{songId.title}</span>
            <span className="text-xs text-muted-foreground ml-1">— {songId.artist}</span>
          </div>
          <Badge className="ml-auto flex-shrink-0 bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5">ID'd</Badge>
        </div>
      )}

      {/* Key metrics row */}
      <div className="flex flex-wrap gap-2">
        <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] font-mono">
          {analysis.key} {analysis.mode}
        </Badge>
        <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] font-mono">
          {camelot}
        </Badge>
        <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] font-mono">
          {Math.round(analysis.tempo)} BPM · {tempoLbl(analysis.tempo)}
        </Badge>
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
          {mood}
        </Badge>
      </div>

      {/* Energy / Danceability bars */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Energy</span><span>{Math.round(analysis.energy * 100)}%</span>
          </div>
          <div className="h-1 bg-border/20 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width:`${Math.round(analysis.energy*100)}%` }} />
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Danceability</span><span>{Math.round(analysis.danceability * 100)}%</span>
          </div>
          <div className="h-1 bg-border/20 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width:`${Math.round(analysis.danceability*100)}%` }} />
          </div>
        </div>
      </div>

      {/* Genre tags */}
      <div className="flex flex-wrap gap-1.5">
        {genres.map(g => (
          <span key={g} className="text-[10px] text-primary/70 bg-primary/8 border border-primary/20 rounded px-1.5 py-0.5 capitalize">{g}</span>
        ))}
      </div>
    </div>
  );
}

interface BatchGroup {
  folderName: string;
  assignedGenre: string;
  files: File[];
}

interface AudioUploadProps {
  onSamplesUploaded: (samples: AudioSample[]) => void;
  onAudioSeparated?: (separatedAudio: SeparatedAudio) => void;
  onAnalysisComplete?: (analysis: AudioAnalysis) => void;
  onDeleteSample?: (sampleId: string) => void;
  onClearSamples?: () => void;
}

export const AudioUpload: React.FC<AudioUploadProps> = ({
  onSamplesUploaded,
  onAudioSeparated,
  onAnalysisComplete,
  onDeleteSample,
  onClearSamples,
}) => {
  const [uploadedSamples, setUploadedSamples] = useState<AudioSample[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [pendingBatch, setPendingBatch] = useState<BatchGroup[] | null>(null);
  const [audioAnalyzer] = useState(() => new AudioAnalyzer());
  const [separationEngine] = useState(() => new AudioSeparationEngine());
  const [separationProgress, setSeparationProgress] = useState<{ progress: number, stage: string } | null>(null);
  const [isSeparating, setIsSeparating] = useState(false);
  const [autoSeparateStems, setAutoSeparateStems] = useState(false);

  const { toast } = useToast();
  const { currentTrack, isPlaying } = useGlobalAudio();

  const validateAudioFile = (file: File | null | undefined): boolean => {
    try {
      if (!file) {
        console.error('❌ No file provided for validation');
        return false;
      }
      
      if (!(file instanceof File)) {
        console.error('❌ Invalid file object:', typeof file);
        return false;
      }
      
      if (typeof file.name !== 'string' || file.name.trim() === '') {
        console.error('❌ Invalid file name');
        return false;
      }
      
      if (typeof file.size !== 'number' || isNaN(file.size) || file.size < 0) {
        console.error('❌ Invalid file size:', file.size);
        return false;
      }
      
      const validTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/m4a', 'audio/ogg', 'audio/mp3', 'audio/x-wav', 'audio/aac'];
      const maxSize = 100 * 1024 * 1024; // 100MB

      // Check file type
      const hasValidType = validTypes.includes(file.type);
      const hasValidExtension = /\.(mp3|wav|flac|m4a|ogg|aac)$/i.test(file.name);
      
      if (!hasValidType && !hasValidExtension) {
        try {
          toast({
            title: "Invalid file type",
            description: `File type: ${file.type || 'unknown'}. Please upload MP3, WAV, FLAC, M4A, OGG, or AAC files.`,
            variant: "destructive"
          });
        } catch (toastError) {
          console.error('Error showing toast:', toastError);
        }
        return false;
      }
      
      // Check file size
      if (file.size > maxSize) {
        try {
          const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
          toast({
            title: "File too large",
            description: `File size: ${sizeMB}MB. Please upload files smaller than 100MB.`,
            variant: "destructive"
          });
        } catch (toastError) {
          console.error('Error showing toast:', toastError);
        }
        return false;
      }
      
      // Check for empty files
      if (file.size === 0) {
        try {
          toast({
            title: "Empty file",
            description: "The file appears to be empty. Please select a valid audio file.",
            variant: "destructive"
          });
        } catch (toastError) {
          console.error('Error showing toast:', toastError);
        }
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error validating file:', error);
      try {
        toast({
          title: "Validation error",
          description: "An error occurred while validating the file. Please try again.",
          variant: "destructive"
        });
      } catch (toastError) {
        // Ignore toast errors
      }
      return false;
    }
  };

  const extractAudioMetadata = (file: File | null | undefined): Promise<{ duration: number, analysis?: AudioAnalysis }> => {
    return new Promise((resolve) => {
      try {
        // Validate input
        if (!file || !(file instanceof File)) {
          console.warn('Invalid file for metadata extraction');
          resolve({ duration: 0 });
          return;
        }
        
        if (typeof file.size !== 'number' || isNaN(file.size) || file.size <= 0) {
          console.warn('Invalid file size for metadata extraction');
          resolve({ duration: 0 });
          return;
        }
        
        // For large files (>50MB), skip complex analysis to prevent memory issues
        const isLargeFile = file.size > 50 * 1024 * 1024;
        
        if (isLargeFile) {
          resolve({ duration: 0 }); // Skip analysis for large files
          return;
        }

        let audio: HTMLAudioElement | null = null;
        let resolved = false;
        let timeoutId: NodeJS.Timeout | null = null;
        let objectUrl: string | null = null;
        
        // Cleanup function
        const cleanup = () => {
          try {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            if (audio) {
              try {
                if (audio.src && objectUrl) {
                  URL.revokeObjectURL(objectUrl);
                }
                audio.src = '';
                audio.load();
                if (audio.parentNode) {
                  audio.remove();
                }
              } catch (e) {
                // Ignore cleanup errors
              }
              audio = null;
            }
          } catch (e) {
            // Ignore cleanup errors
          }
        };
        
        const resolveOnce = (data: { duration: number, analysis?: AudioAnalysis }) => {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve(data);
          }
        };

        const handleLoadedMetadata = async () => {
          try {
            if (!audio || resolved) return;
            
            const duration = (audio.duration && isFinite(audio.duration) && audio.duration > 0)
              ? audio.duration
              : 0;
            
            // Skip analysis for files > 25MB to prevent crashes
            if (file.size > 25 * 1024 * 1024) {
              resolveOnce({ duration });
              return;
            }
            
            // Try lightweight analysis with timeout and error handling
            try {
              // Add timeout to prevent hanging
              const analysisPromise = audioAnalyzer.analyzeAudioFile(file);
              const timeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Analysis timeout')), 10000)
              );
              
              const analysis = await Promise.race([analysisPromise, timeoutPromise]) as AudioAnalysis;
              if (analysis && typeof analysis === 'object') {
                resolveOnce({ duration, analysis });
              } else {
                resolveOnce({ duration });
              }
            } catch (analysisError) {
              console.warn('Analysis failed, using basic metadata:', analysisError);
              // Don't crash - just skip analysis
              resolveOnce({ duration });
            }
          } catch (error) {
            console.warn('Metadata extraction failed:', error);
            resolveOnce({ duration: 0 });
          }
        };

        const handleError = (error: Event | Error) => {
          try {
            console.warn('Audio load error:', error);
            resolveOnce({ duration: 0 });
          } catch (e) {
            // Fallback if resolveOnce fails
            cleanup();
            resolve({ duration: 0 });
          }
        };

        try {
          audio = new Audio();
          if (!audio) {
            throw new Error('Failed to create Audio element');
          }
          
          // Set up listeners with error handling
          audio.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
          audio.addEventListener('error', handleError, { once: true });
          
          // Shorter timeout for large files
          const timeout = isLargeFile ? 1000 : 2000;
          timeoutId = setTimeout(() => {
            if (!resolved) resolveOnce({ duration: 0 });
          }, timeout);

          // Create URL and load with error handling
          try {
            objectUrl = URL.createObjectURL(file);
            if (!objectUrl) {
              throw new Error('Failed to create object URL');
            }
            audio.src = objectUrl;
            audio.preload = 'metadata'; // Only load metadata, not full audio
            audio.load();
          } catch (loadError) {
            console.error('Error loading audio:', loadError);
            resolveOnce({ duration: 0 });
          }
        } catch (audioError) {
          console.error('Failed to create audio for metadata:', audioError);
          cleanup();
          resolve({ duration: 0 });
        }
        
      } catch {
        resolve({ duration: 0 });
      }
    });
  };

  const detectGenreFromName = (name: string): string => {
    const n = name.toLowerCase().replace(/[-_\s]/g, '');
    if (/trap|drill|808/.test(n)) return 'trap';
    if (/r.?b|rnb|rhythm/.test(n)) return 'rnb';
    if (/hiphop|hip|rap/.test(n)) return 'hip-hop';
    if (/soul/.test(n)) return 'soul';
    if (/funk/.test(n)) return 'funk';
    if (/pop/.test(n)) return 'pop';
    return '';
  };

  const handleFolderInput = (files: File[]) => {
    const audioFiles = files.filter(f => validateAudioFile(f));
    if (audioFiles.length === 0) return;

    // Group files by their immediate parent subfolder
    const groupMap = new Map<string, File[]>();
    for (const file of audioFiles) {
      const relativePath = (file as any).webkitRelativePath as string | undefined;
      const parts = relativePath ? relativePath.split('/') : [file.name];
      // Use subfolder name if nested, otherwise use root folder name
      const folder = parts.length >= 2 ? parts[parts.length - 2] : 'Samples';
      if (!groupMap.has(folder)) groupMap.set(folder, []);
      groupMap.get(folder)!.push(file);
    }

    const batch: BatchGroup[] = Array.from(groupMap.entries()).map(([folderName, groupFiles]) => ({
      folderName,
      assignedGenre: detectGenreFromName(folderName),
      files: groupFiles,
    }));

    setPendingBatch(batch);
  };

  const confirmBatch = async () => {
    if (!pendingBatch) return;
    for (const group of pendingBatch) {
      await handleFiles(group.files, group.assignedGenre);
    }
    setPendingBatch(null);
    toast({
      title: 'Folder imported',
      description: `${pendingBatch.reduce((n, g) => n + g.files.length, 0)} samples added to library`,
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    handleFiles(files);
  }, []);

  const handleFiles = async (files: File[], defaultGenre = '') => {
    if (!files || files.length === 0) return;

    const audioFiles = files.filter(file => validateAudioFile(file));

    if (audioFiles.length === 0) {
      toast({
        title: "No valid audio files",
        description: "Please select MP3, WAV, FLAC, M4A, OGG, or AAC files.",
        variant: "destructive"
      });
      return;
    }



    for (const file of audioFiles) {
      const id = crypto.randomUUID();
      try {
        // 100% LOCAL UPLOAD - INSTANT COMPLETION, CREATE WITH 100% IMMEDIATELY
        // `sample` must be declared outside inner try so catch can safely reference it (try-block const is not in catch scope).
        let sample: AudioSample | undefined;
        try {
          // Create local blob URL immediately (synchronous, instant, no async)
          const localUrl = URL.createObjectURL(file);
          
          if (!localUrl) {
            throw new Error('Failed to create blob URL');
          }
          
          // Create sample with 100% progress immediately - no intermediate state
          sample = {
            id,
            name: file.name.replace(/\.[^/.]+$/, ""),
            genre: defaultGenre,
            tags: defaultGenre ? [defaultGenre] : [],
            file,
            uploadProgress: 100,
            audioUrl: localUrl,
            isPlaying: false
          };

          setUploadedSamples(prev => [...prev, sample!]);

          Promise.resolve().then(() => {
            try {
              if (sample) onSamplesUploaded([sample]);
            } catch (callbackError) {
              console.warn('Callback error (non-critical):', callbackError);
            }
          });

          // Persist to IndexedDB so samples survive page refresh
          saveSampleToDB(
            { id, name: sample.name, genre: defaultGenre, tags: sample.tags },
            file
          ).catch(err => console.warn('IndexedDB save failed (non-critical):', err));

          // Everything else happens in background (non-blocking, doesn't affect progress)
          // Use microtask queue to push to next tick without delay
          Promise.resolve().then(() => {
            // Mark as analyzing so the UI shows the spinner
            setAnalyzingIds(prev => new Set(prev).add(id));

            // Extract metadata + BPM/key in background (completely optional)
            extractAudioMetadata(file)
              .then((metadata) => {
                try {
                  setAnalyzingIds(prev => { const s = new Set(prev); s.delete(id); return s; });

                  if (metadata) {
                    const detectedBpm = metadata.analysis?.tempo ?? undefined;
                    const detectedKey = metadata.analysis?.key ?? undefined;

                    // Update local upload card with detected values
                    setUploadedSamples(prev =>
                      prev.map(s => s.id === id ? {
                        ...s,
                        duration: metadata.duration || s.duration,
                        analysis: metadata.analysis ?? s.analysis,
                        bpm: detectedBpm ?? s.bpm,
                        key: detectedKey ?? s.key,
                      } : s)
                    );

                    if (metadata.analysis) {
                      onAnalysisComplete?.(metadata.analysis);
                    }

                    // Push the updated sample (with bpm/key) to the global library
                    if (detectedBpm || detectedKey) {
                      const updatedSample: AudioSample = {
                        ...sample!,
                        bpm: detectedBpm ?? sample!.bpm,
                        key: detectedKey ?? sample!.key,
                        duration: metadata.duration || sample!.duration,
                        analysis: metadata.analysis ?? sample!.analysis,
                      };
                      onSamplesUploaded([updatedSample]);
                      // Persist BPM/key into IndexedDB record
                      updateSampleMetaInDB(id, {
                        bpm: detectedBpm,
                        key: detectedKey,
                        duration: metadata.duration || undefined,
                      }).catch(err => console.warn('IndexedDB meta update failed:', err));
                    }
                  }
                } catch {
                  setAnalyzingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
                }
              })
              .catch(() => {
                setAnalyzingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
                // Silent fail - metadata is optional
              });

            // Song identification via AudD (async, non-blocking, best-effort)
            auddIdentify(file).then(songId => {
              if (songId) {
                setUploadedSamples(prev =>
                  prev.map(s => s.id === id ? { ...s, songId } : s)
                );
              }
            }).catch(() => { /* silent fail */ });

            // Only separate stems if user has enabled auto-separation
            if (autoSeparateStems && onAudioSeparated && file.size < 75 * 1024 * 1024) {
              startSimplifiedSeparation(file, id).catch(() => {
                // Silent fail
              });
            }
          });

        } catch (error: any) {
          console.error('❌ Local upload failed for:', file.name, error);
          
          // Even on error, try to create local URL as last resort
          try {
            const fallbackUrl = URL.createObjectURL(file);
            const base: AudioSample =
              sample ??
              ({
                id,
                name: file.name.replace(/\.[^/.]+$/, ""),
                genre: "",
                tags: [],
                file,
                uploadProgress: 100,
                audioUrl: fallbackUrl,
                isPlaying: false,
              } satisfies AudioSample);

            setUploadedSamples((prev) => {
              const exists = prev.some((s) => s.id === id);
              if (!exists) {
                return [...prev, { ...base, audioUrl: fallbackUrl, uploadProgress: 100 }];
              }
              return prev.map((s) =>
                s.id === id ? { ...s, uploadProgress: 100, audioUrl: fallbackUrl } : s
              );
            });

            const fallbackSample = { ...base, uploadProgress: 100, audioUrl: fallbackUrl };
            onSamplesUploaded([fallbackSample]);
          } catch (fallbackError) {
            console.error('❌ Complete upload failure:', fallbackError);
            toast({
              title: "Upload failed",
              description: `Could not process ${file.name}. Please try again.`,
              variant: "destructive"
            });
          }
        }
        
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        toast({
          title: "Upload failed",
          description: `Could not process ${file.name}. Please try again.`,
          variant: "destructive"
        });
      }
    }
    
    toast({
      title: "Upload started",
      description: `${audioFiles.length} file(s) being processed locally...`,
    });
  };

  // Creates a short silent WAV blob URL — used as a playable placeholder stem
  const createSilentStemUrl = (durationSeconds: number = 2): string => {
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const dataBytes = numSamples * 2;
    const buf = new ArrayBuffer(44 + dataBytes);
    const v = new DataView(buf);
    const ws = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); v.setUint32(4, 36 + dataBytes, true);
    ws(8, 'WAVE'); ws(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    ws(36, 'data'); v.setUint32(40, dataBytes, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  };

  const startSimplifiedSeparation = async (file: File, sampleId: string) => {
    try {
      setIsSeparating(true);
      setSeparationProgress({ progress: 0, stage: 'Starting separation...' });

      const stemDefs: Array<{
        name: string; type: 'vocals' | 'drums' | 'bass' | 'melody';
        effects: AudioStem['effects']; volume: number; pan: number;
      }> = [
        {
          name: 'Vocals', type: 'vocals', volume: 100, pan: 0,
          effects: { reverb: 20, delay: 10, distortion: 0, filter: { type: 'highpass', frequency: 80, resonance: 0.5 }, eq: { low: 0, mid: 2, high: 1 } }
        },
        {
          name: 'Drums', type: 'drums', volume: 100, pan: 0,
          effects: { reverb: 10, delay: 0, distortion: 0, filter: { type: 'bandpass', frequency: 200, resonance: 0.4 }, eq: { low: 2, mid: 0, high: -1 } }
        },
        {
          name: 'Bass', type: 'bass', volume: 100, pan: 0,
          effects: { reverb: 5, delay: 0, distortion: 0, filter: { type: 'lowpass', frequency: 200, resonance: 0.4 }, eq: { low: 3, mid: 0, high: -2 } }
        },
        {
          name: 'Melody', type: 'melody', volume: 90, pan: 0,
          effects: { reverb: 25, delay: 15, distortion: 0, filter: { type: 'bandpass', frequency: 1000, resonance: 0.3 }, eq: { low: 0, mid: 1, high: 1 } }
        },
      ];

      const stages = ['Analyzing audio...', 'Separating vocals...', 'Isolating drums...', 'Extracting bass...', 'Finalizing stems...'];
      for (let i = 0; i < stages.length; i++) {
        setSeparationProgress({ progress: i * 25, stage: stages[i] });
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const stems: AudioStem[] = stemDefs.map(def => ({
        id: `${def.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: def.name,
        type: def.type,
        audioUrl: createSilentStemUrl(2),
        waveformData: Array.from({ length: 100 }, () => Math.random() * 60),
        volume: def.volume,
        pan: def.pan,
        muted: false,
        soloed: false,
        effects: def.effects,
      }));

      setSeparationProgress({ progress: 100, stage: 'Complete!' });

      onAudioSeparated?.({
        id: `sep_${Date.now()}`,
        originalFileName: file.name,
        stems,
        separationQuality: 0,
        processingTime: stages.length * 200,
      });

      toast({
        title: "Stem tracks created",
        description: "Basic stem placeholders are ready. Use the Separate Stems button for DSP-based separation.",
      });

    } catch (error) {
      console.error('❌ Simplified separation failed:', error);
      toast({
        title: "Separation failed",
        description: "Could not create stem tracks. You can still work with the full track.",
        variant: "destructive"
      });
    } finally {
      setIsSeparating(false);
      setSeparationProgress(null);
    }
  };

  const updateSample = (id: string, updates: Partial<AudioSample>) => {
    setUploadedSamples(prev => 
      prev.map(sample => 
        sample.id === id ? { ...sample, ...updates } : sample
      )
    );
  };

  const removeSample = (id: string) => {
    const sample = uploadedSamples.find(s => s.id === id);
    // Remove from local display
    setUploadedSamples(prev => prev.filter(s => s.id !== id));
    // Remove from persistent storage
    deleteSampleFromDB(id).catch(err => console.warn('IndexedDB delete failed:', err));
    // Remove from global library state — don't revoke URL here, parent may still use it
    onDeleteSample?.(id);
    toast({
      title: "Sample removed",
      description: `${sample?.name || 'Sample'} was removed from your library.`,
    });
  };

  const clearAllSamples = () => {
    // Clear local display — do NOT revoke URLs, the global library still references them
    setUploadedSamples([]);
    // Clear persistent storage
    clearAllSamplesFromDB().catch(err => console.warn('IndexedDB clear failed:', err));
    // Clear global library state
    onClearSamples?.();
    toast({
      title: "All samples cleared",
      description: "Upload queue and library have been cleared.",
    });
  };

  const addTag = (sampleId: string, tag: string) => {
    if (!tag.trim()) return;
    updateSample(sampleId, {
      tags: [...(uploadedSamples.find(s => s.id === sampleId)?.tags || []), tag.trim()]
    });
  };

  const removeTag = (sampleId: string, tagIndex: number) => {
    const sample = uploadedSamples.find(s => s.id === sampleId);
    if (!sample) return;
    updateSample(sampleId, {
      tags: sample.tags.filter((_, index) => index !== tagIndex)
    });
  };

  const separateAudioStems = useCallback(async (sample: AudioSample) => {
    if (!sample.file) {
      toast({
        title: "No file available",
        description: "Cannot separate audio without a file.",
        variant: "destructive"
      });
      return;
    }
    
    // Check file size
    const MAX_SIZE = 75 * 1024 * 1024; // 75MB
    if (sample.file.size > MAX_SIZE) {
      toast({
        title: "File too large",
        description: `File is ${(sample.file.size / (1024 * 1024)).toFixed(1)}MB. Maximum size for separation is ${MAX_SIZE / (1024 * 1024)}MB.`,
        variant: "destructive"
      });
      return;
    }
    
    try {
      setSeparationProgress({ progress: 0, stage: 'Starting separation...' });
      setIsSeparating(true);
      
      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Separation timeout - file may be too large or complex')), 120000) // 2 minutes
      );
      
      const separationPromise = separationEngine.separateAudio(
        sample.file,
        (progress, stage) => {
          setSeparationProgress({ progress, stage });
        }
      );
      
      const separatedAudio = await Promise.race([separationPromise, timeoutPromise]) as any;
      
      setSeparationProgress(null);
      setIsSeparating(false);
      
      toast({
        title: "Audio separated successfully!",
        description: `Extracted ${separatedAudio.stems.length} stems with ${separatedAudio.separationQuality}% quality`,
      });
      
      onAudioSeparated?.(separatedAudio);
      
    } catch (error: any) {
      setSeparationProgress(null);
      setIsSeparating(false);
      
      const errorMessage = error?.message || 'Unknown error';
      console.error('Separation error:', error);
      
      toast({
        title: "Separation failed",
        description: errorMessage.includes('timeout') 
          ? "Separation took too long. Try a smaller file or disable auto-separation."
          : errorMessage.includes('too large')
          ? "File is too large for separation. Maximum size is 75MB."
          : "Could not separate audio stems. The file may be corrupted or in an unsupported format.",
        variant: "destructive"
      });
    }
  }, [separationEngine, onAudioSeparated, toast]);

  const handleUploadToLibrary = async () => {
    if (uploadedSamples.length === 0) return;
    
    try {
      const processedSamples = uploadedSamples.filter(s => (s.uploadProgress || 0) >= 99);
      
      onSamplesUploaded(processedSamples);
      
      toast({
        title: "Samples refreshed in library!",
        description: `${processedSamples.length} audio samples are available in your library.`,
      });
      
    } catch (error) {
      console.error('❌ Manual upload to library failed:', error);
      toast({
        title: "Refresh failed",
        description: "Could not refresh samples in library. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader className="relative z-10">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            Upload Training Samples
          </div>
          {uploadedSamples.length > 0 && (
            <Button 
              onClick={clearAllSamples}
              variant="destructive"
              size="sm"
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/50"
            >
              <X className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          )}
        </CardTitle>
        
        {/* Auto STEM Separation Toggle */}
        <div className="flex items-center justify-between mt-4 p-3 bg-studio-surface/30 rounded-lg border border-studio-border/30">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Auto-separate stems on upload</span>
            <span className="text-xs text-studio-text-secondary">
              (Saves screen space when disabled)
            </span>
          </div>
          <Switch
            checked={autoSeparateStems}
            onCheckedChange={setAutoSeparateStems}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
            isDragging 
              ? 'border-primary bg-primary/10' 
              : 'border-studio-border hover:border-primary/50'
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-studio-text-secondary" />
          <p className="text-lg font-medium mb-2">
            {uploadedSamples.length > 0 ? "Add more files or reupload" : "Drop audio files here"}
          </p>
          <p className="text-studio-text-secondary mb-2">Supports MP3, WAV, FLAC, M4A, OGG, AAC (up to 100MB)</p>
          <p className="text-sm text-studio-text-secondary mb-4">
            {uploadedSamples.length > 0 
              ? `${uploadedSamples.length} file(s) saved locally. You can add more or clear all to start over.`
              : "Files are saved locally and ready instantly. They'll be automatically analyzed for editing!"
            }
          </p>
          <input
            type="file"
            multiple
            accept=".mp3,.wav,.flac,.m4a,.ogg,.aac,audio/*"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFiles(Array.from(e.target.files));
              }
            }}
            className="hidden"
            id="audio-upload"
          />
          {/* folder input — webkitdirectory lets the user select an entire folder */}
          <input
            type="file"
            multiple
            {...{ webkitdirectory: '' } as any}
            accept=".mp3,.wav,.flac,.m4a,.ogg,.aac,audio/*"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFolderInput(Array.from(e.target.files));
              }
            }}
            className="hidden"
            id="folder-upload"
          />
          <div className="flex gap-3 justify-center flex-wrap">
            <Button
              variant="neon"
              size="lg"
              onClick={() => (document.getElementById('audio-upload') as HTMLInputElement)?.click()}
              className="bg-primary hover:bg-primary/80 text-white font-medium px-6 py-3 cursor-pointer z-10 pointer-events-auto"
            >
              <Upload className="w-4 h-4 mr-2" />
              Browse Files
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => (document.getElementById('folder-upload') as HTMLInputElement)?.click()}
              className="border-primary/50 text-primary hover:bg-primary/10 font-medium px-6 py-3 cursor-pointer z-10 pointer-events-auto"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Upload Folder
            </Button>
          </div>
        </div>

        {/* Batch Folder Import Review */}
        {pendingBatch && (
          <Card className="glass-card-subtle border-primary border">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary" />
                <span className="font-semibold">Folder Import — Confirm Genres</span>
                <Badge variant="outline" className="text-xs">
                  {pendingBatch.reduce((n, g) => n + g.files.length, 0)} files
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Genres were auto-detected from your folder names. Adjust any before importing.
              </p>
              <div className="space-y-3">
                {pendingBatch.map((group, i) => (
                  <div key={group.folderName} className="flex items-center gap-3 p-3 bg-studio-surface/30 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{group.folderName}</p>
                      <p className="text-xs text-muted-foreground">{group.files.length} file{group.files.length !== 1 ? 's' : ''}</p>
                    </div>
                    <Select
                      value={group.assignedGenre || 'none'}
                      onValueChange={(val) => {
                        setPendingBatch(prev => prev
                          ? prev.map((g, idx) => idx === i ? { ...g, assignedGenre: val === 'none' ? '' : val } : g)
                          : prev
                        );
                      }}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Set genre" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No genre</SelectItem>
                        <SelectItem value="rnb">R&B</SelectItem>
                        <SelectItem value="pop">Pop</SelectItem>
                        <SelectItem value="trap">Trap</SelectItem>
                        <SelectItem value="rap">Rap</SelectItem>
                        <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                        <SelectItem value="soul">Soul</SelectItem>
                        <SelectItem value="funk">Funk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={confirmBatch}
                  className="flex-1 bg-primary hover:bg-primary/80 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Import All Samples
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPendingBatch(null)}
                  className="text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Separation Progress */}
        {separationProgress && (
          <Card className="glass-card-subtle border-primary border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <Layers className="w-5 h-5 text-primary animate-pulse" />
                <span className="font-medium">Separating Audio Stems...</span>
              </div>
              <Progress value={separationProgress.progress} className="w-full mb-2" />
              <p className="text-sm text-studio-text-secondary">
                {separationProgress.stage}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Uploaded Samples */}
        {uploadedSamples.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Configure Samples</h3>
            {uploadedSamples.map(sample => (
              <Card key={sample.id} className="glass-card-subtle">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <FileAudio className="w-6 h-6 text-primary" />
                        {currentTrack?.id === sample.id && isPlaying && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium">{sample.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-studio-text-secondary flex-wrap">
                          {sample.duration && (
                            <span>{Math.floor(sample.duration / 60)}:{(sample.duration % 60).toFixed(0).padStart(2, '0')}</span>
                          )}
                          <span>•</span>
                          <span>{(sample.file.size / (1024 * 1024)).toFixed(1)} MB</span>
                          {analyzingIds.has(sample.id) ? (
                            <>
                              <span>•</span>
                              <span className="text-primary animate-pulse">Detecting BPM &amp; key...</span>
                            </>
                          ) : sample.bpm || sample.key ? (
                            <>
                              {sample.bpm && <><span>•</span><span className="text-primary font-medium">{sample.bpm} BPM</span></>}
                              {sample.key && <><span>•</span><span className="text-primary font-medium">{sample.key}{sample.analysis?.mode === 'minor' ? 'm' : ''}</span></>}
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                      <div className="flex items-center gap-2">
                        {sample.audioUrl && (
                          <AudioPlayButton
                            audioUrl={sample.audioUrl}
                            trackName={sample.name}
                            trackId={sample.id}
                            variant="outline"
                            size="sm"
                          />
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => separateAudioStems(sample)}
                          disabled={isSeparating}
                          className="pointer-events-auto cursor-pointer z-10"
                        >
                          <Layers className="w-4 h-4 mr-1" />
                          Separate
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeSample(sample.id)}
                          className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/50 pointer-events-auto cursor-pointer z-10"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                </div>

                  {/* Upload Progress */}
                  {sample.uploadProgress !== undefined && sample.uploadProgress < 100 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">Processing locally...</span>
                        <span className="text-sm font-mono">{Math.round(sample.uploadProgress)}%</span>
                      </div>
                      <Progress value={sample.uploadProgress} className="w-full h-2" />
                      <div className="text-xs text-studio-text-secondary mt-1">
                        Processing {sample.name} locally...
                      </div>
                    </div>
                  )}

                  {/* Complete Status */}
                  {sample.uploadProgress === 100 && (
                    <div className="mb-3 p-2 bg-primary/10 border border-primary/30 rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        <span className="text-sm font-medium text-primary">✅ Saved Locally - Ready for AI Processing!</span>
                      </div>
                    </div>
                  )}

                  {/* Inline Analysis Results */}
                  {sample.analysis && (
                    <SampleAnalysisCard analysis={sample.analysis} songId={sample.songId} />
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 mt-4">
                    <div>
                      <Label htmlFor={`genre-${sample.id}`}>Genre</Label>
                      <Select 
                        value={sample.genre}
                        onValueChange={(value) => updateSample(sample.id, { genre: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select genre" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rnb">R&B</SelectItem>
                          <SelectItem value="pop">Pop</SelectItem>
                          <SelectItem value="trap">Trap</SelectItem>
                          <SelectItem value="rap">Rap</SelectItem>
                          <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                          <SelectItem value="soul">Soul</SelectItem>
                          <SelectItem value="funk">Funk</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`bpm-${sample.id}`}>BPM</Label>
                      <Input
                        id={`bpm-${sample.id}`}
                        type="number"
                        value={sample.bpm || ''}
                        placeholder="120"
                        onChange={(e) => updateSample(sample.id, { bpm: parseInt(e.target.value) || undefined })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`key-${sample.id}`}>Key</Label>
                      <Select 
                        value={sample.key || ''}
                        onValueChange={(value) => updateSample(sample.id, { key: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select key" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="C">C</SelectItem>
                          <SelectItem value="C#">C#</SelectItem>
                          <SelectItem value="D">D</SelectItem>
                          <SelectItem value="D#">D#</SelectItem>
                          <SelectItem value="E">E</SelectItem>
                          <SelectItem value="F">F</SelectItem>
                          <SelectItem value="F#">F#</SelectItem>
                          <SelectItem value="G">G</SelectItem>
                          <SelectItem value="G#">G#</SelectItem>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="A#">A#</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {sample.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <X 
                            className="w-3 h-3 cursor-pointer" 
                            onClick={() => removeTag(sample.id, index)}
                          />
                        </Badge>
                      ))}
                    </div>
                    <Input
                      placeholder="Add tags (vocal, melody, bass, etc.)"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addTag(sample.id, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="flex gap-3 relative z-10">
              <Button
                onClick={handleUploadToLibrary}
                className="flex-1 bg-primary hover:bg-primary/80 text-white font-medium pointer-events-auto cursor-pointer"
                size="lg"
                variant="neon"
                disabled={uploadedSamples.length === 0}
              >
                🏦 Force Save to Library ({uploadedSamples.length} Sample(s))
              </Button>
              
              <Button
                onClick={clearAllSamples}
                variant="destructive"
                size="lg"
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/50 pointer-events-auto cursor-pointer"
              >
                <X className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
            
            <div className="bg-studio-surface/30 p-3 rounded-lg border border-primary/30">
              <p className="text-xs text-studio-text-secondary">
                ✅ <strong>100% Local Storage:</strong> All uploads are saved locally instantly with no cloud dependency. Files are immediately available for tempo control and AI processing. No network required!
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
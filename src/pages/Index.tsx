import { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  Upload, SlidersHorizontal, Mic, Sliders, Zap,
  FolderOpen, Sparkles, BookOpen, History, Mic2, Activity,
  Timer, Scissors, Wand2, Music2, Music, Bot,
  BarChart2, Settings as SettingsIconLucide,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AudioOutputSelector } from "@/components/ui/audio-output-selector";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import StudioHeader from "@/components/studio/StudioHeader";
import PromptBuilder from "@/components/studio/PromptBuilder";
import AudioPlayer from "@/components/studio/AudioPlayer";
import GenerationHistory, { type GeneratedTrack } from "@/components/studio/GenerationHistory";
import { AudioUpload } from "@/components/studio/AudioUpload";
import { SampleLibrary } from "@/components/studio/SampleLibrary";
import { AIChatAssistant } from "@/components/studio/AIChatAssistant";
import { DrumPatternGenerator } from "@/components/studio/DrumPatternGenerator";
import { CounterMelodyGenerator } from "@/components/studio/CounterMelodyGenerator";
import { RecordingStudio } from "@/components/studio/RecordingStudio";
import { MixingConsole } from "@/components/studio/MixingConsole";
import { MasteringSuite } from "@/components/studio/MasteringSuite";
import { StemEditor } from "@/components/studio/StemEditor";
import { TempoControl } from "@/components/studio/TempoControl";
import { AudioGenerator } from "@/components/studio/AudioGenerator";
import { MusicGenerator } from "@/components/studio/MusicGenerator";
import { MidiGenerator } from "@/components/studio/MidiGenerator";
import { PublicDomainMelodyBank } from "@/components/studio/PublicDomainMelodyBank";
import { AudioAnalyzer } from "@/components/studio/AudioAnalyzer";
import type { MelodyNote } from "@/lib/melodyEngine";
import { SeparatedAudio } from "@/lib/audioSeparation";
import { AudioAnalysis } from "@/lib/audioAnalyzer";
import { useGlobalAudio } from "@/hooks/useGlobalAudio";
import { StudioTabErrorBoundary } from "@/components/StudioTabErrorBoundary";
import { AudioEffectsQuickPanel } from "@/components/studio/AudioEffectsQuickPanel";
import { GlobalAudioBar } from "@/components/studio/GlobalAudioBar";
import { loadAllSamplesFromDB, deleteSampleFromDB, clearAllSamplesFromDB } from "@/lib/sampleStorage";
import type { AudioSample } from "@/types/audio";

interface Track {
  id: string;
  title: string;
  genre: string;
  duration: number;
  bpm: number;
  key: string;
  prompt: string;
  timestamp: Date;
  liked: boolean;
  audioUrl?: string;
}

/** Thin horizontal label that separates groups of tools within a tab */
const SectionDivider = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3 pt-1 pb-0.5">
    <div className="h-px flex-1 bg-border/30" />
    <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-medium shrink-0">
      {label}
    </span>
    <div className="h-px flex-1 bg-border/30" />
  </div>
);

const Index = () => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [generationHistory, setGenerationHistory] = useState<GeneratedTrack[]>([]);
  const [pdMelodyNotes, setPdMelodyNotes] = useState<MelodyNote[] | undefined>();
  const [pdMelodyKey, setPdMelodyKey] = useState<string | undefined>();
  const [pdMelodyScale, setPdMelodyScale] = useState<string | undefined>();
  const [separatedAudio, setSeparatedAudio] = useState<SeparatedAudio | null>(null);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysis | null>(null);
  const [uploadedSamples, setUploadedSamples] = useState<AudioSample[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(true);
  const [isTempoOpen, setIsTempoOpen] = useState(false);
  const [isSampleLibraryOpen, setIsSampleLibraryOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStemEditorOpen, setIsStemEditorOpen] = useState(false);
  /** Keeps each studio tab mounted after first visit so audio/recording state is not torn down on switch. */
  const [studioTab, setStudioTab] = useState("create");
  const [visitedStudioTabs, setVisitedStudioTabs] = useState(() => new Set<string>(["create"]));
  const { playTrack, setAudioOutputDevice } = useGlobalAudio();

  const [user, setUser] = useState<User | null>(null);

  // Restore persisted samples from IndexedDB on first mount
  useEffect(() => {
    loadAllSamplesFromDB()
      .then(stored => {
        if (stored.length > 0) setUploadedSamples(stored as AudioSample[]);
      })
      .catch(err => console.warn('Could not restore samples from IndexedDB:', err));
  }, []);

  const loadUserSamples = useCallback(async (userId: string | null | undefined) => {
    try {
      if (!userId || typeof userId !== 'string' || userId.trim() === '') {
        console.warn('Invalid userId for loading samples');
        return;
      }
      const { data, error } = await supabase
        .from('audio_samples')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) { console.error('Failed to load user samples:', error); return; }
      const transformedSamples = (data || []).map((sample: Record<string, unknown>) => {
        try {
          const result: AudioSample = {
            id: typeof sample?.id === 'string' ? sample.id : crypto.randomUUID(),
            name: typeof sample?.filename === 'string' ? sample.filename : 'Unknown',
            audioUrl: typeof sample?.public_url === 'string' ? sample.public_url : '',
            genre: typeof sample?.genre === 'string' ? sample.genre : 'Unknown',
            bpm: typeof sample?.bpm === 'number' && !isNaN(sample.bpm) ? sample.bpm : undefined,
            key: typeof sample?.key === 'string' ? sample.key : undefined,
            duration: typeof sample?.duration === 'number' && !isNaN(sample.duration) ? sample.duration : undefined,
            tags: Array.isArray(sample?.tags) ? (sample.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [],
          };
          return result;
        } catch { return null; }
      }).filter((s): s is AudioSample => s !== null && !!s.audioUrl);
      setUploadedSamples(transformedSamples);
    } catch (error) {
      console.error('Error loading user samples:', error);
      setUploadedSamples([]);
    }
  }, []);

  useEffect(() => {
    let subscription: any = null;
    try {
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          try {
            setUser(session?.user ?? null);
            if (session?.user?.id) loadUserSamples(session.user.id);
          } catch (e) { console.warn('Error setting user:', e); }
        })
        .catch(e => { console.warn('Error getting session:', e); setUser(null); });
      try {
        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
          try {
            setUser(session?.user ?? null);
            if (session?.user?.id) loadUserSamples(session.user.id);
            else setUploadedSamples([]);
          } catch (e) { console.warn('Error handling auth change:', e); }
        });
        subscription = authSub;
      } catch (e) { console.warn('Error setting up auth listener:', e); }
    } catch (error) { console.error('Error in auth effect:', error); }
    return () => { try { subscription?.unsubscribe(); } catch {} };
  }, [loadUserSamples]);

  const updateSample = useCallback((sampleId: string, updates: Partial<AudioSample>) => {
    setUploadedSamples(prev => prev.map(s => s.id === sampleId ? { ...s, ...updates } : s));
  }, []);

  const handleGenerate = (prompt: string, settings: any, audioUrl: string) => {
    const newTrack: Track = {
      id: Date.now().toString(),
      title: `AI Track ${new Date().toLocaleTimeString()}`,
      genre: settings.genre || "Unknown",
      duration: settings.duration || 30,
      bpm: settings.bpm?.[0] || 120,
      key: settings.key || "C",
      prompt,
      timestamp: new Date(),
      liked: false,
      audioUrl,
    };
    setCurrentTrack(newTrack);
    setGenerationHistory(prev => [newTrack as GeneratedTrack, ...prev]);
  };

  const handleTrackSelect = (track: GeneratedTrack) => setCurrentTrack(track);

  /* ─── Tab definitions ──────────────────────────────────────────── */
  const tabs = [
    { value: "create",  icon: Sparkles,          label: "Create"  },
    { value: "library", icon: FolderOpen,         label: "Library" },
    { value: "record",  icon: Mic,                label: "Record"  },
    { value: "edit",    icon: SlidersHorizontal,  label: "Edit"    },
    { value: "mix",     icon: Sliders,            label: "Mix"     },
    { value: "master",  icon: Zap,                label: "Master"  },
  ] as const;

  return (
    <div className="min-h-screen bg-background pb-24" style={{ backgroundColor: 'hsl(var(--background))', minHeight: '100vh' }}>
      <StudioHeader />

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Main layout: Chat sidebar (desktop) + studio content */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:h-[calc(100vh-8rem)]">

          {/* ── Left Sidebar: AI Chat (desktop only) ──────────── */}
          <div className="hidden lg:flex flex-col w-72 xl:w-80 flex-shrink-0">
            <div className="sticky top-4 flex flex-col h-[calc(100vh-9rem)] bg-card/40 backdrop-blur-sm rounded-xl border border-border/30 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30 flex-shrink-0">
                <Bot className="w-4 h-4 text-primary/70" />
                <span className="text-sm font-semibold text-foreground">Noir AI</span>
                <span className="ml-auto text-[10px] text-muted-foreground/50 uppercase tracking-wider">Assistant</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <AIChatAssistant
                  audioAnalysis={audioAnalysis}
                  separatedAudio={separatedAudio}
                  uploadedSamples={uploadedSamples}
                  onUpdateSample={updateSample}
                />
              </div>
            </div>
          </div>

          {/* ── Main Content: Tabbed Studio ────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <Tabs
              value={studioTab}
              onValueChange={(v) => {
                setStudioTab(v);
                setVisitedStudioTabs(prev => new Set(prev).add(v));
              }}
              className="w-full flex flex-col gap-4"
            >
              {/* Tab bar */}
              <TabsList className="tabs-scroll flex w-full overflow-x-auto bg-card/30 border border-border/30 rounded-xl p-1 gap-0.5 h-auto flex-shrink-0">
                {tabs.map(({ value, icon: Icon, label }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground transition-all duration-200
                      data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* ══ CREATE ════════════════════════════════════════ */}
              <TabsContent
                value="create"
                forceMount={visitedStudioTabs.has("create")}
                className="space-y-3 mt-0"
              >
                <StudioTabErrorBoundary tabLabel="Create">

                  {/* Featured: Melody Generator — always open, no collapsible */}
                  <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30">
                      <Music2 className="w-4 h-4 text-primary/70 shrink-0" />
                      <span className="font-semibold text-sm text-foreground">Noir Melody Generator</span>
                      <span className="ml-auto text-[10px] text-primary/60 uppercase tracking-wider font-medium">Featured</span>
                    </div>
                    <div className="p-4">
                      <MidiGenerator
                        uploadedSamples={uploadedSamples}
                        seedNotes={pdMelodyNotes}
                        seedKey={pdMelodyKey}
                        seedScale={pdMelodyScale}
                      />
                    </div>
                  </div>

                  <SectionDivider label="Rhythm & Harmony" />

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    <Collapsible defaultOpen={false}>
                      <CollapsibleTrigger className="section-trigger group">
                        <div className="flex items-center gap-2.5">
                          <Activity className="w-4 h-4 text-primary/70 shrink-0" />
                          <span className="font-medium text-sm">Drum Patterns</span>
                        </div>
                        <ChevronDown className="h-4 w-4 section-chevron transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <DrumPatternGenerator />
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible defaultOpen={false}>
                      <CollapsibleTrigger className="section-trigger group">
                        <div className="flex items-center gap-2.5">
                          <Music2 className="w-4 h-4 text-primary/70 shrink-0" />
                          <span className="font-medium text-sm">Counter Melody</span>
                        </div>
                        <ChevronDown className="h-4 w-4 section-chevron transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <CounterMelodyGenerator />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  <Collapsible defaultOpen={false}>
                    <CollapsibleTrigger className="section-trigger group">
                      <div className="flex items-center gap-2.5">
                        <BookOpen className="w-4 h-4 text-primary/70 shrink-0" />
                        <span className="font-medium text-sm">Public Domain Melody Bank</span>
                      </div>
                      <ChevronDown className="h-4 w-4 section-chevron transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <PublicDomainMelodyBank
                        onLoadMelody={(notes, key, scale) => {
                          setPdMelodyNotes([...notes]);
                          setPdMelodyKey(key);
                          setPdMelodyScale(scale);
                        }}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  <SectionDivider label="AI Generators" />

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    <Collapsible defaultOpen={false}>
                      <CollapsibleTrigger className="section-trigger group">
                        <div className="flex items-center gap-2.5">
                          <Music2 className="w-4 h-4 text-primary/70 shrink-0" />
                          <span className="font-medium text-sm">AI Music Generator</span>
                        </div>
                        <ChevronDown className="h-4 w-4 section-chevron transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <MusicGenerator
                          uploadedSamples={uploadedSamples}
                          onMusicGenerated={(music) => {
                            setUploadedSamples(prev => {
                              if (prev.some(s => s.id === music.id)) return prev;
                              return [...prev, {
                                id: music.id,
                                name: music.originalPrompt,
                                audioUrl: music.audioUrl,
                                genre: music.style,
                                tags: ['AI Generated', music.style, `${music.metadata.bpm}BPM`],
                                duration: music.duration,
                                bpm: music.metadata.bpm,
                                key: music.metadata.key,
                                analysis: undefined,
                              }];
                            });
                          }}
                        />
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible defaultOpen={false}>
                      <CollapsibleTrigger className="section-trigger group">
                        <div className="flex items-center gap-2.5">
                          <Mic2 className="w-4 h-4 text-primary/70 shrink-0" />
                          <span className="font-medium text-sm">AI Audio Generator</span>
                        </div>
                        <ChevronDown className="h-4 w-4 section-chevron transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <AudioGenerator
                          uploadedSamples={uploadedSamples}
                          onAudioGenerated={(audio) => {
                            setUploadedSamples(prev => [...prev, {
                              id: audio.id,
                              name: audio.text.substring(0, 30) + '...',
                              audioUrl: audio.audioUrl,
                              genre: 'Generated',
                              tags: ['AI', 'TTS', audio.voice],
                              duration: 0,
                              analysis: undefined,
                            }]);
                          }}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  <Collapsible defaultOpen={false}>
                    <CollapsibleTrigger className="section-trigger group">
                      <div className="flex items-center gap-2.5">
                        <Wand2 className="w-4 h-4 text-primary/70 shrink-0" />
                        <span className="font-medium text-sm">Prompt Builder</span>
                      </div>
                      <ChevronDown className="h-4 w-4 section-chevron transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <PromptBuilder onGenerate={handleGenerate} />
                    </CollapsibleContent>
                  </Collapsible>

                  <SectionDivider label="Session" />

                  <Collapsible defaultOpen={false}>
                    <CollapsibleTrigger className="section-trigger group">
                      <div className="flex items-center gap-2.5">
                        <History className="w-4 h-4 text-primary/70 shrink-0" />
                        <span className="font-medium text-sm">Generation History</span>
                        {generationHistory.length > 0 && (
                          <span className="ml-1 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">
                            {generationHistory.length}
                          </span>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 section-chevron transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <GenerationHistory tracks={generationHistory} onTrackSelect={handleTrackSelect} />
                    </CollapsibleContent>
                  </Collapsible>

                </StudioTabErrorBoundary>
              </TabsContent>

              {/* ══ LIBRARY ═══════════════════════════════════════ */}
              <TabsContent
                value="library"
                forceMount={visitedStudioTabs.has("library")}
                className="space-y-3 mt-0"
              >
                <StudioTabErrorBoundary tabLabel="Library">

                  <Collapsible open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                    <CollapsibleTrigger className="section-trigger group">
                      <div className="flex items-center gap-2.5">
                        <Upload className="w-4 h-4 text-primary/70 shrink-0" />
                        <span className="font-medium text-sm">Import Audio</span>
                      </div>
                      <ChevronDown className="h-4 w-4 section-chevron transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <AudioUpload
                        onSamplesUploaded={(samples) => {
                          setUploadedSamples(prev => {
                            const map = new Map(prev.map(s => [s.id, s]));
                            for (const s of samples) map.set(s.id, map.has(s.id) ? { ...map.get(s.id)!, ...s } : s);
                            return Array.from(map.values());
                          });
                          const latest = samples[samples.length - 1];
                          if (latest?.analysis) setAudioAnalysis(latest.analysis);
                        }}
                        onAudioSeparated={(separated) => setSeparatedAudio(separated)}
                        onAnalysisComplete={(analysis) => setAudioAnalysis(analysis)}
                        onDeleteSample={(id) => {
                          deleteSampleFromDB(id).catch(console.warn);
                          setUploadedSamples(prev => prev.filter(s => s.id !== id));
                        }}
                        onClearSamples={() => {
                          clearAllSamplesFromDB().catch(console.warn);
                          setUploadedSamples([]);
                        }}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible open={isSampleLibraryOpen} onOpenChange={setIsSampleLibraryOpen}>
                    <CollapsibleTrigger className="section-trigger group">
                      <div className="flex items-center gap-2.5">
                        <Music className="w-4 h-4 text-primary/70 shrink-0" />
                        <span className="font-medium text-sm">Sample Library</span>
                        {uploadedSamples.length > 0 && (
                          <span className="ml-1 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">
                            {uploadedSamples.length}
                          </span>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 section-chevron transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <SampleLibrary
                        onSampleSelect={() => {}}
                        uploadedSamples={uploadedSamples}
                        onDeleteSample={(id) => {
                          deleteSampleFromDB(id).catch(console.warn);
                          setUploadedSamples(prev => prev.filter(s => s.id !== id));
                        }}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  <SectionDivider label="Session Tools" />

                  <Collapsible open={isTempoOpen} onOpenChange={setIsTempoOpen}>
                    <CollapsibleTrigger className="section-trigger group">
                      <div className="flex items-center gap-2.5">
                        <Timer className="w-4 h-4 text-primary/70 shrink-0" />
                        <span className="font-medium text-sm">Tempo Control</span>
                      </div>
                      <ChevronDown className="h-4 w-4 section-chevron transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <TempoControl
                        uploadedSamples={uploadedSamples}
                        onUpdateSample={updateSample}
                        onTempoChange={() => {}}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                    <CollapsibleTrigger className="section-trigger group">
                      <div className="flex items-center gap-2.5">
                        <SettingsIconLucide className="w-4 h-4 text-primary/70 shrink-0" />
                        <span className="font-medium text-sm">Audio Settings</span>
                      </div>
                      <ChevronDown className="h-4 w-4 section-chevron transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <AudioOutputSelector onDeviceChange={setAudioOutputDevice} />
                    </CollapsibleContent>
                  </Collapsible>

                </StudioTabErrorBoundary>
              </TabsContent>

              {/* ══ RECORD ════════════════════════════════════════ */}
              <TabsContent
                value="record"
                forceMount={visitedStudioTabs.has("record")}
                className="mt-0"
              >
                <StudioTabErrorBoundary tabLabel="Record">
                  <RecordingStudio />
                </StudioTabErrorBoundary>
              </TabsContent>

              {/* ══ EDIT ══════════════════════════════════════════ */}
              <TabsContent
                value="edit"
                forceMount={visitedStudioTabs.has("edit")}
                className="space-y-3 mt-0"
              >
                <StudioTabErrorBoundary tabLabel="Edit">

                  {/* Pitch & Effects — open by default */}
                  <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30">
                      <SlidersHorizontal className="w-4 h-4 text-primary/70 shrink-0" />
                      <span className="font-semibold text-sm text-foreground">Pitch, Tempo & Effects</span>
                    </div>
                    <div className="p-4">
                      <AudioEffectsQuickPanel
                        uploadedSamples={uploadedSamples}
                        onUpdateSample={updateSample}
                      />
                    </div>
                  </div>

                  {/* Stem Editor — visible only after audio separation */}
                  {separatedAudio && (
                    <Collapsible open={isStemEditorOpen} onOpenChange={setIsStemEditorOpen}>
                      <CollapsibleTrigger className="section-trigger group">
                        <div className="flex items-center gap-2.5">
                          <Scissors className="w-4 h-4 text-primary/70 shrink-0" />
                          <span className="font-medium text-sm">Stem Editor</span>
                          <span className="ml-1 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">Ready</span>
                        </div>
                        <ChevronDown className="h-4 w-4 section-chevron transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <StemEditor separatedAudio={separatedAudio} onStemUpdate={() => {}} />
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  <SectionDivider label="Analysis" />

                  <Collapsible defaultOpen={false}>
                    <CollapsibleTrigger className="section-trigger group">
                      <div className="flex items-center gap-2.5">
                        <BarChart2 className="w-4 h-4 text-primary/70 shrink-0" />
                        <span className="font-medium text-sm">Audio Analyzer</span>
                        {audioAnalysis && (
                          <span className="ml-1 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">
                            {audioAnalysis.key} · {Math.round(audioAnalysis.tempo)} BPM
                          </span>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 section-chevron transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <AudioAnalyzer />
                    </CollapsibleContent>
                  </Collapsible>

                </StudioTabErrorBoundary>
              </TabsContent>

              {/* ══ MIX ═══════════════════════════════════════════ */}
              <TabsContent
                value="mix"
                forceMount={visitedStudioTabs.has("mix")}
                className="mt-0"
              >
                <StudioTabErrorBoundary tabLabel="Mix">
                  <MixingConsole />
                </StudioTabErrorBoundary>
              </TabsContent>

              {/* ══ MASTER ════════════════════════════════════════ */}
              <TabsContent
                value="master"
                forceMount={visitedStudioTabs.has("master")}
                className="mt-0"
              >
                <StudioTabErrorBoundary tabLabel="Master">
                  <MasteringSuite />
                </StudioTabErrorBoundary>
              </TabsContent>

            </Tabs>

            {/* Mobile AI Chat */}
            <div className="lg:hidden">
              <Collapsible>
                <CollapsibleTrigger className="section-trigger group">
                  <div className="flex items-center gap-2.5">
                    <Bot className="w-4 h-4 text-primary/70 shrink-0" />
                    <span className="font-medium text-sm">Noir AI Assistant</span>
                  </div>
                  <ChevronDown className="h-4 w-4 section-chevron transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/30 h-80 overflow-hidden">
                    <AIChatAssistant
                      audioAnalysis={audioAnalysis}
                      separatedAudio={separatedAudio}
                      uploadedSamples={uploadedSamples}
                      onUpdateSample={updateSample}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Current Track Player */}
            {currentTrack?.audioUrl && (
              <div className="mt-2">
                <AudioPlayer track={currentTrack} />
              </div>
            )}
          </div>
        </div>
      </div>

      <GlobalAudioBar />
    </div>
  );
};

export default Index;

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
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
import { ProductionAssistant } from "@/components/studio/ProductionAssistant";
import { AIChatAssistant } from "@/components/studio/AIChatAssistant";
import { DrumPatternGenerator } from "@/components/studio/DrumPatternGenerator";
import { CounterMelodyGenerator } from "@/components/studio/CounterMelodyGenerator";
import { RecordingStudio } from "@/components/studio/RecordingStudio";
import { MixingConsole } from "@/components/studio/MixingConsole";
import { MasteringSuite } from "@/components/studio/MasteringSuite";
import { StemEditor } from "@/components/studio/StemEditor";
import { TempoControl } from "@/components/studio/TempoControl";
import { MusicProductionWorkflow } from "@/components/studio/MusicProductionWorkflow";
import { AudioGenerator } from "@/components/studio/AudioGenerator";
import { MusicGenerator } from "@/components/studio/MusicGenerator";
import { MidiGenerator } from "@/components/studio/MidiGenerator";
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

const Index = () => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [generationHistory, setGenerationHistory] = useState<GeneratedTrack[]>([]);
  const [separatedAudio, setSeparatedAudio] = useState<SeparatedAudio | null>(null);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysis | null>(null);
  const [uploadedSamples, setUploadedSamples] = useState<AudioSample[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(true);
  const [isTempoOpen, setIsTempoOpen] = useState(false);
  const [isSampleLibraryOpen, setIsSampleLibraryOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStemEditorOpen, setIsStemEditorOpen] = useState(false);
  /** Keeps each studio tab mounted after first visit so audio/recording state is not torn down on switch. */
  const [studioTab, setStudioTab] = useState("upload");
  const [visitedStudioTabs, setVisitedStudioTabs] = useState(() => new Set<string>(["upload"]));
  const { playTrack, setAudioOutputDevice } = useGlobalAudio();

  // Authentication state
  const [user, setUser] = useState<User | null>(null);

  // Restore persisted samples from IndexedDB on first mount
  useEffect(() => {
    loadAllSamplesFromDB()
      .then(stored => {
        if (stored.length > 0) {
          setUploadedSamples(stored as AudioSample[]);
        }
      })
      .catch(err => console.warn('Could not restore samples from IndexedDB:', err));
  }, []);

  // Load user's audio samples from database with comprehensive error handling
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
      
      if (error) {
        console.error('Failed to load user samples:', error);
        return;
      }
      
      // Transform database samples to match the component interface with validation
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
        } catch (transformError) {
          console.warn('Error transforming sample:', transformError, sample);
          return null;
        }
      }).filter((s): s is AudioSample => s !== null && !!s.audioUrl);

      setUploadedSamples(transformedSamples);
      console.log('✅ Loaded user samples:', transformedSamples.length);
    } catch (error) {
      console.error('Error loading user samples:', error);
      // Don't crash - just set empty array
      setUploadedSamples([]);
    }
  }, []);
  
  // Authentication effect with comprehensive error handling
  useEffect(() => {
    let subscription: any = null;
    
    try {
      // Get initial session
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          try {
            setUser(session?.user ?? null);
            if (session?.user?.id) {
              loadUserSamples(session.user.id);
            }
          } catch (setUserError) {
            console.warn('Error setting user:', setUserError);
          }
        })
        .catch((sessionError) => {
          console.warn('Error getting session:', sessionError);
          setUser(null);
        });

      // Listen for auth changes
      try {
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          try {
            setUser(session?.user ?? null);
            if (session?.user?.id) {
              loadUserSamples(session.user.id);
            } else {
              setUploadedSamples([]); // Clear samples when signed out
            }
          } catch (authChangeError) {
            console.warn('Error handling auth change:', authChangeError);
          }
        });
        subscription = authSubscription;
      } catch (authError) {
        console.warn('Error setting up auth listener:', authError);
      }
    } catch (error) {
      console.error('Error in auth effect:', error);
    }

    return () => {
      try {
        if (subscription) {
          subscription.unsubscribe();
        }
      } catch (unsubscribeError) {
        console.warn('Error unsubscribing from auth:', unsubscribeError);
      }
    };
  }, [loadUserSamples]);

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

  const handleTrackSelect = (track: GeneratedTrack) => {
    setCurrentTrack(track);
  };

  return (
    <div className="min-h-screen bg-background pb-20" style={{ backgroundColor: 'hsl(var(--background))', minHeight: '100vh' }}>
      <StudioHeader />
      
      <div className="container mx-auto px-4 py-6">
        {/* Main Layout with Chat Sidebar */}
        <div className="flex gap-6 h-[calc(100vh-8rem)]">
          {/* Left Sidebar - AI Chat (Always Visible) */}
          <div className="w-80 flex-shrink-0">
            <div className="sticky top-0 h-full">
              <div className="h-full bg-card/50 backdrop-blur-sm rounded-lg border border-border/30">
                <div className="p-4 border-b border-border/30">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    🤖 Noir AI Assistant
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Always here to help with your music production
                  </p>
                </div>
                <div className="h-[calc(100%-5rem)] overflow-hidden">
                  <AIChatAssistant 
                    audioAnalysis={audioAnalysis}
                    separatedAudio={separatedAudio}
                    uploadedSamples={uploadedSamples}
                    onUpdateSample={(sampleId, updates) => {
                      setUploadedSamples(prev => 
                        prev.map(sample => sample.id === sampleId ? { ...sample, ...updates } : sample)
                      );
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area - Studio Interface with Tabs */}
          <div className="flex-1 space-y-6">
            <Tabs
              value={studioTab}
              onValueChange={(v) => {
                setStudioTab(v);
                setVisitedStudioTabs((prev) => new Set(prev).add(v));
              }}
              className="w-full space-y-6"
            >
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-1 bg-card/50 backdrop-blur-sm p-1 rounded-md">
                <TabsTrigger value="upload" className="flex items-center gap-1 text-xs sm:text-sm">
                  📤 Upload & Library
                </TabsTrigger>
                <TabsTrigger value="pitch-speed" className="flex items-center gap-1 text-xs sm:text-sm">
                  🎚️ Pitch & Speed
                </TabsTrigger>
                <TabsTrigger value="generate" className="flex items-center gap-1 text-xs sm:text-sm">
                  🎵 Generate
                </TabsTrigger>
                <TabsTrigger value="record" className="flex items-center gap-1 text-xs sm:text-sm">
                  🎙️ Record
                </TabsTrigger>
                <TabsTrigger value="mix" className="flex items-center gap-1 text-xs sm:text-sm">
                  🎛️ Mix
                </TabsTrigger>
                <TabsTrigger value="master" className="flex items-center gap-1 text-xs sm:text-sm">
                  🎚️ Master
                </TabsTrigger>
                <TabsTrigger value="workflow" className="flex items-center gap-1 text-xs sm:text-sm">
                  ⚡ Workflow
                </TabsTrigger>
              </TabsList>

              {/* Upload & Library Tab */}
              <TabsContent
                value="upload"
                forceMount={visitedStudioTabs.has("upload")}
                className="space-y-6"
              >
                <StudioTabErrorBoundary tabLabel="Upload & Library">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column - Upload Section */}
                  <div className="space-y-4">
                    {/* Audio Upload Section */}
                    <Collapsible open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                          <span className="font-medium text-lg text-foreground">📤 Audio Upload</span>
                          {isUploadOpen ? <ChevronUp className="h-4 w-4 text-foreground" /> : <ChevronDown className="h-4 w-4 text-foreground" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <AudioUpload
                          onSamplesUploaded={(samples) => {
                            setUploadedSamples(prev => {
                              const map = new Map(prev.map(s => [s.id, s]));
                              for (const s of samples) {
                                // Merge: update existing or add new
                                map.set(s.id, map.has(s.id) ? { ...map.get(s.id), ...s } : s);
                              }
                              return Array.from(map.values());
                            });
                            const latestSample = samples[samples.length - 1];
                            if (latestSample?.analysis) {
                              setAudioAnalysis(latestSample.analysis);
                            }
                          }}
                          onAudioSeparated={(separated) => setSeparatedAudio(separated)}
                          onAnalysisComplete={(analysis) => setAudioAnalysis(analysis)}
                          onDeleteSample={(sampleId) => {
                            deleteSampleFromDB(sampleId).catch(console.warn);
                            setUploadedSamples(prev => prev.filter(s => s.id !== sampleId));
                          }}
                          onClearSamples={() => {
                            clearAllSamplesFromDB().catch(console.warn);
                            setUploadedSamples([]);
                          }}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                    
                    {/* Tempo Control Section */}
                    <Collapsible open={isTempoOpen} onOpenChange={setIsTempoOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                          <span className="font-medium text-lg text-foreground">🎛️ Tempo Control</span>
                          {isTempoOpen ? <ChevronUp className="h-4 w-4 text-foreground" /> : <ChevronDown className="h-4 w-4 text-foreground" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <TempoControl 
                          uploadedSamples={uploadedSamples}
                          onUpdateSample={(sampleId, updates) => {
                            setUploadedSamples(prev => 
                              prev.map(sample => sample.id === sampleId ? { ...sample, ...updates } : sample)
                            );
                          }}
                          onTempoChange={(bpm) => {
                            console.log('Tempo changed to:', bpm);
                          }}
                        />
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Stem Editor Section - Only show when separated audio is available */}
                    {separatedAudio && (
                      <Collapsible open={isStemEditorOpen} onOpenChange={setIsStemEditorOpen}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                            <span className="font-medium text-lg text-foreground">🎚️ Stem Editor</span>
                            {isStemEditorOpen ? <ChevronUp className="h-4 w-4 text-foreground" /> : <ChevronDown className="h-4 w-4 text-foreground" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <StemEditor 
                            separatedAudio={separatedAudio}
                            onStemUpdate={(stemId, updates) => {
                              // Handle stem updates if needed
                              console.log('Stem updated:', stemId, updates);
                            }}
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Settings Section */}
                    <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                          <span className="font-medium text-lg text-foreground">⚙️ Audio Settings</span>
                          {isSettingsOpen ? <ChevronUp className="h-4 w-4 text-foreground" /> : <ChevronDown className="h-4 w-4 text-foreground" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <AudioOutputSelector onDeviceChange={setAudioOutputDevice} />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                  
                  {/* Right Column - Sample Library */}
                  <div className="space-y-4">
                    <Collapsible open={isSampleLibraryOpen} onOpenChange={setIsSampleLibraryOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                          <span className="font-medium text-lg text-foreground">🎵 Sample Library</span>
                          {isSampleLibraryOpen ? <ChevronUp className="h-4 w-4 text-foreground" /> : <ChevronDown className="h-4 w-4 text-foreground" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <SampleLibrary 
                          onSampleSelect={(sample) => console.log('Selected sample:', sample)}
                          uploadedSamples={uploadedSamples}
                          onDeleteSample={(sampleId) => {
                            deleteSampleFromDB(sampleId).catch(console.warn);
                            setUploadedSamples(prev => prev.filter(sample => sample.id !== sampleId));
                          }}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>
                </StudioTabErrorBoundary>
              </TabsContent>

              {/* Pitch & Speed — isolated from chat / voice UI */}
              <TabsContent
                value="pitch-speed"
                forceMount={visitedStudioTabs.has("pitch-speed")}
                className="space-y-6"
              >
                <StudioTabErrorBoundary tabLabel="Pitch & Speed">
                  <Collapsible defaultOpen={true}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground"
                      >
                        <span className="font-medium text-lg text-foreground">
                          🎚️ Pitch, tempo & reverse
                        </span>
                        <ChevronDown className="h-4 w-4 text-foreground" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <AudioEffectsQuickPanel
                        uploadedSamples={uploadedSamples}
                        onUpdateSample={(sampleId, updates) => {
                          setUploadedSamples((prev) =>
                            prev.map((sample) =>
                              sample.id === sampleId ? { ...sample, ...updates } : sample
                            )
                          );
                        }}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </StudioTabErrorBoundary>
              </TabsContent>

              {/* Generate Tab */}
              <TabsContent
                value="generate"
                forceMount={visitedStudioTabs.has("generate")}
                className="space-y-6"
              >
                <StudioTabErrorBoundary tabLabel="Generate">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <Collapsible defaultOpen={true}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                          <span className="font-medium text-lg text-foreground">🎹 Noir Melody Generator</span>
                          <ChevronDown className="h-4 w-4 text-foreground" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <MidiGenerator uploadedSamples={uploadedSamples} />
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible defaultOpen={false}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                          <span className="font-medium text-lg text-foreground">🎯 Prompt Builder</span>
                          <ChevronDown className="h-4 w-4 text-foreground" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <PromptBuilder onGenerate={handleGenerate} />
                      </CollapsibleContent>
                    </Collapsible>
                    
                    <Collapsible defaultOpen={true}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                          <span className="font-medium text-lg text-foreground">🎤 AI Audio Generator</span>
                          <ChevronDown className="h-4 w-4 text-foreground" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <AudioGenerator uploadedSamples={uploadedSamples} onAudioGenerated={(audio) => {
                          console.log('Generated audio:', audio);
                          // Add to uploaded samples so it appears in the library
                          setUploadedSamples(prev => [...prev, {
                            id: audio.id,
                            name: audio.text.substring(0, 30) + '...',
                            audioUrl: audio.audioUrl,
                            genre: 'Generated',
                            tags: ['AI', 'TTS', audio.voice],
                            duration: 0, // Will be updated when played
                            analysis: undefined
                          }]);
                        }} />
                      </CollapsibleContent>
                    </Collapsible>
                    
                    <Collapsible defaultOpen={true}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                          <span className="font-medium text-lg text-foreground">🎵 AI Music Generator</span>
                          <ChevronDown className="h-4 w-4 text-foreground" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <MusicGenerator
                          uploadedSamples={uploadedSamples}
                          onMusicGenerated={(music) => {
                            // Add generated track to the library so it can be used as a future reference
                            setUploadedSamples(prev => {
                              const exists = prev.some(s => s.id === music.id);
                              if (exists) return prev;
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
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                          <span className="font-medium text-lg text-foreground">🥁 Drum Patterns</span>
                          <ChevronDown className="h-4 w-4 text-foreground" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <DrumPatternGenerator />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                  
                  <div className="space-y-6">
                    <Collapsible defaultOpen={false}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                          <span className="font-medium text-lg text-foreground">🎹 Counter Melody</span>
                          <ChevronDown className="h-4 w-4 text-foreground" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <CounterMelodyGenerator />
                      </CollapsibleContent>
                    </Collapsible>
                    
                    <Collapsible defaultOpen={true}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                          <span className="font-medium text-lg text-foreground">📚 Generation History</span>
                          <ChevronDown className="h-4 w-4 text-foreground" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <GenerationHistory tracks={generationHistory} onTrackSelect={handleTrackSelect} />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>
                </StudioTabErrorBoundary>
              </TabsContent>

              {/* Record Tab */}
              <TabsContent
                value="record"
                forceMount={visitedStudioTabs.has("record")}
                className="space-y-6"
              >
                <StudioTabErrorBoundary tabLabel="Record">
                <Collapsible defaultOpen={true}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                      <span className="font-medium text-lg text-foreground">🎤 Recording Studio</span>
                      <ChevronDown className="h-4 w-4 text-foreground" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <RecordingStudio />
                  </CollapsibleContent>
                </Collapsible>
                </StudioTabErrorBoundary>
              </TabsContent>

              {/* Mix Tab */}
              <TabsContent
                value="mix"
                forceMount={visitedStudioTabs.has("mix")}
                className="space-y-6"
              >
                <StudioTabErrorBoundary tabLabel="Mix">
                <Collapsible defaultOpen={true}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                      <span className="font-medium text-lg text-foreground">🎛️ Mixing Console</span>
                      <ChevronDown className="h-4 w-4 text-foreground" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <MixingConsole />
                  </CollapsibleContent>
                </Collapsible>
                </StudioTabErrorBoundary>
              </TabsContent>

              {/* Master Tab */}
              <TabsContent
                value="master"
                forceMount={visitedStudioTabs.has("master")}
                className="space-y-6"
              >
                <StudioTabErrorBoundary tabLabel="Master">
                <Collapsible defaultOpen={true}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                      <span className="font-medium text-lg text-foreground">🎚️ Mastering Suite</span>
                      <ChevronDown className="h-4 w-4 text-foreground" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <MasteringSuite />
                  </CollapsibleContent>
                </Collapsible>
                </StudioTabErrorBoundary>
              </TabsContent>

              {/* Workflow Tab */}
              <TabsContent
                value="workflow"
                forceMount={visitedStudioTabs.has("workflow")}
                className="space-y-6"
              >
                <StudioTabErrorBoundary tabLabel="Workflow">
                <Collapsible defaultOpen={true}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="flex w-full justify-between items-center p-4 h-auto bg-card/50 border border-border/30 rounded-lg hover:bg-card/70 text-foreground hover:text-foreground">
                      <span className="font-medium text-lg text-foreground">⚡ Production Workflow</span>
                      <ChevronDown className="h-4 w-4 text-foreground" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <MusicProductionWorkflow />
                  </CollapsibleContent>
                </Collapsible>
                </StudioTabErrorBoundary>
              </TabsContent>
            </Tabs>

            {/* Current Track Player */}
            {currentTrack && currentTrack.audioUrl && (
              <div className="mt-6">
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
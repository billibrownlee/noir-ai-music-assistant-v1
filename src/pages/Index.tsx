import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AudioOutputSelector } from "@/components/ui/audio-output-selector";
import { supabase } from "@/integrations/supabase/client";
import StudioHeader from "@/components/studio/StudioHeader";
import PromptBuilder from "@/components/studio/PromptBuilder";
import AudioPlayer from "@/components/studio/AudioPlayer";
import GenerationHistory from "@/components/studio/GenerationHistory";
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
import { SeparatedAudio } from "@/lib/audioSeparation";
import { AudioAnalysis } from "@/lib/audioAnalyzer";
import { useGlobalAudio } from "@/hooks/useGlobalAudio";

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
}

const Index = () => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [separatedAudio, setSeparatedAudio] = useState<SeparatedAudio | null>(null);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysis | null>(null);
  const [uploadedSamples, setUploadedSamples] = useState<any[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(true);
  const [isTempoOpen, setIsTempoOpen] = useState(false);
  const [isSampleLibraryOpen, setIsSampleLibraryOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStemEditorOpen, setIsStemEditorOpen] = useState(false);
  const { playTrack, setAudioOutputDevice } = useGlobalAudio();
  
  // Authentication state
  const [user, setUser] = useState(null);
  
  // Load user's audio samples from database
  const loadUserSamples = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('audio_samples')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Failed to load user samples:', error);
        return;
      }
      
      // Transform database samples to match the component interface
      const transformedSamples = data?.map(sample => ({
        id: sample.id,
        name: sample.filename,
        audioUrl: sample.public_url,
        genre: sample.genre || 'Unknown',
        bpm: sample.bpm,
        key: sample.key,
        duration: sample.duration,
        tags: sample.tags || [],
        uploadDate: new Date(sample.created_at)
      })) || [];
      
      setUploadedSamples(transformedSamples);
      console.log('✅ Loaded user samples:', transformedSamples.length);
    } catch (error) {
      console.error('Error loading user samples:', error);
    }
  };
  
  // Authentication effect
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserSamples(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserSamples(session.user.id);
      } else {
        setUploadedSamples([]); // Clear samples when signed out
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check audio output device
  useEffect(() => {
    const checkAudioOutput = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
          
          // Find the default or currently selected output
          const defaultOutput = audioOutputs.find(device => device.deviceId === 'default') || audioOutputs[0];
          
          const outputElement = document.getElementById('audio-output-device');
          if (outputElement && defaultOutput) {
            outputElement.textContent = defaultOutput.label || 'Default Audio Output';
            outputElement.className = 'text-neon-green ml-2';
          } else if (outputElement) {
            outputElement.textContent = 'System Default Audio Output';
            outputElement.className = 'text-neon-blue ml-2';
          }
        }
      } catch (error) {
        console.log('Audio device detection:', error);
        const outputElement = document.getElementById('audio-output-device');
        if (outputElement) {
          outputElement.textContent = 'System Default (AirPods if connected)';
          outputElement.className = 'text-neon-orange ml-2';
        }
      }
    };

    if (uploadedSamples.length > 0) {
      checkAudioOutput();
    }
  }, [uploadedSamples]);

  const handleGenerate = (prompt: string, settings: any) => {
    // Simulate track generation
    const newTrack: Track = {
      id: Date.now().toString(),
      title: `AI Track ${Date.now()}`,
      genre: settings.genre || "Unknown",
      duration: settings.duration || 180,
      bpm: settings.bpm?.[0] || 120,
      key: settings.key || "C",
      prompt,
      timestamp: new Date(),
      liked: false
    };
    
    setCurrentTrack(newTrack);
  };

  const handleTrackSelect = (track: Track) => {
    setCurrentTrack(track);
  };

  return (
    <div className="min-h-screen bg-background">
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
                    🤖 Lando AI Assistant
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
            <Tabs defaultValue="upload" className="w-full space-y-6">
              <TabsList className="grid w-full grid-cols-6 bg-card/50 backdrop-blur-sm">
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  📤 Upload & Library
                </TabsTrigger>
                <TabsTrigger value="generate" className="flex items-center gap-2">
                  🎵 Generate
                </TabsTrigger>
                <TabsTrigger value="record" className="flex items-center gap-2">
                  🎙️ Record
                </TabsTrigger>
                <TabsTrigger value="mix" className="flex items-center gap-2">
                  🎛️ Mix
                </TabsTrigger>
                <TabsTrigger value="master" className="flex items-center gap-2">
                  🎚️ Master
                </TabsTrigger>
                <TabsTrigger value="workflow" className="flex items-center gap-2">
                  ⚡ Workflow
                </TabsTrigger>
              </TabsList>

              {/* Upload & Library Tab */}
              <TabsContent value="upload" className="space-y-6">
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
                            console.log('Uploaded samples:', samples);
                            setUploadedSamples(prev => [...prev, ...samples]);
                            const latestSample = samples[samples.length - 1];
                            if (latestSample && latestSample.analysis) {
                              setAudioAnalysis(latestSample.analysis);
                            }
                            // Refresh user samples from database to get the latest data
                            if (user) {
                              setTimeout(() => loadUserSamples(user.id), 1000);
                            }
                          }}
                          onAudioSeparated={(separated) => setSeparatedAudio(separated)}
                          onAnalysisComplete={(analysis) => setAudioAnalysis(analysis)}
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
                            setUploadedSamples(prev => prev.filter(sample => sample.id !== sampleId));
                            console.log('Deleted sample:', sampleId);
                          }}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>
              </TabsContent>

              {/* Generate Tab */}
              <TabsContent value="generate" className="space-y-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <Collapsible defaultOpen={true}>
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
                        <AudioGenerator onAudioGenerated={(audio) => {
                          console.log('Generated audio:', audio);
                          // Add to uploaded samples so it appears in the library
                          setUploadedSamples(prev => [...prev, {
                            id: audio.id,
                            name: audio.text.substring(0, 30) + '...',
                            audioUrl: audio.audioUrl,
                            genre: 'Generated',
                            tags: ['AI', 'TTS', audio.voice],
                            duration: 0, // Will be updated when played
                            analysis: null
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
                        <MusicGenerator onMusicGenerated={(music) => {
                          console.log('Generated music:', music);
                          // Add to uploaded samples so it appears in the library
                          setUploadedSamples(prev => [...prev, {
                            id: music.id,
                            name: music.originalPrompt,
                            audioUrl: music.audioUrl,
                            genre: music.style,
                            tags: ['AI', 'Generated', music.style, `${music.metadata.bpm}BPM`],
                            duration: music.duration,
                            bpm: music.metadata.bpm,
                            key: music.metadata.key,
                            analysis: null
                          }]);
                        }} />
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
                        <GenerationHistory onTrackSelect={handleTrackSelect} />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>
              </TabsContent>

              {/* Record Tab */}
              <TabsContent value="record" className="space-y-6">
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
              </TabsContent>

              {/* Mix Tab */}
              <TabsContent value="mix" className="space-y-6">
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
              </TabsContent>

              {/* Master Tab */}
              <TabsContent value="master" className="space-y-6">
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
              </TabsContent>

              {/* Workflow Tab */}
              <TabsContent value="workflow" className="space-y-6">
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
              </TabsContent>
            </Tabs>

            {/* Current Track Player */}
            {currentTrack && (
              <div className="mt-6">
                <AudioPlayer track={currentTrack} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
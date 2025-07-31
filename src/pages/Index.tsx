import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudioOutputSelector } from "@/components/ui/audio-output-selector";
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
import { MusicProductionWorkflow } from "@/components/studio/MusicProductionWorkflow";
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
  const { playTrack, setAudioOutputDevice } = useGlobalAudio();

  // Manual play function for user control
  const playLatestUploadedSample = () => {
    if (uploadedSamples.length > 0) {
      const latestSample = uploadedSamples[uploadedSamples.length - 1];
      if (latestSample.audioUrl) {
        playTrack({
          id: latestSample.id,
          name: latestSample.name,
          audioUrl: latestSample.audioUrl
        });
      }
    }
  };

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
    <div className="min-h-screen bg-studio-bg">
      <StudioHeader />
      
      <div className="container mx-auto px-4 py-6">
        {/* Main Studio Interface with Tabs */}
        <Tabs defaultValue="upload" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-studio-surface/50 backdrop-blur-sm">
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
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left Column - Upload Section */}
              <div className="xl:col-span-1 space-y-6">
                <AudioUpload 
                  onSamplesUploaded={(samples) => {
                    console.log('Uploaded samples:', samples);
                    setUploadedSamples(samples);
                    const latestSample = samples[samples.length - 1];
                    if (latestSample && latestSample.analysis) {
                      setAudioAnalysis(latestSample.analysis);
                    }
                  }}
                  onAudioSeparated={(separated) => setSeparatedAudio(separated)}
                  onAnalysisComplete={(analysis) => setAudioAnalysis(analysis)}
                />
                
                <AudioOutputSelector onDeviceChange={setAudioOutputDevice} />
              </div>
              
              {/* Middle Column - Sample Library */}
              <div className="xl:col-span-1 space-y-6">
                <SampleLibrary 
                  onSampleSelect={(sample) => console.log('Selected sample:', sample)}
                  uploadedSamples={uploadedSamples}
                  onDeleteSample={(sampleId) => {
                    setUploadedSamples(prev => prev.filter(sample => sample.id !== sampleId));
                    console.log('Deleted sample:', sampleId);
                  }}
                />
              </div>
              
              {/* Right Column - AI Chat Assistant */}
              <div className="xl:col-span-1 space-y-6">
                <div className="h-[600px]"> {/* Fixed height for consistent layout */}
                  <AIChatAssistant 
                    audioAnalysis={audioAnalysis}
                    separatedAudio={separatedAudio}
                  />
                </div>
                
                {/* Audio Output Status */}
                <div className="bg-studio-surface/30 p-3 rounded-lg border border-neon-blue/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Audio Output Ready</span>
                  </div>
                  <p className="text-xs text-studio-text-secondary mt-1">
                    All samples will play through your selected audio device (AirPods/speakers)
                  </p>
                </div>
              </div>
            </div>

            {/* Manual Play Section - Full User Control */}
            {uploadedSamples.length > 0 && (
              <div 
                id="manual-play-section"
                className="space-y-4 mt-6 border-2 border-neon-blue/30 rounded-xl"
              >
                <div className="bg-gradient-to-br from-neon-blue/20 via-neon-purple/20 to-neon-green/20 p-6 rounded-xl border-2 border-neon-blue/50 shadow-2xl shadow-neon-blue/20">
                  <div className="flex items-center justify-center mb-4">
                    <div className="text-4xl">🎵</div>
                    <h3 className="font-bold text-xl mx-3 text-neon-blue">
                      YOUR UPLOADED SAMPLE - READY TO PLAY
                    </h3>
                    <div className="text-4xl">🎵</div>
                  </div>
                  
                  <div className="bg-studio-surface/50 p-4 rounded-lg border border-neon-green/30 mb-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2 text-neon-green">
                      🎧 Audio Ready for Manual Playback
                    </h4>
                    <div className="space-y-2 text-sm">
                      <p className="text-studio-text-secondary">
                        <strong className="text-neon-blue">Sample Ready:</strong> 
                        <span className="text-neon-green ml-2 font-mono">
                          {uploadedSamples[uploadedSamples.length - 1]?.name}
                        </span>
                      </p>
                      <p className="text-studio-text-secondary">
                        <strong className="text-neon-blue">Output Device:</strong> 
                        <span id="audio-output-device" className="text-neon-orange ml-2">
                          Detecting your AirPods/speakers...
                        </span>
                      </p>
                      <p className="text-studio-text-secondary">
                        <strong className="text-neon-blue">Duration:</strong> 
                        <span className="text-neon-green ml-2">
                          {uploadedSamples[uploadedSamples.length - 1]?.duration?.toFixed(1)} seconds
                        </span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-center gap-4">
                    <div className="text-center">
                      <div className="w-4 h-4 bg-neon-blue rounded-full mx-auto mb-2"></div>
                      <p className="text-xs text-neon-blue font-medium">CLICK TO PLAY MANUALLY</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-center gap-3 mt-4">
                    <Button 
                      variant="neon" 
                      size="lg"
                      onClick={playLatestUploadedSample}
                      className="bg-neon-green text-black hover:bg-neon-green/80 font-bold"
                    >
                      ▶️ Play Sample
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const testAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaMFbIsNiTNVxcpJtVUWklAAAAAA==');
                        testAudio.volume = 0.2;
                        testAudio.play().then(() => {
                          console.log('🔊 Test beep played - did you hear it in your AirPods?');
                        }).catch(console.error);
                      }}
                      className="border-neon-blue text-neon-blue hover:bg-neon-blue/10"
                    >
                      🔊 Test AirPods
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Generate Tab */}
          <TabsContent value="generate" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-6">
                <PromptBuilder onGenerate={handleGenerate} />
                <DrumPatternGenerator />
              </div>
              
              <div className="space-y-6">
                <CounterMelodyGenerator />
                <GenerationHistory onTrackSelect={handleTrackSelect} />
              </div>
            </div>
          </TabsContent>

          {/* Record Tab */}
          <TabsContent value="record" className="space-y-6">
            <RecordingStudio />
          </TabsContent>

          {/* Mix Tab */}
          <TabsContent value="mix" className="space-y-6">
            <MixingConsole />
          </TabsContent>

          {/* Master Tab */}
          <TabsContent value="master" className="space-y-6">
            <MasteringSuite />
          </TabsContent>

          {/* Workflow Tab */}
          <TabsContent value="workflow" className="space-y-6">
            <MusicProductionWorkflow />
          </TabsContent>
        </Tabs>

        {/* Current Track Player */}
        {currentTrack && (
          <div className="mt-6">
            <AudioPlayer track={currentTrack} />
          </div>
        )}
        
        {/* Stem Editor (if separated audio available) */}
        {separatedAudio && (
          <div className="mt-6">
            <StemEditor separatedAudio={separatedAudio} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
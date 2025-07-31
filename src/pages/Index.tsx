import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import StudioHeader from "@/components/studio/StudioHeader";
import PromptBuilder from "@/components/studio/PromptBuilder";
import AudioPlayer from "@/components/studio/AudioPlayer";
import GenerationHistory from "@/components/studio/GenerationHistory";
import { AudioUpload } from "@/components/studio/AudioUpload";
import { SampleLibrary } from "@/components/studio/SampleLibrary";
import { ProductionAssistant } from "@/components/studio/ProductionAssistant";
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
  const { playTrack } = useGlobalAudio();

  // Auto-play the most recent uploaded sample
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
    <div className="min-h-screen bg-gradient-studio">
      <StudioHeader />
      
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Step-by-Step Music Production Workflow */}
          <MusicProductionWorkflow />

          {/* Original Production Tools - Secondary */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="space-y-8">
              <PromptBuilder onGenerate={handleGenerate} />
              <AudioUpload 
                onSamplesUploaded={(samples) => {
                  console.log('Uploaded samples:', samples);
                  setUploadedSamples(samples);
                  // Pass the latest sample's analysis to Lando
                  const latestSample = samples[samples.length - 1];
                  if (latestSample && latestSample.analysis) {
                    setAudioAnalysis(latestSample.analysis);
                  }
                }}
                onAudioSeparated={(separated) => setSeparatedAudio(separated)}
              />
            </div>
            <div className="space-y-8">
              <GenerationHistory onTrackSelect={handleTrackSelect} />
            <SampleLibrary 
              onSampleSelect={(sample) => console.log('Selected sample:', sample)}
              uploadedSamples={uploadedSamples}
            />

            {/* Audio Output Device Checker & Quick Play Section */}
            {uploadedSamples.length > 0 && (
              <div className="space-y-4 mt-6">
                <div className="bg-studio-surface-secondary/30 p-4 rounded-lg border border-neon-blue/20">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    🎧 Audio Output Check
                  </h3>
                  <div className="space-y-3">
                    <p className="text-sm text-studio-text-secondary">
                      <strong>Current Output Device:</strong> 
                      <span id="audio-output-device" className="text-neon-blue ml-2">
                        Checking system audio output...
                      </span>
                    </p>
                    <p className="text-sm text-studio-text-secondary">
                      Make sure your AirPods are connected and set as the default audio output in your system settings.
                    </p>
                    
                    <div className="flex gap-3">
                      <Button 
                        variant="neon" 
                        size="lg"
                        onClick={playLatestUploadedSample}
                        className="animate-pulse"
                      >
                        🎵 Play: "{uploadedSamples[uploadedSamples.length - 1]?.name}"
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          // Test system audio with a short beep
                          const testAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaMFbIsNiTNVxcpJtVUWklAAAAAA==');
                          testAudio.volume = 0.1;
                          testAudio.play().then(() => {
                            console.log('Test audio played - check if you heard it in your AirPods');
                          }).catch(console.error);
                        }}
                      >
                        🔊 Test Audio Output
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Stem Editor (if audio is separated) */}
          {separatedAudio && (
            <StemEditor 
              separatedAudio={separatedAudio}
              onStemUpdate={(stemId, updates) => {
                setSeparatedAudio(prev => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    stems: prev.stems.map(stem => 
                      stem.id === stemId ? { ...stem, ...updates } : stem
                    )
                  };
                });
              }}
            />
          )}

          {/* Recording & Production - Now Secondary */}
          <RecordingStudio />

          {/* AI Generators */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <ProductionAssistant 
              audioAnalysis={audioAnalysis}
              currentTrack={currentTrack}
            />
            <DrumPatternGenerator />
            <CounterMelodyGenerator />
          </div>

          {/* Mixing & Mastering */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <MixingConsole />
            <MasteringSuite />
          </div>
        </div>
        
        {/* Bottom Section - Audio Player */}
        <div className="mt-8">
          <AudioPlayer track={currentTrack} />
        </div>
      </main>
    </div>
  );
};

export default Index;

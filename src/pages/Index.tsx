import { useState } from "react";
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
import { SeparatedAudio } from "@/lib/audioSeparation";

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
          {/* Main Production Tools */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="space-y-8">
              <PromptBuilder onGenerate={handleGenerate} />
              <AudioUpload 
                onSamplesUploaded={(samples) => console.log('Uploaded samples:', samples)}
                onAudioSeparated={(separated) => setSeparatedAudio(separated)}
              />
            </div>
            <div className="space-y-8">
              <GenerationHistory onTrackSelect={handleTrackSelect} />
              <SampleLibrary onSampleSelect={(sample) => console.log('Selected sample:', sample)} />
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

          {/* Recording & Production */}
          <RecordingStudio />

          {/* AI Generators */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <ProductionAssistant />
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

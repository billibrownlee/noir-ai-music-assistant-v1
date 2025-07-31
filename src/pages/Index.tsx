import { useState } from "react";
import StudioHeader from "@/components/studio/StudioHeader";
import PromptBuilder from "@/components/studio/PromptBuilder";
import AudioPlayer from "@/components/studio/AudioPlayer";
import GenerationHistory from "@/components/studio/GenerationHistory";
import { AudioUpload } from "@/components/studio/AudioUpload";
import { SampleLibrary } from "@/components/studio/SampleLibrary";

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Prompt Builder & Upload */}
          <div className="lg:col-span-2 space-y-8">
            <PromptBuilder onGenerate={handleGenerate} />
            <AudioUpload onSamplesUploaded={(samples) => console.log('Uploaded samples:', samples)} />
          </div>
          
          {/* Right Column - History & Sample Library */}
          <div className="space-y-8">
            <GenerationHistory onTrackSelect={handleTrackSelect} />
            <SampleLibrary onSampleSelect={(sample) => console.log('Selected sample:', sample)} />
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

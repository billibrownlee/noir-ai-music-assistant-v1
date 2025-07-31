import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Download, Share2, Heart, RotateCcw, Volume2, Settings } from "lucide-react";

interface AudioPlayerProps {
  track?: {
    title: string;
    genre: string;
    duration: number;
    bpm: number;
    key: string;
    isPlaying?: boolean;
  };
}

export default function AudioPlayer({ track }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState([75]);
  const [isLiked, setIsLiked] = useState(false);
  
  // Simulate audio progress
  useEffect(() => {
    if (isPlaying && track) {
      const interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= track.duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPlaying, track]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = track ? (currentTime / track.duration) * 100 : 0;

  // Generate waveform visualization
  const generateWaveform = () => {
    return Array.from({ length: 60 }, (_, i) => (
      <div
        key={i}
        className={`w-1 bg-gradient-waveform rounded-full transition-all duration-200 ${
          isPlaying ? 'animate-waveform' : ''
        }`}
        style={{
          height: `${Math.random() * 40 + 10}px`,
          animationDelay: `${i * 50}ms`,
          opacity: i < (progress / 100) * 60 ? 1 : 0.3
        }}
      />
    ));
  };

  if (!track) {
    return (
      <Card className="bg-gradient-glass backdrop-blur-md border-border/50 p-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Play className="w-8 h-8 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No Track Generated</h3>
          <p className="text-muted-foreground">Use the prompt builder to generate your first AI music track</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-glass backdrop-blur-md border-border/50 p-6">
      <div className="space-y-6">
        {/* Track Info */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-foreground">{track.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {track.genre}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {track.bpm} BPM
              </Badge>
              <Badge variant="outline" className="text-xs">
                Key of {track.key}
              </Badge>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsLiked(!isLiked)}
            className={isLiked ? "text-red-500" : "text-muted-foreground"}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          </Button>
        </div>

        {/* Waveform Visualization */}
        <div className="relative">
          <div className="flex items-end justify-center gap-1 h-24 p-4 bg-secondary/20 rounded-lg overflow-hidden">
            {generateWaveform()}
          </div>
          
          {/* Progress Overlay */}
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Time Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(track.duration)}</span>
          </div>
          <Slider
            value={[currentTime]}
            onValueChange={(value) => setCurrentTime(value[0])}
            max={track.duration}
            step={1}
            className="w-full cursor-pointer"
          />
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="icon">
            <RotateCcw className="w-4 h-4" />
          </Button>
          
          <Button 
            variant="studio" 
            size="icon" 
            className="w-12 h-12"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6" />
            )}
          </Button>
          
          <Button variant="outline" size="icon">
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Volume & Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <Slider
              value={volume}
              onValueChange={setVolume}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">{volume[0]}%</span>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Share2 className="w-4 h-4" />
            </Button>
            <Button variant="neon" size="sm">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
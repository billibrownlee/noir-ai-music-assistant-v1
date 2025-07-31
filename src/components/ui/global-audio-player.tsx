import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Square, Volume2, Music } from 'lucide-react';
import { useGlobalAudio } from '@/hooks/useGlobalAudio';

export const GlobalAudioPlayer: React.FC = () => {
  const { 
    currentTrack, 
    isPlaying, 
    volume, 
    currentTime, 
    duration,
    playTrack,
    pauseTrack,
    stopTrack,
    setVolume,
    seekTo
  } = useGlobalAudio();

  if (!currentTrack) {
    return null;
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressChange = (value: number[]) => {
    seekTo(value[0]);
  };

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 glass-card border-neon-blue/30 bg-studio-surface/95 backdrop-blur-md">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Track Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 bg-neon-purple/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Music className="w-6 h-6 text-neon-purple" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-medium text-sm truncate">{currentTrack.name}</h4>
              <p className="text-xs text-studio-text-secondary">
                {formatTime(currentTime)} / {formatTime(duration)}
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              Now Playing
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="flex-1 min-w-32 max-w-md">
            <Slider
              value={[currentTime]}
              onValueChange={handleProgressChange}
              min={0}
              max={duration || 100}
              step={1}
              className="w-full"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => currentTrack && playTrack(currentTrack)}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={stopTrack}
            >
              <Square className="w-4 h-4" />
            </Button>

            {/* Volume */}
            <div className="flex items-center gap-2 min-w-24">
              <Volume2 className="w-4 h-4 text-studio-text-secondary" />
              <Slider
                value={[volume * 100]}
                onValueChange={(value) => setVolume(value[0] / 100)}
                min={0}
                max={100}
                step={1}
                className="w-16"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
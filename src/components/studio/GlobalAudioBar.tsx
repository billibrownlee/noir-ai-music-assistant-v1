import React from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { useGlobalAudio } from "@/hooks/useGlobalAudio";

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
};

export const GlobalAudioBar: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playTrack,
    pauseTrack,
    stopTrack,
    seekTo,
    setVolume,
  } = useGlobalAudio();

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t border-border/50 px-4 py-3">
      <div className="max-w-screen-xl mx-auto flex items-center gap-4">
        {/* Track info */}
        <div className="w-44 min-w-0 flex-shrink-0">
          <p className="text-sm font-semibold truncate text-foreground">{currentTrack.name}</p>
          <p className="text-xs text-muted-foreground">Now Playing</p>
        </div>

        {/* Play / Stop */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              isPlaying ? pauseTrack() : playTrack(currentTrack)
            }
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={stopTrack}>
            <Square className="w-4 h-4" />
          </Button>
        </div>

        {/* Scrubber */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className="text-xs text-muted-foreground w-10 text-right flex-shrink-0">
            {fmt(currentTime)}
          </span>
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={([v]) => seekTo(v)}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-10 flex-shrink-0">
            {fmt(duration)}
          </span>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 w-28 flex-shrink-0">
          <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Slider
            value={[Math.round(volume * 100)]}
            max={100}
            step={1}
            onValueChange={([v]) => setVolume(v / 100)}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
};

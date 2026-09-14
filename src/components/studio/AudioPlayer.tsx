import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Download, Share2, Heart, RotateCcw, Volume2, Settings } from "lucide-react";
import { useGlobalAudio } from "@/hooks/useGlobalAudio";
import { useToast } from "@/hooks/use-toast";

interface AudioPlayerProps {
  track?: {
    title: string;
    genre: string;
    duration: number;
    bpm: number;
    key: string;
    audioUrl?: string;
    isPlaying?: boolean;
  };
}

export default function AudioPlayer({ track }: AudioPlayerProps) {
  const { playTrack, pauseTrack, isPlaying, currentTime, duration, volume, setVolume, seekTo, currentTrack } = useGlobalAudio();
  const { toast } = useToast();
  const didAutoPlay = useRef<string | null>(null);

  // Auto-play when a new track with a real URL is passed in
  useEffect(() => {
    if (!track?.audioUrl || !track?.title) return;
    // Only auto-play once per unique audioUrl
    if (didAutoPlay.current === track.audioUrl) return;
    didAutoPlay.current = track.audioUrl;
    playTrack({
      id: `player-${track.audioUrl}`,
      name: track.title,
      audioUrl: track.audioUrl,
    }).catch(console.warn);
  }, [track?.audioUrl, track?.title, playTrack]);

  const handlePlayPause = async () => {
    if (!track?.audioUrl) return;
    if (isPlaying && currentTrack?.audioUrl === track.audioUrl) {
      pauseTrack();
    } else {
      await playTrack({
        id: `player-${track.audioUrl}`,
        name: track.title ?? 'Track',
        audioUrl: track.audioUrl,
      }).catch(console.warn);
    }
  };

  const handleDownload = async () => {
    if (!track?.audioUrl) return;
    try {
      const res = await fetch(track.audioUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${track.title ?? 'noir-track'}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: 'Download failed',
        description: err instanceof Error ? err.message : 'Could not download audio',
        variant: 'destructive',
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isThisTrackPlaying = isPlaying && currentTrack?.audioUrl === track?.audioUrl;
  const displayTime = isThisTrackPlaying || currentTrack?.audioUrl === track?.audioUrl ? currentTime : 0;
  const displayDuration = duration > 0 ? duration : (track?.duration ?? 0);
  const progress = displayDuration > 0 ? (displayTime / displayDuration) * 100 : 0;

  // Generate deterministic waveform bars (same each render — no Math.random in render)
  const waveformHeights = useRef(Array.from({ length: 60 }, (_, i) => {
    const t = i / 60;
    return 15 + 35 * Math.abs(Math.sin(t * Math.PI * 7 + 0.5) * Math.cos(t * Math.PI * 3));
  }));

  if (!track) {
    return (
      <Card className="bg-gradient-glass backdrop-blur-md border-border/50 p-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Play className="w-8 h-8 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No Track Generated</h3>
          <p className="text-muted-foreground">Use the prompt builder or music generator to create your first AI track</p>
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
              <Badge variant="secondary" className="text-xs">{track.genre}</Badge>
              <Badge variant="outline" className="text-xs">{track.bpm} BPM</Badge>
              <Badge variant="outline" className="text-xs">Key of {track.key}</Badge>
              {!track.audioUrl && (
                <Badge variant="outline" className="text-xs text-muted-foreground">No audio</Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Heart className="w-4 h-4" />
          </Button>
        </div>

        {/* Waveform Visualization */}
        <div className="relative">
          <div className="flex items-end justify-center gap-1 h-24 p-4 bg-secondary/20 rounded-lg overflow-hidden">
            {waveformHeights.current.map((h, i) => (
              <div
                key={i}
                className={`w-1 bg-gradient-waveform rounded-full transition-all duration-200 ${
                  isThisTrackPlaying ? 'animate-waveform' : ''
                }`}
                style={{
                  height: `${h}px`,
                  animationDelay: `${i * 50}ms`,
                  opacity: i < (progress / 100) * 60 ? 1 : 0.3,
                }}
              />
            ))}
          </div>
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Time Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{formatTime(displayTime)}</span>
            <span>{formatTime(displayDuration)}</span>
          </div>
          <Slider
            value={[displayTime]}
            onValueChange={(value) => seekTo(value[0])}
            max={displayDuration || 1}
            step={1}
            className="w-full cursor-pointer"
          />
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="icon" onClick={() => seekTo(0)}>
            <RotateCcw className="w-4 h-4" />
          </Button>

          <Button
            variant="studio"
            size="icon"
            className="w-12 h-12"
            onClick={handlePlayPause}
            disabled={!track.audioUrl}
          >
            {isThisTrackPlaying ? (
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
              value={[Math.round(volume * 100)]}
              onValueChange={(v) => setVolume(v[0] / 100)}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">{Math.round(volume * 100)}%</span>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Share2 className="w-4 h-4" />
            </Button>
            <Button
              variant="neon"
              size="sm"
              onClick={handleDownload}
              disabled={!track.audioUrl}
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Download, Heart, Clock, Music } from "lucide-react";
import { useGlobalAudio } from "@/hooks/useGlobalAudio";
import { useToast } from "@/hooks/use-toast";

export interface GeneratedTrack {
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

interface GenerationHistoryProps {
  tracks: GeneratedTrack[];
  onTrackSelect: (track: GeneratedTrack) => void;
}

export default function GenerationHistory({ tracks, onTrackSelect }: GenerationHistoryProps) {
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const { playTrack, currentTrack, isPlaying } = useGlobalAudio();
  const { toast } = useToast();

  const formatTimeAgo = (date: Date) => {
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlay = async (track: GeneratedTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!track.audioUrl) {
      toast({ title: 'No audio', description: 'This track has no audio URL.', variant: 'destructive' });
      return;
    }
    await playTrack({ id: track.id, name: track.title, audioUrl: track.audioUrl }).catch(console.warn);
  };

  const handleDownload = async (track: GeneratedTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!track.audioUrl) return;
    try {
      const res = await fetch(track.audioUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${track.title}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: 'Download failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const toggleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card className="bg-gradient-glass backdrop-blur-md border-border/50 p-6 h-full">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Clock className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Recent Generations</h3>
              <p className="text-sm text-muted-foreground">Your AI music history</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Track List */}
        <ScrollArea className="h-[400px]">
          {tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Music className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No tracks generated yet.</p>
              <p className="text-muted-foreground text-xs mt-1">Use the Prompt Builder or AI Music Generator to create music.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tracks.map((track) => {
                const isActive = currentTrack?.id === track.id && isPlaying;
                const liked = likedIds.has(track.id) || track.liked;
                return (
                  <Card
                    key={track.id}
                    className={`bg-secondary/30 border-border/30 p-4 hover:bg-secondary/50 transition-all duration-200 cursor-pointer group ${isActive ? 'border-primary/50' : ''}`}
                    onClick={() => onTrackSelect(track)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-foreground truncate">{track.title}</h4>
                          {liked && <Heart className="w-4 h-4 text-red-500 fill-current flex-shrink-0" />}
                          {isActive && <Badge variant="secondary" className="text-xs animate-pulse">Playing</Badge>}
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">{track.genre}</Badge>
                          <span className="text-xs text-muted-foreground">{track.bpm} BPM</span>
                          <span className="text-xs text-muted-foreground">{track.key}</span>
                          <span className="text-xs text-muted-foreground">{formatDuration(track.duration)}</span>
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{track.prompt}</p>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{formatTimeAgo(track.timestamp)}</span>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => handlePlay(track, e)}
                              disabled={!track.audioUrl}
                            >
                              <Play className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => handleDownload(track, e)}
                              disabled={!track.audioUrl}
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => toggleLike(track.id, e)}
                            >
                              <Heart className={`w-3 h-3 ${liked ? 'fill-current text-red-500' : ''}`} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1">
            <Music className="w-4 h-4" />
            New Project
          </Button>
          <Button variant="glass" size="sm" className="flex-1">
            View All
          </Button>
        </div>
      </div>
    </Card>
  );
}

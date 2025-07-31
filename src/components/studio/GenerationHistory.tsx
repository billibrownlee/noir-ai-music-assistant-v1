import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Download, Heart, MoreVertical, Clock, Music } from "lucide-react";

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

const SAMPLE_TRACKS: Track[] = [
  {
    id: "1",
    title: "Midnight Groove",
    genre: "R&B",
    duration: 185,
    bpm: 75,
    key: "Dm",
    prompt: "Soulful R&B ballad with silky vocals and lush harmonies",
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    liked: true
  },
  {
    id: "2", 
    title: "Neon Dreams",
    genre: "Pop",
    duration: 210,
    bpm: 115,
    key: "C",
    prompt: "Dreamy pop ballad with ethereal vocals and ambient textures",
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    liked: false
  },
  {
    id: "3",
    title: "Street Heat",
    genre: "Trap-Rap", 
    duration: 160,
    bpm: 155,
    key: "Am",
    prompt: "Dark trap beat with rolling 808s and crisp snares",
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
    liked: true
  }
];

interface GenerationHistoryProps {
  onTrackSelect: (track: Track) => void;
}

export default function GenerationHistory({ onTrackSelect }: GenerationHistoryProps) {
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)}h ago`;
    } else {
      return `${Math.floor(diffMins / 1440)}d ago`;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
            {SAMPLE_TRACKS.length} tracks
          </Badge>
        </div>

        {/* Track List */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {SAMPLE_TRACKS.map((track) => (
              <Card 
                key={track.id}
                className="bg-secondary/30 border-border/30 p-4 hover:bg-secondary/50 transition-all duration-200 cursor-pointer group"
                onClick={() => onTrackSelect(track)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-foreground truncate">{track.title}</h4>
                      {track.liked && (
                        <Heart className="w-4 h-4 text-red-500 fill-current flex-shrink-0" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {track.genre}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {track.bpm} BPM
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {track.key}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(track.duration)}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {track.prompt}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(track.timestamp)}
                      </span>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Play className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
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
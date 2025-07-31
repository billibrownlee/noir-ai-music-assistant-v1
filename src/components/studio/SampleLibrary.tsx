import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Library, 
  Search, 
  Play, 
  Pause, 
  Download, 
  MoreHorizontal,
  Filter,
  Music2,
  Clock,
  Hash
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface AudioSample {
  id: string;
  name: string;
  genre: string;
  bpm?: number;
  key?: string;
  tags: string[];
  duration?: number;
  uploadDate: Date;
  isPlaying?: boolean;
}

const SAMPLE_LIBRARY: AudioSample[] = [
  {
    id: '1',
    name: 'Smooth RnB Vocal',
    genre: 'rnb',
    bpm: 85,
    key: 'C',
    tags: ['vocal', 'smooth', 'lead'],
    duration: 45,
    uploadDate: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'Trap 808 Pattern',
    genre: 'trap',
    bpm: 140,
    key: 'F#',
    tags: ['808', 'bass', 'pattern'],
    duration: 32,
    uploadDate: new Date('2024-01-14'),
  },
  {
    id: '3',
    name: 'Pop Synth Lead',
    genre: 'pop',
    bpm: 128,
    key: 'G',
    tags: ['synth', 'lead', 'bright'],
    duration: 38,
    uploadDate: new Date('2024-01-13'),
  },
  {
    id: '4',
    name: 'Soul Guitar Licks',
    genre: 'soul',
    bpm: 95,
    key: 'A',
    tags: ['guitar', 'licks', 'vintage'],
    duration: 52,
    uploadDate: new Date('2024-01-12'),
  },
];

interface SampleLibraryProps {
  onSampleSelect?: (sample: AudioSample) => void;
}

export const SampleLibrary: React.FC<SampleLibraryProps> = ({ onSampleSelect }) => {
  const [samples, setSamples] = useState<AudioSample[]>(SAMPLE_LIBRARY);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);

  const filteredSamples = samples.filter(sample => {
    const matchesSearch = sample.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         sample.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesGenre = selectedGenre === 'all' || sample.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  const handlePlay = (sampleId: string) => {
    if (playingId === sampleId) {
      setPlayingId(null);
    } else {
      setPlayingId(sampleId);
      // In a real app, this would trigger actual audio playback
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeAgo = (date: Date) => {
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const getGenreColor = (genre: string) => {
    const colors = {
      'rnb': 'bg-neon-purple/20 text-neon-purple',
      'pop': 'bg-neon-blue/20 text-neon-blue',
      'trap': 'bg-neon-green/20 text-neon-green',
      'rap': 'bg-neon-orange/20 text-neon-orange',
      'soul': 'bg-neon-pink/20 text-neon-pink',
      'hip-hop': 'bg-yellow-500/20 text-yellow-400',
    };
    return colors[genre as keyof typeof colors] || 'bg-studio-surface-secondary text-studio-text-secondary';
  };

  return (
    <Card className="glass-card h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library className="w-5 h-5 text-neon-purple" />
            Sample Library ({filteredSamples.length})
          </div>
        </CardTitle>
        
        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-studio-text-secondary" />
            <Input
              placeholder="Search samples..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedGenre} onValueChange={setSelectedGenre}>
            <SelectTrigger className="w-32">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genres</SelectItem>
              <SelectItem value="rnb">R&B</SelectItem>
              <SelectItem value="pop">Pop</SelectItem>
              <SelectItem value="trap">Trap</SelectItem>
              <SelectItem value="rap">Rap</SelectItem>
              <SelectItem value="soul">Soul</SelectItem>
              <SelectItem value="hip-hop">Hip-Hop</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-96">
          <div className="p-4 space-y-3">
            {filteredSamples.map(sample => (
              <Card 
                key={sample.id} 
                className="glass-card-subtle hover:bg-studio-surface-secondary/80 transition-all duration-200 group cursor-pointer"
                onClick={() => onSampleSelect?.(sample)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <Music2 className="w-8 h-8 text-neon-purple p-1.5 bg-neon-purple/20 rounded" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">{sample.name}</h4>
                          <Badge className={`text-xs ${getGenreColor(sample.genre)}`}>
                            {sample.genre.toUpperCase()}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-studio-text-secondary">
                          {sample.bpm && (
                            <span className="flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              {sample.bpm} BPM
                            </span>
                          )}
                          {sample.key && (
                            <span>Key: {sample.key}</span>
                          )}
                          {sample.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(sample.duration)}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 mt-2">
                          {sample.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {sample.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{sample.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlay(sample.id);
                        }}
                      >
                        {playingId === sample.id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            Use in Prompt
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-400">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {filteredSamples.length === 0 && (
              <div className="text-center py-8 text-studio-text-secondary">
                <Music2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No samples found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
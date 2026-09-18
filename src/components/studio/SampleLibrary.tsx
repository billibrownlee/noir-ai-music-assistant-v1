import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AudioPlayButton } from '@/components/ui/audio-play-button';
import { 
  Library, 
  Search, 
  Play,
  Download, 
  MoreHorizontal,
  Filter,
  Music2,
  Clock,
  Hash,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useGlobalAudio } from '@/hooks/useGlobalAudio';

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
  audioUrl?: string;
  file?: File;
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
  uploadedSamples?: AudioSample[];
  onDeleteSample?: (sampleId: string) => void;
}

export const SampleLibrary: React.FC<SampleLibraryProps> = ({ 
  onSampleSelect, 
  uploadedSamples = [],
  onDeleteSample
}) => {
  const { currentTrack, isPlaying } = useGlobalAudio();
  const { toast } = useToast();
  
  // Combine default samples with uploaded samples
  const allSamples = [...SAMPLE_LIBRARY, ...uploadedSamples];
  const [samples, setSamples] = useState<AudioSample[]>(allSamples);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  // Update samples when new ones are uploaded
  React.useEffect(() => {
    const combinedSamples = [...SAMPLE_LIBRARY, ...uploadedSamples];
    setSamples(combinedSamples);
  }, [uploadedSamples]);

  const filteredSamples = samples.filter(sample => {
    const matchesSearch = sample.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         sample.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesGenre = selectedGenre === 'all' || sample.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

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
      'rnb': 'bg-primary/20 text-primary',
      'pop': 'bg-primary/20 text-primary',
      'trap': 'bg-primary/20 text-primary',
      'rap': 'bg-neon-orange/20 text-neon-orange',
      'soul': 'bg-primary/20 text-primary',
      'hip-hop': 'bg-border/30 text-muted-foreground',
    };
    return colors[genre as keyof typeof colors] || 'bg-studio-surface-secondary text-studio-text-secondary';
  };

  return (
    <Card className="glass-card h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library className="w-5 h-5 text-primary" />
            Sample Library ({filteredSamples.length})
            {uploadedSamples.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {uploadedSamples.length} uploaded
              </Badge>
            )}
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
                      <div className="flex-shrink-0 relative">
                        <Music2 className="w-8 h-8 text-primary p-1.5 bg-primary/20 rounded" />
                        {currentTrack?.id === sample.id && isPlaying && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                        )}
                        {sample.audioUrl && !SAMPLE_LIBRARY.some(s => s.id === sample.id) && (
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-full"></div>
                        )}
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
                    <div className="flex items-center gap-1">
                      {sample.audioUrl ? (
                        <>
                          <AudioPlayButton
                            audioUrl={sample.audioUrl}
                            trackName={sample.name}
                            trackId={sample.id}
                            variant="ghost"
                            size="sm"
                          />
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          className="opacity-50"
                          title="No audio file available"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      
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
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              if (sample.audioUrl) {
                                const link = document.createElement('a');
                                link.href = sample.audioUrl;
                                link.download = `${sample.name}.${sample.audioUrl.includes('.wav') ? 'wav' : 'mp3'}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                
                                toast({
                                  title: "⬇️ Download Started",
                                  description: `Downloading "${sample.name}"...`,
                                });
                              } else {
                                toast({
                                  title: "Download Failed",
                                  description: "Audio file not available for download.",
                                  variant: "destructive"
                                });
                              }
                            }}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Music2 className="w-4 h-4 mr-2" />
                            Use in Prompt
                          </DropdownMenuItem>
                          
                          {/* Show delete option for all uploaded samples */}
                          {uploadedSamples.some(s => s.id === sample.id) && (
                            <>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem 
                                    className="text-red-400 hover:text-red-300 hover:bg-red-400/10 focus:bg-red-400/10 focus:text-red-300"
                                    onSelect={(e) => e.preventDefault()}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Remove Sample
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                      <AlertTriangle className="w-5 h-5 text-red-400" />
                                      Remove Sample
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove "{sample.name}" from your library? This action cannot be undone and the sample will be permanently deleted.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => {
                                        onDeleteSample?.(sample.id);
                                        toast({
                                          title: "🗑️ Sample Removed",
                                          description: `"${sample.name}" has been removed from your library.`,
                                        });
                                      }}
                                      className="bg-red-500 hover:bg-red-600 text-white"
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                          
                          {/* Show info for default samples that cannot be deleted */}
                          {SAMPLE_LIBRARY.some(s => s.id === sample.id) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                disabled
                                className="text-muted-foreground"
                              >
                                <Hash className="w-4 h-4 mr-2" />
                                Default Sample
                              </DropdownMenuItem>
                            </>
                          )}
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
                <p className="text-sm">
                  {uploadedSamples.length === 0 
                    ? "Upload audio files to get started" 
                    : "Try adjusting your search or filters"
                  }
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Drum, 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Shuffle, 
  Volume2,
  Zap,
  Clock,
  Hash
} from 'lucide-react';

interface DrumPattern {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  complexity: number;
  pattern: {
    kick: boolean[];
    snare: boolean[];
    hihat: boolean[];
    openhat: boolean[];
    crash: boolean[];
    ride: boolean[];
  };
  isPlaying?: boolean;
}

const SAMPLE_PATTERNS: DrumPattern[] = [
  {
    id: '1',
    name: 'Classic Trap',
    genre: 'trap',
    bpm: 140,
    complexity: 3,
    pattern: {
      kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
      snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
      hihat: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
      openhat: [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
      crash: [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      ride: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
    }
  },
  {
    id: '2',
    name: 'R&B Groove',
    genre: 'rnb',
    bpm: 85,
    complexity: 2,
    pattern: {
      kick: [true, false, false, true, false, false, true, false, false, true, false, false, true, false, false, false],
      snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
      hihat: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
      openhat: [false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, true],
      crash: [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      ride: [false, true, false, true, false, true, false, false, false, true, false, true, false, true, false, false]
    }
  },
  {
    id: '3',
    name: 'Pop Anthem',
    genre: 'pop',
    bpm: 128,
    complexity: 4,
    pattern: {
      kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
      snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
      hihat: [false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true],
      openhat: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      crash: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
      ride: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false]
    }
  }
];

export const DrumPatternGenerator: React.FC = () => {
  const [patterns, setPatterns] = useState<DrumPattern[]>(SAMPLE_PATTERNS);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [bpm, setBpm] = useState([120]);
  const [complexity, setComplexity] = useState([3]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [swing, setSwing] = useState(false);
  const [humanize, setHumanize] = useState(true);

  const filteredPatterns = patterns.filter(
    pattern => selectedGenre === 'all' || pattern.genre === selectedGenre
  );

  const handlePlay = (patternId: string) => {
    if (playingId === patternId) {
      setPlayingId(null);
    } else {
      setPlayingId(patternId);
      // In a real app, this would trigger actual audio playback
    }
  };

  const generateNewPattern = () => {
    const genres = ['trap', 'rnb', 'pop', 'hip-hop'];
    const selectedGenreForGen = selectedGenre === 'all' ? 
      genres[Math.floor(Math.random() * genres.length)] : selectedGenre;
    
    const newPattern: DrumPattern = {
      id: Date.now().toString(),
      name: `Generated ${selectedGenreForGen} Pattern`,
      genre: selectedGenreForGen,
      bpm: bpm[0],
      complexity: complexity[0],
      pattern: {
        kick: Array(16).fill(false).map(() => Math.random() > 0.7),
        snare: Array(16).fill(false).map((_, i) => i % 4 === 0 && Math.random() > 0.5),
        hihat: Array(16).fill(false).map(() => Math.random() > 0.3),
        openhat: Array(16).fill(false).map(() => Math.random() > 0.8),
        crash: Array(16).fill(false).map((_, i) => i === 0 && Math.random() > 0.5),
        ride: Array(16).fill(false).map(() => Math.random() > 0.85)
      }
    };
    
    setPatterns(prev => [newPattern, ...prev]);
  };

  const getGenreColor = (genre: string) => {
    const colors = {
      'trap': 'bg-neon-green/20 text-neon-green',
      'rnb': 'bg-primary/20 text-primary',
      'pop': 'bg-neon-blue/20 text-neon-blue',
      'hip-hop': 'bg-neon-orange/20 text-neon-orange'
    };
    return colors[genre as keyof typeof colors] || 'bg-studio-surface-secondary text-studio-text-secondary';
  };

  const DrumGrid: React.FC<{ pattern: DrumPattern }> = ({ pattern }) => {
    const drumTypes = ['kick', 'snare', 'hihat', 'openhat', 'crash', 'ride'];
    const drumLabels = ['K', 'S', 'H', 'O', 'C', 'R'];
    
    return (
      <div className="space-y-1">
        {drumTypes.map((drumType, drumIndex) => (
          <div key={drumType} className="flex items-center gap-1">
            <span className="w-4 text-xs font-mono text-studio-text-secondary">
              {drumLabels[drumIndex]}
            </span>
            <div className="flex gap-0.5">
              {pattern.pattern[drumType as keyof typeof pattern.pattern].map((hit, stepIndex) => (
                <div
                  key={stepIndex}
                  className={`w-3 h-3 rounded-sm border ${
                    hit 
                      ? 'bg-neon-green border-neon-green' 
                      : 'bg-studio-surface-secondary border-studio-border'
                  } ${stepIndex % 4 === 0 ? 'ml-1' : ''}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Drum className="w-5 h-5 text-neon-green" />
          Drum Pattern Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Generation Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Genre</Label>
            <Select value={selectedGenre} onValueChange={setSelectedGenre}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                <SelectItem value="trap">Trap</SelectItem>
                <SelectItem value="rnb">R&B</SelectItem>
                <SelectItem value="pop">Pop</SelectItem>
                <SelectItem value="hip-hop">Hip-Hop</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>BPM: {bpm[0]}</Label>
            <Slider
              value={bpm}
              onValueChange={setBpm}
              min={60}
              max={180}
              step={1}
              className="mt-2"
            />
          </div>
          
          <div>
            <Label>Complexity: {complexity[0]}/5</Label>
            <Slider
              value={complexity}
              onValueChange={setComplexity}
              min={1}
              max={5}
              step={1}
              className="mt-2"
            />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Swing</Label>
              <Switch checked={swing} onCheckedChange={setSwing} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Humanize</Label>
              <Switch checked={humanize} onCheckedChange={setHumanize} />
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex gap-2">
          <Button onClick={generateNewPattern} className="flex-1" variant="neon">
            <Zap className="w-4 h-4 mr-2" />
            Generate Pattern
          </Button>
          <Button variant="outline">
            <Shuffle className="w-4 h-4" />
          </Button>
        </div>

        {/* Pattern Library */}
        <div className="space-y-3">
          <h3 className="font-medium">Pattern Library</h3>
          {filteredPatterns.map(pattern => (
            <Card key={pattern.id} className="glass-card-subtle">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{pattern.name}</h4>
                    <Badge className={`text-xs ${getGenreColor(pattern.genre)}`}>
                      {pattern.genre.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePlay(pattern.id)}
                    >
                      {playingId === pattern.id ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mb-3 text-sm text-studio-text-secondary">
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {pattern.bpm} BPM
                  </span>
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3 h-3" />
                    Level {pattern.complexity}
                  </span>
                </div>
                
                <DrumGrid pattern={pattern} />
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
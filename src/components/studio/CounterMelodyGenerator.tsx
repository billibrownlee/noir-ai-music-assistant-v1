import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Music2, 
  Play, 
  Pause, 
  Download, 
  Shuffle, 
  Layers,
  TrendingUp,
  Zap,
  Target,
  Volume2
} from 'lucide-react';

interface CounterMelody {
  id: string;
  name: string;
  instrument: string;
  key: string;
  octave: number;
  complexity: number;
  relationship: 'harmony' | 'counter' | 'call-response' | 'rhythmic';
  notes: string[];
  isPlaying?: boolean;
  compatibility: number;
}

const SAMPLE_MELODIES: CounterMelody[] = [
  {
    id: '1',
    name: 'Smooth Saxophone Line',
    instrument: 'saxophone',
    key: 'C',
    octave: 4,
    complexity: 3,
    relationship: 'harmony',
    notes: ['C4', 'E4', 'G4', 'A4', 'G4', 'E4', 'D4', 'C4'],
    compatibility: 94
  },
  {
    id: '2',
    name: 'Electric Piano Stabs',
    instrument: 'electric-piano',
    key: 'C',
    octave: 5,
    complexity: 2,
    relationship: 'rhythmic',
    notes: ['C5', 'rest', 'E5', 'rest', 'G5', 'rest', 'C5', 'rest'],
    compatibility: 87
  },
  {
    id: '3',
    name: 'String Pad Harmony',
    instrument: 'strings',
    key: 'C',
    octave: 3,
    complexity: 1,
    relationship: 'harmony',
    notes: ['C3', 'E3', 'G3', 'C4', 'G3', 'E3', 'C3', 'G2'],
    compatibility: 91
  },
  {
    id: '4',
    name: 'Lead Guitar Licks',
    instrument: 'guitar',
    key: 'C',
    octave: 4,
    complexity: 4,
    relationship: 'call-response',
    notes: ['E4', 'G4', 'B4', 'C5', 'B4', 'G4', 'E4', 'D4'],
    compatibility: 82
  }
];

export const CounterMelodyGenerator: React.FC = () => {
  const [melodies, setMelodies] = useState<CounterMelody[]>(SAMPLE_MELODIES);
  const [selectedInstrument, setSelectedInstrument] = useState<string>('all');
  const [selectedRelationship, setSelectedRelationship] = useState<string>('all');
  const [complexity, setComplexity] = useState([3]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [analyzeMainMelody, setAnalyzeMainMelody] = useState(true);
  const [avoidClashing, setAvoidClashing] = useState(true);

  const filteredMelodies = melodies.filter(melody => {
    const matchesInstrument = selectedInstrument === 'all' || melody.instrument === selectedInstrument;
    const matchesRelationship = selectedRelationship === 'all' || melody.relationship === selectedRelationship;
    return matchesInstrument && matchesRelationship;
  });

  const handlePlay = (melodyId: string) => {
    if (playingId === melodyId) {
      setPlayingId(null);
    } else {
      setPlayingId(melodyId);
      // In a real app, this would trigger actual audio playback
    }
  };

  const generateCounterMelody = () => {
    const instruments = ['saxophone', 'electric-piano', 'strings', 'guitar', 'synth-lead', 'flute'];
    const relationships = ['harmony', 'counter', 'call-response', 'rhythmic'];
    const keys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    
    const selectedInst = selectedInstrument === 'all' ? 
      instruments[Math.floor(Math.random() * instruments.length)] : selectedInstrument;
    
    const newMelody: CounterMelody = {
      id: Date.now().toString(),
      name: `Generated ${selectedInst} Line`,
      instrument: selectedInst,
      key: keys[Math.floor(Math.random() * keys.length)],
      octave: 3 + Math.floor(Math.random() * 3),
      complexity: complexity[0],
      relationship: relationships[Math.floor(Math.random() * relationships.length)] as any,
      notes: Array(8).fill(0).map(() => 
        Math.random() > 0.8 ? 'rest' : `C${3 + Math.floor(Math.random() * 3)}`
      ),
      compatibility: 75 + Math.floor(Math.random() * 25)
    };
    
    setMelodies(prev => [newMelody, ...prev]);
  };

  const getRelationshipColor = (relationship: string) => {
    const colors = {
      'harmony': 'bg-neon-blue/20 text-neon-blue',
      'counter': 'bg-neon-purple/20 text-neon-purple',
      'call-response': 'bg-neon-green/20 text-neon-green',
      'rhythmic': 'bg-neon-orange/20 text-neon-orange'
    };
    return colors[relationship as keyof typeof colors] || 'bg-studio-surface-secondary text-studio-text-secondary';
  };

  const getInstrumentIcon = (instrument: string) => {
    // For simplicity, using Music2 for all instruments
    return <Music2 className="w-4 h-4" />;
  };

  const NoteSequence: React.FC<{ notes: string[] }> = ({ notes }) => {
    return (
      <div className="flex gap-1 mt-2">
        {notes.map((note, index) => (
          <div
            key={index}
            className={`px-2 py-1 text-xs rounded ${
              note === 'rest' 
                ? 'bg-studio-surface-secondary text-studio-text-secondary' 
                : 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
            }`}
          >
            {note === 'rest' ? '—' : note}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-neon-blue" />
          Counter Melody Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Generation Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Instrument</Label>
            <Select value={selectedInstrument} onValueChange={setSelectedInstrument}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Instruments</SelectItem>
                <SelectItem value="saxophone">Saxophone</SelectItem>
                <SelectItem value="electric-piano">Electric Piano</SelectItem>
                <SelectItem value="strings">Strings</SelectItem>
                <SelectItem value="guitar">Guitar</SelectItem>
                <SelectItem value="synth-lead">Synth Lead</SelectItem>
                <SelectItem value="flute">Flute</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Relationship</Label>
            <Select value={selectedRelationship} onValueChange={setSelectedRelationship}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="harmony">Harmonic</SelectItem>
                <SelectItem value="counter">Counter Point</SelectItem>
                <SelectItem value="call-response">Call & Response</SelectItem>
                <SelectItem value="rhythmic">Rhythmic</SelectItem>
              </SelectContent>
            </Select>
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
              <Label>Analyze Main Melody</Label>
              <Switch checked={analyzeMainMelody} onCheckedChange={setAnalyzeMainMelody} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Avoid Clashing</Label>
              <Switch checked={avoidClashing} onCheckedChange={setAvoidClashing} />
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex gap-2">
          <Button onClick={generateCounterMelody} className="flex-1" variant="neon">
            <Zap className="w-4 h-4 mr-2" />
            Generate Counter Melody
          </Button>
          <Button variant="outline">
            <Target className="w-4 h-4" />
          </Button>
        </div>

        {/* Melody Library */}
        <div className="space-y-3">
          <h3 className="font-medium">Counter Melody Suggestions</h3>
          {filteredMelodies.map(melody => (
            <Card key={melody.id} className="glass-card-subtle">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getInstrumentIcon(melody.instrument)}
                    <h4 className="font-medium">{melody.name}</h4>
                    <Badge className={`text-xs ${getRelationshipColor(melody.relationship)}`}>
                      {melody.relationship}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right text-sm">
                      <div className="text-studio-text-secondary">Compatibility</div>
                      <div className={`font-medium ${
                        melody.compatibility > 90 ? 'text-neon-green' :
                        melody.compatibility > 80 ? 'text-neon-blue' : 'text-neon-orange'
                      }`}>
                        {melody.compatibility}%
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePlay(melody.id)}
                    >
                      {playingId === melody.id ? (
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
                
                <div className="flex items-center gap-4 mb-2 text-sm text-studio-text-secondary">
                  <span>Key: {melody.key}</span>
                  <span>Octave: {melody.octave}</span>
                  <span>Complexity: {melody.complexity}/5</span>
                  <span className="capitalize">{melody.instrument}</span>
                </div>
                
                <NoteSequence notes={melody.notes} />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <TrendingUp className="w-4 h-4 mr-2" />
            Analyze Current Track
          </Button>
          <Button variant="outline" size="sm">
            <Volume2 className="w-4 h-4 mr-2" />
            Layer All Compatible
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
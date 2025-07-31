import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Music, Play, Pause, Download, Sparkles, Zap, Volume2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGlobalAudio } from '@/hooks/useGlobalAudio';
import { MusicGenerationEngine } from '@/lib/musicGenerationEngine';
import { supabase } from '@/integrations/supabase/client';

interface GeneratedMusic {
  id: string;
  prompt: string;
  originalPrompt: string;
  audioUrl: string;
  duration: number;
  style: string;
  instrumental: boolean;
  metadata: {
    bpm: number;
    key: string;
    genre: string;
    energy: number;
  };
  generationTime: number;
  timestamp: Date;
}

interface MusicGeneratorProps {
  onMusicGenerated?: (music: GeneratedMusic) => void;
}

export const MusicGenerator: React.FC<MusicGeneratorProps> = ({ onMusicGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('electronic');
  const [duration, setDuration] = useState([30]);
  const [instrumental, setInstrumental] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMusic, setGeneratedMusic] = useState<GeneratedMusic[]>([]);
  const { toast } = useToast();
  const { currentTrack, isPlaying, playTrack } = useGlobalAudio();
  const [musicEngine] = useState(() => new MusicGenerationEngine());

  const musicStyles = [
    { value: 'hip-hop', label: 'Hip-Hop/Trap', description: '808s, hard drums, urban vibes' },
    { value: 'rnb', label: 'R&B/Soul', description: 'Smooth vocals, rich harmonies, soulful rhythms' },
    { value: 'pop', label: 'Pop', description: 'Catchy melodies, mainstream appeal' },
    { value: 'electronic', label: 'Electronic/EDM', description: 'Synthesizers, digital beats, modern sounds' },
    { value: 'rock', label: 'Rock', description: 'Guitars, drums, energetic rhythms' },
    { value: 'jazz', label: 'Jazz', description: 'Complex harmonies, improvisation' },
    { value: 'classical', label: 'Classical', description: 'Orchestral instruments, formal structure' },
    { value: 'ambient', label: 'Ambient/Chill', description: 'Atmospheric, relaxing soundscapes' },
    { value: 'funk', label: 'Funk/Soul', description: 'Groovy basslines, rhythmic patterns' },
    { value: 'experimental', label: 'Experimental', description: 'Unique sounds, creative exploration' }
  ];

  const examplePrompts = [
    "Uplifting techno track with driving bassline and ethereal pads",
    "Chill lo-fi hip-hop beat with vinyl crackle and soft piano",
    "Energetic trap beat with 808 kicks and crispy hi-hats",
    "Dreamy ambient soundscape with floating synths and reverb",
    "Funky bass groove with punchy drums and brass stabs",
    "Dark electronic with industrial elements and haunting melodies"
  ];

  const generateMusic = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please enter a description for the music you want to generate.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    console.log('🎵 Starting real audio generation...');

    try {
      const startTime = Date.now();

      // Parse key from style-appropriate defaults
      const keyDefaults = {
        'electronic': 'C minor',
        'hip-hop': 'F minor', 
        'rnb': 'Bb major',
        'pop': 'C major',
        'rock': 'A minor',
        'jazz': 'Bb major',
        'classical': 'C major',
        'ambient': 'D minor',
        'funk': 'E minor',
        'experimental': 'F# minor'
      };

      const defaultKey = keyDefaults[style as keyof typeof keyDefaults] || 'C major';
      
      // Generate BPM based on style
      const bpmRanges = {
        'electronic': { min: 120, max: 140 },
        'hip-hop': { min: 70, max: 100 },
        'rnb': { min: 70, max: 110 },
        'pop': { min: 100, max: 130 },
        'rock': { min: 110, max: 150 },
        'jazz': { min: 80, max: 120 },
        'classical': { min: 60, max: 100 },
        'ambient': { min: 60, max: 90 },
        'funk': { min: 100, max: 130 },
        'experimental': { min: 80, max: 140 }
      };

      const bpmRange = bpmRanges[style as keyof typeof bpmRanges] || { min: 80, max: 140 };
      const bpm = Math.floor(Math.random() * (bpmRange.max - bpmRange.min + 1)) + bpmRange.min;

      // Generate actual audio using our synthesis engine
      console.log('🎛️ Synthesizing audio:', { style, duration: duration[0], bpm, key: defaultKey });
      
      const generatedTrack = await musicEngine.generateMusic({
        prompt: prompt.trim(),
        style,
        duration: duration[0],
        bpm,
        key: defaultKey,
        instrumental
      });

      const generationTime = (Date.now() - startTime) / 1000;

      const generatedMusic: GeneratedMusic = {
        id: `gen_${Date.now()}`,
        prompt: `${prompt.trim()} - ${style} style, ${duration[0]}s, ${bpm} BPM, ${defaultKey}`,
        originalPrompt: prompt.trim(),
        audioUrl: generatedTrack.audioUrl,
        duration: duration[0],
        style,
        instrumental,
        metadata: {
          bpm,
          key: defaultKey,
          genre: style,
          energy: Math.random() * 0.5 + 0.5
        },
        generationTime,
        timestamp: new Date()
      };

      setGeneratedMusic(prev => [generatedMusic, ...prev]);
      setPrompt(''); // Clear prompt for next generation

      console.log('✅ Real audio generated successfully!', generatedTrack);
      toast({
        title: "🎵 Music Generated!",
        description: `Created ${duration[0]}s ${style} track with real audio (${generationTime.toFixed(1)}s)`,
      });

      // Callback for parent component
      if (onMusicGenerated) {
        onMusicGenerated(generatedMusic);
      }

    } catch (error) {
      console.error('❌ Music generation failed:', error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate music. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const playGeneratedMusic = async (music: GeneratedMusic) => {
    // Now plays the actual generated audio
    await playTrack({
      id: music.id,
      name: music.originalPrompt,
      audioUrl: music.audioUrl
    });
    
    toast({
      title: "🎵 Playing Generated Music",
      description: `Now playing: "${music.originalPrompt}" (${music.metadata.bpm} BPM in ${music.metadata.key})`,
    });
  };

  const downloadMusic = (music: GeneratedMusic) => {
    // Download the actual generated audio file
    const link = document.createElement('a');
    link.href = music.audioUrl;
    link.download = `${music.originalPrompt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "🎵 Download Started",
      description: `Downloading: "${music.originalPrompt}.wav"`,
    });
  };

  const selectedStyle = musicStyles.find(s => s.value === style);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="w-5 h-5 text-neon-blue" />
          AI Music Generator
          <Badge variant="secondary">Experimental</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Music Prompt */}
        <div className="space-y-2">
          <Label htmlFor="music-prompt">Music Description</Label>
          <Textarea
            id="music-prompt"
            placeholder="Describe the music you want to generate... (e.g., 'Upbeat electronic track with catchy melody and driving beat')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex flex-wrap gap-2">
            {examplePrompts.slice(0, 3).map((example, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => setPrompt(example)}
                className="text-xs"
              >
                "{example.substring(0, 30)}..."
              </Button>
            ))}
          </div>
        </div>

        {/* Style Selection */}
        <div className="space-y-2">
          <Label>Music Style</Label>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {musicStyles.map(s => (
                <SelectItem key={s.value} value={s.value}>
                  <div className="space-y-1">
                    <div className="font-medium">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedStyle && (
            <p className="text-sm text-muted-foreground">{selectedStyle.description}</p>
          )}
        </div>

        {/* Duration Control */}
        <div className="space-y-2">
          <Label>Duration: {duration[0]} seconds</Label>
          <Slider
            value={duration}
            onValueChange={setDuration}
            min={10}
            max={120}
            step={10}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>10s (Quick)</span>
            <span>60s (Standard)</span>
            <span>120s (Extended)</span>
          </div>
        </div>

        {/* Instrumental Toggle */}
        <div className="flex items-center space-x-2">
          <Switch id="instrumental" checked={instrumental} onCheckedChange={setInstrumental} />
          <Label htmlFor="instrumental">Instrumental only (no vocals)</Label>
        </div>

        {/* Generate Button */}
        <Button 
          onClick={generateMusic} 
          disabled={isGenerating || !prompt.trim()}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Zap className="w-4 h-4 mr-2 animate-pulse" />
              Generating Music...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Music
            </>
          )}
        </Button>

        {/* Generated Music List */}
        {generatedMusic.length > 0 && (
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Generated Music ({generatedMusic.length})
            </h3>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {generatedMusic.map((music) => (
                <div key={music.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{music.originalPrompt}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {music.metadata.bpm} BPM
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {music.metadata.key} key
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {music.style}
                        </Badge>
                        <span>{music.duration}s</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {music.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => playGeneratedMusic(music)}
                      className="flex-1"
                    >
                       <Play className="w-3 h-3 mr-1" />
                       Play
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadMusic(music)}
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Note */}
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-sm text-green-400">
            <Sparkles className="w-4 h-4 inline mr-1" />
            <strong>Self-Contained Audio Generation:</strong> This system generates real audio files using Web Audio API and programmatic synthesis. No external services required - creates actual playable WAV files with different musical styles, rhythms, and harmonies.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
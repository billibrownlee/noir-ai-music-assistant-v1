import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AudioPlayButton } from '@/components/ui/audio-play-button';
import { useGlobalAudio } from '@/hooks/useGlobalAudio';
import { 
  Layers, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  Mic, 
  Music, 
  Zap, 
  Download,
  Settings,
  RotateCcw,
  Sliders
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AudioSeparationEngine, AudioStem, SeparatedAudio } from '@/lib/audioSeparation';

interface StemEditorProps {
  separatedAudio: SeparatedAudio | null;
  onStemUpdate?: (stemId: string, updates: Partial<AudioStem>) => void;
}

export const StemEditor: React.FC<StemEditorProps> = ({ separatedAudio, onStemUpdate }) => {
  const { toast } = useToast();
  const { currentTrack, isPlaying } = useGlobalAudio();
  const [selectedStem, setSelectedStem] = useState<string>('');
  const [globalEffects, setGlobalEffects] = useState({
    masterVolume: 100,
    masterPan: 0,
    roomSize: 30,
    ambience: 15
  });

  if (!separatedAudio) {
    return (
      <Card className="glass-card">
        <CardContent className="p-8 text-center">
          <Layers className="w-12 h-12 mx-auto mb-4 text-studio-text-secondary" />
          <p className="text-studio-text-secondary">No separated audio loaded</p>
          <p className="text-xs text-studio-text-secondary mt-2">
            Upload audio to automatically separate into stems for editing
          </p>
        </CardContent>
      </Card>
    );
  }

  const updateStem = useCallback((stemId: string, updates: Partial<AudioStem>) => {
    onStemUpdate?.(stemId, updates);
  }, [onStemUpdate]);

  const getStemIcon = (type: AudioStem['type']) => {
    const icons = {
      vocals: Mic,
      drums: Zap,
      bass: Volume2,
      melody: Music,
      other: Layers
    };
    const Icon = icons[type] || Layers;
    return <Icon className="w-4 h-4" />;
  };

  const getStemColor = (type: AudioStem['type']) => {
    const colors = {
      vocals: 'border-neon-purple bg-neon-purple/10',
      drums: 'border-neon-green bg-neon-green/10',
      bass: 'border-neon-orange bg-neon-orange/10',
      melody: 'border-neon-blue bg-neon-blue/10',
      other: 'border-studio-border bg-studio-surface-secondary/50'
    };
    return colors[type] || colors.other;
  };

  const WaveformDisplay: React.FC<{ waveformData: number[], isActive: boolean }> = ({ 
    waveformData, 
    isActive 
  }) => (
    <div className="h-16 bg-studio-surface-secondary rounded p-2 flex items-end gap-0.5 overflow-hidden">
      {waveformData.map((value, index) => (
        <div
          key={index}
          className={`flex-1 rounded-sm transition-all duration-150 ${
            isActive 
              ? 'bg-neon-green animate-pulse' 
              : 'bg-neon-blue'
          }`}
          style={{ 
            height: `${Math.max(2, (value / 100) * 48)}px`,
            opacity: isActive ? 0.8 : 0.4
          }}
        />
      ))}
    </div>
  );

  const StemControls: React.FC<{ stem: AudioStem }> = ({ stem }) => {
    const isCurrentStem = currentTrack?.id === stem.id;
    const isStemPlaying = isCurrentStem && isPlaying;

    return (
      <Card className={`glass-card-subtle ${getStemColor(stem.type)} border-2`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {getStemIcon(stem.type)}
              <h4 className="font-medium flex items-center gap-2">
                {stem.name}
                {isStemPlaying && (
                  <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse"></div>
                )}
              </h4>
              <Badge variant="outline" className="text-xs">
                {stem.type}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <AudioPlayButton
                audioUrl={stem.audioUrl}
                trackName={stem.name}
                trackId={stem.id}
                variant="outline"
                size="sm"
              />
              <Button
                variant={stem.muted ? "destructive" : "outline"}
                size="sm"
                onClick={() => updateStem(stem.id, { muted: !stem.muted })}
              >
                {stem.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Button
                variant={stem.soloed ? "neon" : "outline"}
                size="sm"
                onClick={() => updateStem(stem.id, { soloed: !stem.soloed })}
              >
                S
              </Button>
            </div>
          </div>

          {/* Waveform */}
          <WaveformDisplay 
            waveformData={stem.waveformData} 
            isActive={isStemPlaying}
          />

          {/* Basic Controls */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <Label className="text-xs">Volume: {stem.volume}%</Label>
              <Slider
                value={[stem.volume]}
                onValueChange={([value]) => updateStem(stem.id, { volume: value })}
                min={0}
                max={150}
                step={1}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-xs">
                Pan: {stem.pan > 0 ? 'R' : stem.pan < 0 ? 'L' : 'C'}{Math.abs(stem.pan)}
              </Label>
              <Slider
                value={[stem.pan]}
                onValueChange={([value]) => updateStem(stem.id, { pan: value })}
                min={-100}
                max={100}
                step={1}
                className="mt-1"
              />
            </div>
          </div>

          {/* Effects Controls */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              <Label className="text-sm font-medium">Effects</Label>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Reverb: {stem.effects.reverb}%</Label>
                <Slider
                  value={[stem.effects.reverb]}
                  onValueChange={([value]) => updateStem(stem.id, { 
                    effects: { ...stem.effects, reverb: value }
                  })}
                  min={0}
                  max={100}
                  step={1}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label className="text-xs">Delay: {stem.effects.delay}%</Label>
                <Slider
                  value={[stem.effects.delay]}
                  onValueChange={([value]) => updateStem(stem.id, { 
                    effects: { ...stem.effects, delay: value }
                  })}
                  min={0}
                  max={100}
                  step={1}
                  className="mt-1"
                />
              </div>
            </div>

            {/* EQ Section */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">3-Band EQ</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Low: {stem.effects.eq.low > 0 ? '+' : ''}{stem.effects.eq.low}dB</Label>
                  <Slider
                    value={[stem.effects.eq.low]}
                    onValueChange={([value]) => updateStem(stem.id, { 
                      effects: { 
                        ...stem.effects, 
                        eq: { ...stem.effects.eq, low: value }
                      }
                    })}
                    min={-12}
                    max={12}
                    step={0.5}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label className="text-xs">Mid: {stem.effects.eq.mid > 0 ? '+' : ''}{stem.effects.eq.mid}dB</Label>
                  <Slider
                    value={[stem.effects.eq.mid]}
                    onValueChange={([value]) => updateStem(stem.id, { 
                      effects: { 
                        ...stem.effects, 
                        eq: { ...stem.effects.eq, mid: value }
                      }
                    })}
                    min={-12}
                    max={12}
                    step={0.5}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label className="text-xs">High: {stem.effects.eq.high > 0 ? '+' : ''}{stem.effects.eq.high}dB</Label>
                  <Slider
                    value={[stem.effects.eq.high]}
                    onValueChange={([value]) => updateStem(stem.id, { 
                      effects: { 
                        ...stem.effects, 
                        eq: { ...stem.effects.eq, high: value }
                      }
                    })}
                    min={-12}
                    max={12}
                    step={0.5}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" className="flex-1">
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <Download className="w-3 h-3 mr-1" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-neon-blue" />
            Stem Editor - Same AirPods Audio Routing
            <Badge variant="outline">
              {separatedAudio.stems.length} stems
            </Badge>
            <Badge variant="outline" className="bg-neon-green/20 text-neon-green">
              {separatedAudio.separationQuality}% quality
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Separation Info */}
        <div className="flex items-center justify-between p-3 bg-studio-surface-secondary rounded-lg">
          <div>
            <h4 className="font-medium">{separatedAudio.originalFileName}</h4>
            <p className="text-sm text-studio-text-secondary">
              Processed in {(separatedAudio.processingTime / 1000).toFixed(1)}s • Audio routes to same device as Sample Library
            </p>
          </div>
        </div>

        {/* Individual Stem Controls */}
        <div className="space-y-4">
          <h3 className="font-medium">Individual Stems (Click play buttons to hear through AirPods)</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {separatedAudio.stems.map(stem => (
              <StemControls key={stem.id} stem={stem} />
            ))}
          </div>
        </div>

        {/* Export Options */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1">
            <Download className="w-4 h-4 mr-2" />
            Export Individual Stems
          </Button>
          <Button variant="neon" className="flex-1">
            <Download className="w-4 h-4 mr-2" />
            Export Mixed Track
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
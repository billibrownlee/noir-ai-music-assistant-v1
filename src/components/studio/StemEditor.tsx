import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [playingStems, setPlayingStems] = useState<Set<string>>(new Set());
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
        </CardContent>
      </Card>
    );
  }

  const handlePlayStem = useCallback((stemId: string) => {
    const newPlayingStems = new Set(playingStems);
    
    if (playingStems.has(stemId)) {
      newPlayingStems.delete(stemId);
    } else {
      newPlayingStems.add(stemId);
    }
    
    setPlayingStems(newPlayingStems);
    
    toast({
      title: `${playingStems.has(stemId) ? 'Stopped' : 'Playing'} stem`,
      description: separatedAudio.stems.find(s => s.id === stemId)?.name || 'Unknown stem'
    });
  }, [playingStems, separatedAudio.stems, toast]);

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
      vocals: 'border-neon-purple',
      drums: 'border-neon-green',
      bass: 'border-neon-orange',
      melody: 'border-neon-blue',
      other: 'border-studio-border'
    };
    return colors[type] || colors.other;
  };

  const WaveformDisplay: React.FC<{ waveformData: number[], isPlaying: boolean }> = ({ 
    waveformData, 
    isPlaying 
  }) => (
    <div className="h-16 bg-studio-surface-secondary rounded p-2 flex items-end gap-0.5 overflow-hidden">
      {waveformData.map((value, index) => (
        <div
          key={index}
          className={`flex-1 rounded-sm transition-all duration-150 ${
            isPlaying 
              ? 'bg-neon-green animate-pulse' 
              : 'bg-neon-blue'
          }`}
          style={{ 
            height: `${Math.max(2, (value / 100) * 48)}px`,
            opacity: isPlaying ? 0.8 : 0.4
          }}
        />
      ))}
    </div>
  );

  const StemControls: React.FC<{ stem: AudioStem }> = ({ stem }) => (
    <Card className={`glass-card-subtle ${getStemColor(stem.type)} border-2`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {getStemIcon(stem.type)}
            <h4 className="font-medium">{stem.name}</h4>
            <Badge variant="outline" className="text-xs">
              {stem.type}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePlayStem(stem.id)}
            >
              {playingStems.has(stem.id) ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
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
          isPlaying={playingStems.has(stem.id)}
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
            
            <div>
              <Label className="text-xs">Distortion: {stem.effects.distortion}%</Label>
              <Slider
                value={[stem.effects.distortion]}
                onValueChange={([value]) => updateStem(stem.id, { 
                  effects: { ...stem.effects, distortion: value }
                })}
                min={0}
                max={100}
                step={1}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-xs">Filter: {stem.effects.filter.frequency}Hz</Label>
              <Slider
                value={[stem.effects.filter.frequency]}
                onValueChange={([value]) => updateStem(stem.id, { 
                  effects: { 
                    ...stem.effects, 
                    filter: { ...stem.effects.filter, frequency: value }
                  }
                })}
                min={20}
                max={20000}
                step={10}
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

          {/* Filter Type */}
          <div>
            <Label className="text-xs">Filter Type</Label>
            <Select 
              value={stem.effects.filter.type}
              onValueChange={(value: any) => updateStem(stem.id, { 
                effects: { 
                  ...stem.effects, 
                  filter: { ...stem.effects.filter, type: value }
                }
              })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lowpass">Low Pass</SelectItem>
                <SelectItem value="highpass">High Pass</SelectItem>
                <SelectItem value="bandpass">Band Pass</SelectItem>
              </SelectContent>
            </Select>
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

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-neon-blue" />
            Stem Editor
            <Badge variant="outline">
              {separatedAudio.stems.length} stems
            </Badge>
            <Badge variant="outline" className="bg-neon-green/20 text-neon-green">
              {separatedAudio.separationQuality}% quality
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-1" />
              Global FX
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Separation Info */}
        <div className="flex items-center justify-between p-3 bg-studio-surface-secondary rounded-lg">
          <div>
            <h4 className="font-medium">{separatedAudio.originalFileName}</h4>
            <p className="text-sm text-studio-text-secondary">
              Processed in {(separatedAudio.processingTime / 1000).toFixed(1)}s
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const allPlaying = separatedAudio.stems.every(stem => playingStems.has(stem.id));
                if (allPlaying) {
                  setPlayingStems(new Set());
                } else {
                  setPlayingStems(new Set(separatedAudio.stems.map(stem => stem.id)));
                }
              }}
            >
              {separatedAudio.stems.every(stem => playingStems.has(stem.id)) ? (
                <>
                  <Pause className="w-4 h-4 mr-1" />
                  Stop All
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Play All
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Master Controls */}
        <Card className="glass-card-subtle">
          <CardHeader>
            <CardTitle className="text-base">Master Controls</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">Master Volume: {globalEffects.masterVolume}%</Label>
              <Slider
                value={[globalEffects.masterVolume]}
                onValueChange={([value]) => setGlobalEffects(prev => ({ ...prev, masterVolume: value }))}
                min={0}
                max={150}
                step={1}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Master Pan: {globalEffects.masterPan}</Label>
              <Slider
                value={[globalEffects.masterPan]}
                onValueChange={([value]) => setGlobalEffects(prev => ({ ...prev, masterPan: value }))}
                min={-100}
                max={100}
                step={1}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Room Size: {globalEffects.roomSize}%</Label>
              <Slider
                value={[globalEffects.roomSize]}
                onValueChange={([value]) => setGlobalEffects(prev => ({ ...prev, roomSize: value }))}
                min={0}
                max={100}
                step={1}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Ambience: {globalEffects.ambience}%</Label>
              <Slider
                value={[globalEffects.ambience]}
                onValueChange={([value]) => setGlobalEffects(prev => ({ ...prev, ambience: value }))}
                min={0}
                max={100}
                step={1}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Individual Stem Controls */}
        <div className="space-y-4">
          <h3 className="font-medium">Individual Stems</h3>
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
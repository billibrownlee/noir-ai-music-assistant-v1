import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  BarChart3,
  Volume2,
  Headphones,
  Filter,
  Mic2,
  Speaker,
  Zap,
  RotateCcw,
  Save,
  Download,
  Eye,
  Settings
} from 'lucide-react';

interface ChannelStrip {
  id: string;
  name: string;
  type: 'vocal' | 'instrument' | 'drums' | 'bass' | 'master';
  gain: number;
  lowEQ: number;
  midEQ: number;
  highEQ: number;
  compressor: {
    enabled: boolean;
    ratio: number;
    attack: number;
    release: number;
    threshold: number;
  };
  reverb: number;
  delay: number;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  isActive: boolean;
}

const INITIAL_CHANNELS: ChannelStrip[] = [
  {
    id: '1',
    name: 'Lead Vocal',
    type: 'vocal',
    gain: 0,
    lowEQ: 0,
    midEQ: 0,
    highEQ: 0,
    compressor: { enabled: true, ratio: 3, attack: 10, release: 100, threshold: -18 },
    reverb: 25,
    delay: 15,
    volume: 75,
    pan: 0,
    muted: false,
    soloed: false,
    isActive: true
  },
  {
    id: '2',
    name: 'Guitar',
    type: 'instrument',
    gain: 0,
    lowEQ: 2,
    midEQ: 1,
    highEQ: 3,
    compressor: { enabled: false, ratio: 2, attack: 5, release: 50, threshold: -12 },
    reverb: 35,
    delay: 0,
    volume: 70,
    pan: -30,
    muted: false,
    soloed: false,
    isActive: true
  },
  {
    id: '3',
    name: 'Drums',
    type: 'drums',
    gain: 0,
    lowEQ: 0,
    midEQ: -1,
    highEQ: 2,
    compressor: { enabled: true, ratio: 4, attack: 1, release: 30, threshold: -15 },
    reverb: 15,
    delay: 0,
    volume: 85,
    pan: 0,
    muted: false,
    soloed: false,
    isActive: true
  },
  {
    id: 'master',
    name: 'Master',
    type: 'master',
    gain: 0,
    lowEQ: 0,
    midEQ: 0,
    highEQ: 0,
    compressor: { enabled: true, ratio: 2, attack: 3, release: 100, threshold: -6 },
    reverb: 0,
    delay: 0,
    volume: 85,
    pan: 0,
    muted: false,
    soloed: false,
    isActive: true
  }
];

export const MixingConsole: React.FC = () => {
  const [channels, setChannels] = useState<ChannelStrip[]>(INITIAL_CHANNELS);
  const [selectedChannel, setSelectedChannel] = useState<string>('1');
  const [mixingMode, setMixingMode] = useState<'channels' | 'effects' | 'eq'>('channels');

  const updateChannel = (channelId: string, updates: Partial<ChannelStrip>) => {
    setChannels(prev => 
      prev.map(channel => 
        channel.id === channelId ? { ...channel, ...updates } : channel
      )
    );
  };

  const updateCompressor = (channelId: string, compressorUpdates: Partial<ChannelStrip['compressor']>) => {
    setChannels(prev => 
      prev.map(channel => 
        channel.id === channelId 
          ? { ...channel, compressor: { ...channel.compressor, ...compressorUpdates } }
          : channel
      )
    );
  };

  const resetChannel = (channelId: string) => {
    const defaultChannel = INITIAL_CHANNELS.find(c => c.id === channelId);
    if (defaultChannel) {
      updateChannel(channelId, defaultChannel);
    }
  };

  const getChannelColor = (type: string) => {
    const colors = {
      'vocal': 'border-primary',
      'instrument': 'border-neon-blue',
      'drums': 'border-neon-green',
      'bass': 'border-neon-orange',
      'master': 'border-yellow-500'
    };
    return colors[type as keyof typeof colors] || 'border-studio-border';
  };

  const ChannelStripComponent: React.FC<{ channel: ChannelStrip; isCompact?: boolean }> = ({ 
    channel, 
    isCompact = false 
  }) => (
    <Card className={`glass-card-subtle ${getChannelColor(channel.type)} border-2`}>
      <CardContent className="p-3 space-y-3">
        {/* Channel Header */}
        <div className="text-center">
          <h4 className="font-medium text-sm truncate">{channel.name}</h4>
          <Badge variant="outline" className="text-xs mt-1">
            {channel.type}
          </Badge>
        </div>

        {/* EQ Section */}
        <div className="space-y-2">
          <Label className="text-xs">EQ</Label>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs">High</span>
              <span className="text-xs text-studio-text-secondary">{channel.highEQ > 0 ? '+' : ''}{channel.highEQ}</span>
            </div>
            <Slider
              value={[channel.highEQ]}
              onValueChange={([value]) => updateChannel(channel.id, { highEQ: value })}
              min={-12}
              max={12}
              step={0.5}
              className="h-1"
            />
            
            <div className="flex items-center justify-between">
              <span className="text-xs">Mid</span>
              <span className="text-xs text-studio-text-secondary">{channel.midEQ > 0 ? '+' : ''}{channel.midEQ}</span>
            </div>
            <Slider
              value={[channel.midEQ]}
              onValueChange={([value]) => updateChannel(channel.id, { midEQ: value })}
              min={-12}
              max={12}
              step={0.5}
              className="h-1"
            />
            
            <div className="flex items-center justify-between">
              <span className="text-xs">Low</span>
              <span className="text-xs text-studio-text-secondary">{channel.lowEQ > 0 ? '+' : ''}{channel.lowEQ}</span>
            </div>
            <Slider
              value={[channel.lowEQ]}
              onValueChange={([value]) => updateChannel(channel.id, { lowEQ: value })}
              min={-12}
              max={12}
              step={0.5}
              className="h-1"
            />
          </div>
        </div>

        {/* Effects */}
        {channel.type !== 'master' && (
          <div className="space-y-2">
            <Label className="text-xs">Effects</Label>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs">Reverb</span>
                <span className="text-xs text-studio-text-secondary">{channel.reverb}%</span>
              </div>
              <Slider
                value={[channel.reverb]}
                onValueChange={([value]) => updateChannel(channel.id, { reverb: value })}
                min={0}
                max={100}
                step={1}
                className="h-1"
              />
              
              <div className="flex items-center justify-between">
                <span className="text-xs">Delay</span>
                <span className="text-xs text-studio-text-secondary">{channel.delay}%</span>
              </div>
              <Slider
                value={[channel.delay]}
                onValueChange={([value]) => updateChannel(channel.id, { delay: value })}
                min={0}
                max={100}
                step={1}
                className="h-1"
              />
            </div>
          </div>
        )}

        {/* Volume Fader */}
        <div className="space-y-2">
          <Label className="text-xs">Volume</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Slider
                value={[channel.volume]}
                onValueChange={([value]) => updateChannel(channel.id, { volume: value })}
                min={0}
                max={100}
                step={1}
                orientation="horizontal"
                className="h-1"
              />
            </div>
            <span className="text-xs text-studio-text-secondary w-8">
              {channel.volume}
            </span>
          </div>
        </div>

        {/* Pan */}
        <div className="space-y-2">
          <Label className="text-xs">Pan</Label>
          <Slider
            value={[channel.pan]}
            onValueChange={([value]) => updateChannel(channel.id, { pan: value })}
            min={-100}
            max={100}
            step={1}
            className="h-1"
          />
          <div className="text-center text-xs text-studio-text-secondary">
            {channel.pan > 0 ? 'R' : channel.pan < 0 ? 'L' : 'C'}{Math.abs(channel.pan)}
          </div>
        </div>

        {/* Mute/Solo Buttons */}
        <div className="flex gap-1">
          <Button
            variant={channel.muted ? "destructive" : "outline"}
            size="sm"
            onClick={() => updateChannel(channel.id, { muted: !channel.muted })}
            className="flex-1 text-xs py-1"
          >
            M
          </Button>
          <Button
            variant={channel.soloed ? "neon" : "outline"}
            size="sm"
            onClick={() => updateChannel(channel.id, { soloed: !channel.soloed })}
            className="flex-1 text-xs py-1"
          >
            S
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => resetChannel(channel.id)}
            className="flex-1 text-xs py-1"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const selectedChannelData = channels.find(c => c.id === selectedChannel);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-neon-blue" />
            Mixing Console
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Save className="w-4 h-4 mr-1" />
              Save Mix
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Coming Soon notice */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
          <span className="text-base">🚧</span>
          <span><strong>Coming Soon</strong> — audio routing is not yet wired. Controls are visual previews of the planned interface.</span>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-2">
          <Button
            variant={mixingMode === 'channels' ? 'neon' : 'outline'}
            size="sm"
            onClick={() => setMixingMode('channels')}
          >
            <Volume2 className="w-4 h-4 mr-1" />
            Channels
          </Button>
          <Button
            variant={mixingMode === 'effects' ? 'neon' : 'outline'}
            size="sm"
            onClick={() => setMixingMode('effects')}
          >
            <Zap className="w-4 h-4 mr-1" />
            Effects
          </Button>
          <Button
            variant={mixingMode === 'eq' ? 'neon' : 'outline'}
            size="sm"
            onClick={() => setMixingMode('eq')}
          >
            <Filter className="w-4 h-4 mr-1" />
            EQ
          </Button>
        </div>

        {mixingMode === 'channels' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {channels.map(channel => (
              <ChannelStripComponent key={channel.id} channel={channel} />
            ))}
          </div>
        )}

        {mixingMode === 'effects' && selectedChannelData && (
          <div className="space-y-6">
            <div>
              <Label>Select Channel for Effects</Label>
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {channels.filter(c => c.type !== 'master').map(channel => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Compressor */}
            <Card className="glass-card-subtle">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Compressor</span>
                  <Switch
                    checked={selectedChannelData.compressor.enabled}
                    onCheckedChange={(enabled) => updateCompressor(selectedChannel, { enabled })}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ratio: {selectedChannelData.compressor.ratio}:1</Label>
                  <Slider
                    value={[selectedChannelData.compressor.ratio]}
                    onValueChange={([value]) => updateCompressor(selectedChannel, { ratio: value })}
                    min={1}
                    max={10}
                    step={0.1}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Threshold: {selectedChannelData.compressor.threshold} dB</Label>
                  <Slider
                    value={[selectedChannelData.compressor.threshold]}
                    onValueChange={([value]) => updateCompressor(selectedChannel, { threshold: value })}
                    min={-40}
                    max={0}
                    step={1}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Attack: {selectedChannelData.compressor.attack} ms</Label>
                  <Slider
                    value={[selectedChannelData.compressor.attack]}
                    onValueChange={([value]) => updateCompressor(selectedChannel, { attack: value })}
                    min={0.1}
                    max={100}
                    step={0.1}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Release: {selectedChannelData.compressor.release} ms</Label>
                  <Slider
                    value={[selectedChannelData.compressor.release]}
                    onValueChange={([value]) => updateCompressor(selectedChannel, { release: value })}
                    min={1}
                    max={1000}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {mixingMode === 'eq' && (
          <div className="space-y-4">
            <div>
              <Label>Select Channel for EQ</Label>
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {channels.map(channel => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedChannelData && (
              <Card className="glass-card-subtle">
                <CardHeader>
                  <CardTitle className="text-base">
                    {selectedChannelData.name} - Equalizer
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Visual EQ representation would go here */}
                  <div className="h-32 bg-studio-surface-secondary rounded flex items-center justify-center">
                    <span className="text-studio-text-secondary">EQ Curve Visualization</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>High Frequency: {selectedChannelData.highEQ > 0 ? '+' : ''}{selectedChannelData.highEQ} dB</Label>
                      <Slider
                        value={[selectedChannelData.highEQ]}
                        onValueChange={([value]) => updateChannel(selectedChannel, { highEQ: value })}
                        min={-12}
                        max={12}
                        step={0.1}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Mid Frequency: {selectedChannelData.midEQ > 0 ? '+' : ''}{selectedChannelData.midEQ} dB</Label>
                      <Slider
                        value={[selectedChannelData.midEQ]}
                        onValueChange={([value]) => updateChannel(selectedChannel, { midEQ: value })}
                        min={-12}
                        max={12}
                        step={0.1}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Low Frequency: {selectedChannelData.lowEQ > 0 ? '+' : ''}{selectedChannelData.lowEQ} dB</Label>
                      <Slider
                        value={[selectedChannelData.lowEQ]}
                        onValueChange={([value]) => updateChannel(selectedChannel, { lowEQ: value })}
                        min={-12}
                        max={12}
                        step={0.1}
                        className="mt-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Master Section */}
        <Card className="glass-card-subtle border-yellow-500 border-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Speaker className="w-4 h-4" />
              Master Output
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label>Master Volume: {channels.find(c => c.id === 'master')?.volume}%</Label>
                <Slider
                  value={[channels.find(c => c.id === 'master')?.volume || 85]}
                  onValueChange={([value]) => updateChannel('master', { volume: value })}
                  min={0}
                  max={100}
                  step={1}
                  className="mt-2"
                />
              </div>
              <Button variant="neon" size="sm">
                <Headphones className="w-4 h-4 mr-1" />
                Monitor
              </Button>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};
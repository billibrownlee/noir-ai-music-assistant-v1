import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Music, Volume2, Download, Play, Pause, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGlobalAudio } from '@/hooks/useGlobalAudio';
import { supabase } from '@/integrations/supabase/client';

interface GeneratedAudio {
  id: string;
  text: string;
  voice: string;
  model: string;
  audioUrl: string;
  duration?: number;
  timestamp: Date;
}

interface AudioGeneratorProps {
  onAudioGenerated?: (audio: GeneratedAudio) => void;
}

export const AudioGenerator: React.FC<AudioGeneratorProps> = ({ onAudioGenerated }) => {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('nova');
  const [model, setModel] = useState('tts-1-hd');
  const [speed, setSpeed] = useState([1.0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudios, setGeneratedAudios] = useState<GeneratedAudio[]>([]);
  const { toast } = useToast();
  const { currentTrack, isPlaying, playTrack } = useGlobalAudio();

  const voices = [
    { value: 'nova', label: 'Nova (Warm Female)', description: 'Warm and engaging female voice' },
    { value: 'alloy', label: 'Alloy (Neutral)', description: 'Balanced and versatile voice' },
    { value: 'echo', label: 'Echo (Deep Male)', description: 'Rich and resonant male voice' },
    { value: 'fable', label: 'Fable (Expressive)', description: 'Dynamic and expressive voice' },
    { value: 'onyx', label: 'Onyx (Authoritative Male)', description: 'Strong and commanding voice' },
    { value: 'shimmer', label: 'Shimmer (Bright Female)', description: 'Clear and bright female voice' }
  ];

  const models = [
    { value: 'tts-1-hd', label: 'TTS-1-HD (Highest Quality)', description: 'Maximum quality, slower generation' },
    { value: 'tts-1', label: 'TTS-1 (Standard)', description: 'Good quality, faster generation' }
  ];

  const generateAudio = async () => {
    if (!text.trim()) {
      toast({
        title: "Text required",
        description: "Please enter some text to generate audio.",
        variant: "destructive"
      });
      return;
    }

    if (text.length > 4000) {
      toast({
        title: "Text too long",
        description: "Text must be under 4000 characters.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    console.log('🎤 Starting high-quality audio generation...');

    try {
      const { data, error } = await supabase.functions.invoke('generate-audio', {
        body: {
          text: text.trim(),
          voice,
          model,
          speed: speed[0]
        }
      });

      if (error) {
        console.error('❌ Supabase function error:', error);
        throw error;
      }

      if (!data?.audioContent) {
        throw new Error('No audio content received');
      }

      // Convert base64 to blob URL
      const binaryString = atob(data.audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      const generatedAudio: GeneratedAudio = {
        id: crypto.randomUUID(),
        text: text.trim(),
        voice,
        model,
        audioUrl,
        timestamp: new Date()
      };

      setGeneratedAudios(prev => [generatedAudio, ...prev]);
      
      // Clear text for next generation
      setText('');

      console.log('✅ High-quality audio generated successfully!');
      toast({
        title: "🎤 Audio Generated!",
        description: `High-quality ${voice} voice generated using ${model}`,
      });

      // Callback for parent component
      if (onAudioGenerated) {
        onAudioGenerated(generatedAudio);
      }

    } catch (error) {
      console.error('❌ Audio generation failed:', error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate audio. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const playGeneratedAudio = async (audio: GeneratedAudio) => {
    await playTrack({
      id: audio.id,
      name: `Generated: ${audio.text.substring(0, 30)}...`,
      audioUrl: audio.audioUrl
    });
  };

  const downloadAudio = (audio: GeneratedAudio) => {
    const link = document.createElement('a');
    link.href = audio.audioUrl;
    link.download = `generated_audio_${audio.voice}_${Date.now()}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedVoice = voices.find(v => v.value === voice);
  const selectedModel = models.find(m => m.value === model);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          AI Audio Generator
          <Badge variant="secondary">OpenAI TTS-HD</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Text Input */}
        <div className="space-y-2">
          <Label htmlFor="text-input">Text to Speech ({text.length}/4000)</Label>
          <Textarea
            id="text-input"
            placeholder="Enter the text you want to convert to high-quality speech..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        {/* Voice Selection */}
        <div className="space-y-2">
          <Label>Voice Selection</Label>
          <Select value={voice} onValueChange={setVoice}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {voices.map(v => (
                <SelectItem key={v.value} value={v.value}>
                  <div className="space-y-1">
                    <div className="font-medium">{v.label}</div>
                    <div className="text-xs text-muted-foreground">{v.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedVoice && (
            <p className="text-sm text-muted-foreground">{selectedVoice.description}</p>
          )}
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <Label>Quality Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map(m => (
                <SelectItem key={m.value} value={m.value}>
                  <div className="space-y-1">
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedModel && (
            <p className="text-sm text-muted-foreground">{selectedModel.description}</p>
          )}
        </div>

        {/* Speed Control */}
        <div className="space-y-2">
          <Label>Speech Speed: {speed[0].toFixed(1)}x</Label>
          <Slider
            value={speed}
            onValueChange={setSpeed}
            min={0.25}
            max={4.0}
            step={0.25}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0.25x (Slow)</span>
            <span>1.0x (Normal)</span>
            <span>4.0x (Fast)</span>
          </div>
        </div>

        {/* Generate Button */}
        <Button 
          onClick={generateAudio} 
          disabled={isGenerating || !text.trim()}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Volume2 className="w-4 h-4 mr-2 animate-pulse" />
              Generating High-Quality Audio...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Audio
            </>
          )}
        </Button>

        {/* Generated Audio List */}
        {generatedAudios.length > 0 && (
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Music className="w-4 h-4" />
              Generated Audio ({generatedAudios.length})
            </h3>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {generatedAudios.map((audio) => (
                <div key={audio.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {audio.voice} • {audio.model}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {audio.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {audio.text}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => playGeneratedAudio(audio)}
                      className="flex-1"
                    >
                      {currentTrack?.id === audio.id && isPlaying ? (
                        <Pause className="w-3 h-3 mr-1" />
                      ) : (
                        <Play className="w-3 h-3 mr-1" />
                      )}
                      Play
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadAudio(audio)}
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
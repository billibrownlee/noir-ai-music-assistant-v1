import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Pause, Download, Sparkles, Music, Mic2, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGlobalAudio } from "@/hooks/useGlobalAudio";
import { supabase } from "@/integrations/supabase/client";

interface PromptBuilderProps {
  onGenerate: (prompt: string, settings: any) => void;
}

const GENRE_TEMPLATES = {
  rnb: {
    name: "R&B",
    icon: "🎵",
    description: "Smooth vocals, rich harmonies, groove-based rhythms",
    prompts: [
      "Soulful R&B ballad with silky vocals and lush harmonies",
      "Upbeat contemporary R&B with crisp drums and bass groove",
      "Intimate slow jam with emotional vocal runs and piano"
    ],
    settings: { bpm: [65, 85], key: "major", mood: "romantic" }
  },
  pop: {
    name: "Pop",
    icon: "✨",
    description: "Catchy melodies, modern production, radio-ready",
    prompts: [
      "Infectious pop anthem with soaring chorus and modern production",
      "Dreamy pop ballad with ethereal vocals and ambient textures",
      "Dance-pop banger with punchy beats and catchy hooks"
    ],
    settings: { bpm: [90, 130], key: "major", mood: "uplifting" }
  },
  trap: {
    name: "Trap-Rap",
    icon: "🔥",
    description: "Hard-hitting 808s, crisp hi-hats, aggressive energy",
    prompts: [
      "Dark trap beat with rolling 808s and crisp snares",
      "Melodic trap with atmospheric pads and vocal chops",
      "Hard trap anthem with aggressive drums and bass"
    ],
    settings: { bpm: [140, 180], key: "minor", mood: "aggressive" }
  }
};

export default function PromptBuilder({ onGenerate }: PromptBuilderProps) {
  const [selectedGenre, setSelectedGenre] = useState("rnb");
  const [customPrompt, setCustomPrompt] = useState("");
  const [settings, setSettings] = useState({
    bpm: [120],
    key: "C",
    mood: "energetic",
    vocals: "lead",
    duration: 180,
    instruments: []
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const { toast } = useToast();
  const { playTrack } = useGlobalAudio();

  const handleGenerate = async () => {
    setIsGenerating(true);
    const template = GENRE_TEMPLATES[selectedGenre as keyof typeof GENRE_TEMPLATES];
    const fullPrompt = customPrompt || template.prompts[0];
    
    // Simulate generation
    setTimeout(() => {
      onGenerate(fullPrompt, { ...settings, genre: selectedGenre });
      setIsGenerating(false);
    }, 3000);
  };

  const handleVoicePreview = async () => {
    const textToSpeak = customPrompt || GENRE_TEMPLATES[selectedGenre as keyof typeof GENRE_TEMPLATES].prompts[0];
    
    if (!textToSpeak.trim()) {
      toast({
        title: "No text to speak",
        description: "Please enter a prompt first.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingVoice(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-audio', {
        body: {
          text: textToSpeak.trim(),
          voice: 'nova',
          model: 'tts-1',
          speed: 1.0
        }
      });

      if (error) throw error;
      if (!data?.audioContent) throw new Error('No audio content received');

      // Convert base64 to blob URL
      const binaryString = atob(data.audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      await playTrack({
        id: `prompt-${Date.now()}`,
        name: 'Prompt Preview',
        audioUrl
      });

      toast({
        title: "🎤 Playing prompt",
        description: "Listen to your prompt being spoken aloud",
      });

    } catch (error) {
      console.error('Voice generation failed:', error);
      toast({
        title: "Voice generation failed",
        description: error.message || "Failed to generate voice. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  return (
    <Card className="bg-gradient-glass backdrop-blur-md border-border/50 p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">AI Prompt Builder</h2>
            <p className="text-muted-foreground">Create professional music with advanced AI prompts</p>
          </div>
        </div>

        {/* Genre Selection */}
        <Tabs value={selectedGenre} onValueChange={setSelectedGenre}>
          <TabsList className="grid w-full grid-cols-3 bg-secondary/50">
            {Object.entries(GENRE_TEMPLATES).map(([key, genre]) => (
              <TabsTrigger 
                key={key} 
                value={key}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <span className="mr-2">{genre.icon}</span>
                {genre.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(GENRE_TEMPLATES).map(([key, genre]) => (
            <TabsContent key={key} value={key} className="mt-4">
              <Card className="bg-secondary/30 border-border/30 p-4">
                <p className="text-sm text-muted-foreground mb-3">{genre.description}</p>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Template Prompts:</label>
                  {genre.prompts.map((prompt, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="w-full text-left justify-start h-auto p-3"
                      onClick={() => setCustomPrompt(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Custom Prompt */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">Custom Prompt</label>
          <Textarea
            placeholder="Describe your music in detail... (e.g., 'Emotional R&B ballad with gospel influences, soulful vocals, rich piano chords, and smooth bass line')"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="min-h-24 bg-input/50 border-border/50 focus:border-primary"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Professional Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* BPM */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">BPM</label>
              <Badge variant="secondary">{settings.bpm[0]}</Badge>
            </div>
            <Slider
              value={settings.bpm}
              onValueChange={(value) => setSettings({...settings, bpm: value})}
              max={200}
              min={60}
              step={5}
              className="w-full"
            />
          </div>

          {/* Duration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Duration</label>
              <Badge variant="secondary">{Math.floor(settings.duration / 60)}:{(settings.duration % 60).toString().padStart(2, '0')}</Badge>
            </div>
            <Slider
              value={[settings.duration]}
              onValueChange={(value) => setSettings({...settings, duration: value[0]})}
              max={300}
              min={30}
              step={15}
              className="w-full"
            />
          </div>

          {/* Key */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Key</label>
            <Select value={settings.key} onValueChange={(value) => setSettings({...settings, key: value})}>
              <SelectTrigger className="bg-input/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(key => (
                  <SelectItem key={key} value={key}>{key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vocals */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Vocals</label>
            <Select value={settings.vocals} onValueChange={(value) => setSettings({...settings, vocals: value})}>
              <SelectTrigger className="bg-input/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="lead">Lead Vocals</SelectItem>
                <SelectItem value="harmony">Vocal Harmonies</SelectItem>
                <SelectItem value="choir">Vocal Choir</SelectItem>
                <SelectItem value="instrumental">Instrumental Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Generate Button */}
        <Button 
          onClick={handleGenerate}
          disabled={isGenerating || (!customPrompt && !selectedGenre)}
          className="w-full"
          variant="studio"
          size="lg"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              Generating Music...
            </>
          ) : (
            <>
              <Music className="w-4 h-4" />
              Generate AI Music
            </>
          )}
        </Button>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={handleVoicePreview}
            disabled={isGeneratingVoice || (!customPrompt && !selectedGenre)}
          >
            {isGeneratingVoice ? (
              <>
                <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                Speaking...
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                Speak Prompt
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <Mic2 className="w-4 h-4" />
            Voice Input
          </Button>
        </div>
      </div>
    </Card>
  );
}
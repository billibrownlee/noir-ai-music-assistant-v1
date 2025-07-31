import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AudioProcessor, AudioProcessingResult } from '@/lib/audioProcessor';
import { RealtimeChat, RealtimeMessage } from '@/utils/RealtimeAudio';
import { 
  Send, 
  Brain, 
  User, 
  Volume2, 
  Layers, 
  Zap, 
  Music, 
  Wand2,
  Mic2,
  Headphones,
  Play,
  Pause,
  RotateCcw,
  Cog,
  Download,
  Phone,
  PhoneOff,
  Sparkles
} from 'lucide-react';
import { AudioAnalysis } from '@/lib/audioAnalyzer';
import { SeparatedAudio } from '@/lib/audioSeparation';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioContext?: {
    stems?: string[];
    technique?: string;
    parameters?: Record<string, any>;
    processingTime?: number;
  };
}

interface AIChatAssistantProps {
  audioAnalysis?: AudioAnalysis;
  separatedAudio?: SeparatedAudio;
  onApplyEffect?: (effect: string, parameters: any) => void;
  uploadedSamples?: any[];
  onUpdateSample?: (sampleId: string, updates: any) => void;
}

const AI_RESPONSES = {
  greeting: "👋 Hey! I'm Lando, your AI production assistant. I can help you manipulate your audio stems, suggest mixing techniques, and guide you through the production process. What would you like to work on?",
  
  stems: {
    vocals: "🎤 Great choice! For vocals, I recommend:\n• High-pass filter at 80-100Hz to remove rumble\n• Gentle compression (3:1 ratio, slow attack)\n• EQ boost around 2-5kHz for presence\n• Add some reverb for space. Want me to apply any of these?",
    
    drums: "🥁 Let's make those drums punch! Try:\n• Compress the kick with fast attack for punch\n• Gate the snare to tighten it up\n• High-pass the hi-hats above 8kHz\n• Parallel compression on the drum bus for glue",
    
    bass: "🎸 Bass foundation is key! Here's what I suggest:\n• Low-pass filter around 200Hz to focus the low end\n• Compress with medium attack to preserve transients\n• Boost around 60-80Hz for weight\n• Cut around 500Hz to avoid muddiness",
    
    melody: "🎹 For your melody elements:\n• Add some stereo width with subtle chorus\n• EQ to sit in the mix (cut competing frequencies)\n• Layer with reverb for depth\n• Consider doubling in different octaves"
  },
  
  techniques: {
    separation: "🔄 I've analyzed your track and separated it into stems:\n• Vocals: Clean vocal content\n• Drums: Kick, snare, and percussion\n• Bass: Low-end foundation\n• Melody: Harmonic content\n\nEach stem can now be processed independently!",
    
    mixing: "🎛️ Mixing tips for your track:\n• Start with levels and panning\n• Use EQ to create space for each element\n• Add compression for control and character\n• Effects should enhance, not mask the original sound",
    
    mastering: "🎚️ For the final polish:\n• Gentle multiband compression\n• EQ for tonal balance\n• Limiting for loudness (but preserve dynamics!)\n• Check your mix on different speakers"
  }
};

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({ 
  audioAnalysis, 
  separatedAudio,
  onApplyEffect,
  uploadedSamples = [],
  onUpdateSample 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: AI_RESPONSES.greeting,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Realtime voice chat state
  const [realtimeChat, setRealtimeChat] = useState<RealtimeChat | null>(null);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('nova');
  const [realtimeMessages, setRealtimeMessages] = useState<RealtimeMessage[]>([]);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const audioProcessor = useRef(new AudioProcessor());

  const voices = [
    { value: 'nova', label: 'Nova (Warm Female)' },
    { value: 'alloy', label: 'Alloy (Neutral)' },
    { value: 'echo', label: 'Echo (Deep Male)' },
    { value: 'sage', label: 'Sage (Wise)' },
    { value: 'shimmer', label: 'Shimmer (Bright)' },
    { value: 'coral', label: 'Coral (Friendly)' },
    { value: 'ballad', label: 'Ballad (Smooth)' },
    { value: 'verse', label: 'Verse (Clear)' }
  ];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Respond when separated audio is available
  useEffect(() => {
    if (separatedAudio && messages.length === 1) {
      setTimeout(() => {
        addAssistantMessage(AI_RESPONSES.techniques.separation);
      }, 1000);
    }
  }, [separatedAudio]);

  const addAssistantMessage = (content: string, audioContext?: ChatMessage['audioContext']) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'assistant',
      content,
      timestamp: new Date(),
      audioContext
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const generateAIResponse = async (userMessage: string): Promise<string> => {
    const msg = userMessage.toLowerCase();
    
    // Check for audio processing commands
    if (await handleAudioProcessingCommand(msg)) {
      return ""; // Response handled by processing function
    }

    // Check current audio state for contextual responses
    const currentSample = uploadedSamples[uploadedSamples.length - 1];
    const hasProcessedAudio = currentSample?.tags?.includes('processed') || currentSample?.tags?.includes('tempo-adjusted');
    
    if (hasProcessedAudio && (msg.includes('more') || msg.includes('further') || msg.includes('continue') || msg.includes('also'))) {
      return `🎛️ **Ready for more editing!**\n\nYour current sample: **${currentSample.name}**\n\n✨ **Available commands:**\n• "reverse the audio" - flip it backwards\n• "add distortion" - add grit and character\n• "normalize the volume" - balance the levels\n• "speed up by 1.5x" or "slow down" - adjust playback speed\n• "fade in" or "fade out" - smooth transitions\n\n💡 **Pro tip**: You can chain multiple effects! Try "add distortion then normalize"`;
    }
    
    
    // Stem-specific responses
    if (msg.includes('vocal') || msg.includes('voice') || msg.includes('sing')) {
      return AI_RESPONSES.stems.vocals;
    }
    if (msg.includes('drum') || msg.includes('kick') || msg.includes('snare') || msg.includes('hat')) {
      return AI_RESPONSES.stems.drums;
    }
    if (msg.includes('bass') || msg.includes('low end') || msg.includes('sub')) {
      return AI_RESPONSES.stems.bass;
    }
    if (msg.includes('melody') || msg.includes('lead') || msg.includes('harmony')) {
      return AI_RESPONSES.stems.melody;
    }
    
    // Technique-specific responses
    if (msg.includes('mix') || msg.includes('balance')) {
      return AI_RESPONSES.techniques.mixing;
    }
    if (msg.includes('master') || msg.includes('loud') || msg.includes('final')) {
      return AI_RESPONSES.techniques.mastering;
    }
    if (msg.includes('separate') || msg.includes('stem') || msg.includes('isolate')) {
      return AI_RESPONSES.techniques.separation;
    }
    
    // EQ and effects
    if (msg.includes('eq') || msg.includes('frequency')) {
      return "🎛️ EQ is powerful! Here's my approach:\n• High-pass to remove unnecessary low frequencies\n• Cut problem frequencies\n• Boost to enhance character\n• Always use your ears, not just your eyes on the analyzer!";
    }
    if (msg.includes('compress') || msg.includes('dynamic')) {
      return "🔧 Compression tips:\n• Use attack time to shape transients\n• Release time affects groove and pumping\n• Ratio controls how aggressive the compression is\n• Makeup gain to match levels after compression";
    }
    if (msg.includes('reverb') || msg.includes('space') || msg.includes('depth')) {
      return "🌊 Reverb creates space:\n• Pre-delay to separate the reverb from the dry signal\n• High-cut to avoid muddy reverb tails\n• Different reverb types for different sounds\n• Less is often more!";
    }
    
    // Analysis-based responses
    if (audioAnalysis) {
      if (msg.includes('tempo') || msg.includes('bpm')) {
        return `🎵 Your track is ${audioAnalysis.tempo} BPM. This tempo works great for ${audioAnalysis.tempo < 100 ? 'intimate, emotional content' : audioAnalysis.tempo > 130 ? 'energetic, danceable vibes' : 'versatile, mid-tempo grooves'}. Want suggestions for complementary elements?`;
      }
      if (msg.includes('key') || msg.includes('pitch')) {
        return `🎹 You're in ${audioAnalysis.key} ${audioAnalysis.mode}. This ${audioAnalysis.mode === 'minor' ? 'minor key has a emotional, introspective quality' : 'major key has a bright, uplifting character'}. Perfect for ${audioAnalysis.mode === 'minor' ? 'adding lush pads or strings' : 'bright leads and uplifting elements'}.`;
      }
    }
    
    // General production advice
    if (msg.includes('help') || msg.includes('how') || msg.includes('what')) {
      const currentSample = uploadedSamples[uploadedSamples.length - 1];
      const processingHistory = currentSample?.processHistory?.length > 0 
        ? `\n\n📜 **Current Sample History**: ${currentSample.processHistory.map(h => h.effect).join(' → ')}`
        : '';
      
      return "🎯 I can help with:\n• **Audio Processing**: reverse, speed up/slow down, change tempo, normalize, add distortion\n• **Stem manipulation** and processing\n• **Mixing and mastering** techniques\n• **EQ, compression, and effects** guidance\n• **Creative production** ideas\n\n💡 **Try saying**: \"slow the tempo down\", \"speed up by 1.5x\", \"reverse the audio\", \"normalize the volume\", \"add distortion\"" + processingHistory;
    }
    
    // Default creative response
    const creativeSuggestions = [
      "🎨 Try layering your stems with different effects - each one tells a different part of the story!",
      "⚡ Experiment with automation! Move those faders and knobs to create dynamic interest.",
      "🔄 Consider reversing some elements for creative transitions and buildup effects.",
      "🎭 Use stereo imaging to create width - but keep low frequencies centered!",
      "🌟 Don't forget the power of silence - sometimes what you take away is more important than what you add.",
      "🎛️ **Try audio processing commands!** Say 'reverse the audio', 'speed up 2x', 'normalize', or 'add distortion'"
    ];
    
    return creativeSuggestions[Math.floor(Math.random() * creativeSuggestions.length)];
  };

  // Handle audio processing commands
  const handleAudioProcessingCommand = async (msg: string): Promise<boolean> => {
    if (uploadedSamples.length === 0) {
      if (msg.includes('reverse') || msg.includes('speed') || msg.includes('normalize') || msg.includes('distortion') || msg.includes('tempo')) {
        addAssistantMessage("❌ No audio uploaded yet! Please upload an audio file first before I can process it.");
        return true;
      }
      return false;
    }

    const latestSample = uploadedSamples[uploadedSamples.length - 1];
    if (!latestSample || !latestSample.file) {
      return false;
    }

    // Check if this is a processed sample and inform user
    const isProcessed = latestSample.tags?.includes('processed') || latestSample.tags?.includes('tempo-adjusted');
    if (isProcessed) {
      console.log(`🎵 Processing further edits on: ${latestSample.name}`);
    }

    setIsProcessing(true);
    let result: AudioProcessingResult | null = null;
    let processingDescription = "";

    try {
      // Reverse audio
      if (msg.includes('reverse')) {
        processingDescription = "Reversing your audio...";
        addAssistantMessage(`🔄 ${processingDescription}`);
        result = await audioProcessor.current.reverseAudio(latestSample.file);
      }
      
      // Speed/Tempo change
      else if (msg.includes('speed') || msg.includes('slow') || msg.includes('fast') || msg.includes('tempo')) {
        let speedFactor = 1;
        
        // Extract speed factor from message
        const speedMatch = msg.match(/(\d*\.?\d+)x?/);
        if (speedMatch) {
          speedFactor = parseFloat(speedMatch[1]);
        } else if (msg.includes('slow') || (msg.includes('tempo') && msg.includes('down'))) {
          speedFactor = 0.75; // More subtle tempo change
        } else if (msg.includes('fast') || (msg.includes('tempo') && msg.includes('up'))) {
          speedFactor = 1.25; // More subtle tempo change
        }
        
        const tempoDesc = speedFactor < 1 ? `slowing tempo down to ${speedFactor}x` : `speeding tempo up to ${speedFactor}x`;
        processingDescription = `Changing tempo: ${tempoDesc}...`;
        addAssistantMessage(`🎛️ ${processingDescription}`);
        result = await audioProcessor.current.changeSpeed(latestSample.file, speedFactor);
      }
      
      // Normalize
      else if (msg.includes('normalize') || msg.includes('loud')) {
        processingDescription = "Normalizing volume...";
        addAssistantMessage(`📈 ${processingDescription}`);
        result = await audioProcessor.current.normalizeAudio(latestSample.file);
      }
      
      // Add distortion
      else if (msg.includes('distortion') || msg.includes('distort')) {
        let amount = 0.5;
        const amountMatch = msg.match(/(\d+)%/);
        if (amountMatch) {
          amount = parseInt(amountMatch[1]) / 100;
        }
        
        processingDescription = `Adding ${Math.round(amount * 100)}% distortion...`;
        addAssistantMessage(`🎸 ${processingDescription}`);
        result = await audioProcessor.current.addDistortion(latestSample.file, amount);
      }
      
      // Fade in/out
      else if (msg.includes('fade')) {
        const fadeIn = msg.includes('fade in') ? 2 : 0;
        const fadeOut = msg.includes('fade out') ? 2 : 0;
        
        processingDescription = `Applying fade effects...`;
        addAssistantMessage(`🎚️ ${processingDescription}`);
        result = await audioProcessor.current.applyFade(latestSample.file, fadeIn, fadeOut);
      }

      // Process result
      if (result) {
        if (result.success && result.processedAudioUrl) {
          // Update the sample with processed audio
          const processedSample = {
            ...latestSample,
            audioUrl: result.processedAudioUrl,
            name: `${latestSample.name.replace(' (Processed)', '').replace(/\s*\(\d+\s*BPM\)/, '')} (Processed)`,
            tags: [...(latestSample.tags || []), 'processed'],
            processHistory: [
              ...(latestSample.processHistory || []),
              {
                effect: processingDescription.replace('...', ''),
                timestamp: new Date(),
                processingTime: result.processingTime
              }
            ]
          };
          
          onUpdateSample?.(latestSample.id, processedSample);
          
          const historyText = processedSample.processHistory?.length > 1 
            ? `\n📜 **Processing History**: ${processedSample.processHistory.map(h => h.effect).join(' → ')}`
            : '';
          
          addAssistantMessage(
            `✅ **Processing Complete!**\n\n` +
            `🎵 Applied: ${processingDescription.replace('...', '')}\n` +
            `⏱️ Processing time: ${result.processingTime}ms\n` +
            `🎧 **Your processed audio is ready to play!**${historyText}\n\n` +
            `💡 **Want to do more?** Try: "add distortion", "reverse it", "normalize volume", or "slow it down"`
          );
          
          toast({
            title: "🎛️ Audio Processing Complete!",
            description: `Successfully processed your audio in ${result.processingTime}ms`,
          });
          
        } else {
          addAssistantMessage(`❌ **Processing Failed**\n\nError: ${result.error}\nPlease try again or upload a different audio file.`);
          
          toast({
            title: "Processing Failed",
            description: result.error || "Unknown error occurred",
            variant: "destructive"
          });
        }
        
        setIsProcessing(false);
        return true;
      }
      
    } catch (error) {
      console.error('Audio processing error:', error);
      addAssistantMessage(`❌ **Processing Error**\n\nSomething went wrong while processing your audio. Please try again.`);
      
      toast({
        title: "Processing Error",
        description: "Failed to process audio",
        variant: "destructive"
      });
    }
    
    setIsProcessing(false);
    return false;
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Store the current input for processing
    const currentInput = inputMessage;
    
    // Clear input immediately so user can continue typing
    setInputMessage('');
    
    // Focus input for immediate typing
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    
    // Show typing indicator only for AI responses (not processing)
    if (!currentInput.toLowerCase().includes('reverse') && 
        !currentInput.toLowerCase().includes('speed') && 
        !currentInput.toLowerCase().includes('tempo') && 
        !currentInput.toLowerCase().includes('normalize') && 
        !currentInput.toLowerCase().includes('distortion')) {
      setIsTyping(true);
    }

    // Generate AI response after a delay
    setTimeout(async () => {
      const response = await generateAIResponse(currentInput);
      if (response) { // Only add response if it's not empty (processing commands return empty)
        addAssistantMessage(response);
      }
      setIsTyping(false);
    }, 800 + Math.random() * 400); // Shorter delay for faster interaction
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Realtime voice chat functions
  const startVoiceChat = async () => {
    try {
      setIsConnecting(true);
      
      const chat = new RealtimeChat(
        (message: RealtimeMessage) => {
          console.log('📨 Realtime message:', message);
          setRealtimeMessages(prev => [...prev, message]);
        },
        (status) => {
          console.log('📡 Connection status:', status);
          setIsVoiceConnected(status === 'connected');
          setIsConnecting(status === 'connecting');
        },
        (speaking) => {
          setIsSpeaking(speaking);
        }
      );
      
      const instructions = `You are Lando, an expert AI music production assistant. You help users with audio production, mixing, mastering, and creative guidance. 

Current context:
- User has ${uploadedSamples.length} audio samples uploaded
- ${audioAnalysis ? `Current track: ${audioAnalysis.tempo} BPM in ${audioAnalysis.key}` : 'No audio analysis available'}
- ${separatedAudio ? `Audio stems available: ${separatedAudio.stems.map(s => s.name).join(', ')}` : 'No separated audio available'}

Be conversational, helpful, and provide specific production advice. You can use your function tools to help analyze audio files, suggest chord progressions, and provide mixing advice.`;

      await chat.init(selectedVoice, instructions);
      setRealtimeChat(chat);
      
      toast({
        title: "🎤 Voice Chat Connected!",
        description: `High-quality realtime conversation with ${voices.find(v => v.value === selectedVoice)?.label}`,
      });
      
    } catch (error) {
      console.error('❌ Voice chat connection failed:', error);
      setIsConnecting(false);
      setIsVoiceConnected(false);
      
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : 'Failed to start voice chat',
        variant: "destructive",
      });
    }
  };

  const endVoiceChat = () => {
    if (realtimeChat) {
      realtimeChat.disconnect();
      setRealtimeChat(null);
      setIsVoiceConnected(false);
      setIsConnecting(false);
      setIsSpeaking(false);
      setRealtimeMessages([]);
      
      toast({
        title: "Voice Chat Ended",
        description: "Disconnected from realtime voice conversation",
      });
    }
  };

  const sendVoiceMessage = async () => {
    if (!inputMessage.trim() || !realtimeChat) return;
    
    try {
      await realtimeChat.sendMessage(inputMessage);
      setInputMessage('');
    } catch (error) {
      console.error('❌ Failed to send voice message:', error);
      toast({
        title: "Send Failed",
        description: "Failed to send message in voice chat",
        variant: "destructive",
      });
    }
  };

  const clearChat = () => {
    setMessages([{
      id: '1',
      type: 'assistant',
      content: AI_RESPONSES.greeting,
      timestamp: new Date()
    }]);
  };

  return (
    <Card className="glass-card h-full flex flex-col min-h-[600px]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-neon-purple" />
            Lando AI Chat
            <Badge variant="outline" className="text-xs">
              Production Assistant
            </Badge>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearChat}
            className="text-studio-text-secondary hover:text-studio-text-primary"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </CardTitle>
        
        {/* Context Info */}
        {(audioAnalysis || separatedAudio) && (
          <div className="flex flex-wrap gap-2">
            {audioAnalysis && (
              <Badge variant="outline" className="text-xs">
                <Music className="w-3 h-3 mr-1" />
                Analyzed: {audioAnalysis.tempo} BPM
              </Badge>
            )}
            {separatedAudio && (
              <Badge variant="outline" className="text-xs">
                <Layers className="w-3 h-3 mr-1" />
                {separatedAudio.stems.length} Stems
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Chat Messages */}
        <ScrollArea className="flex-1 px-4 min-h-[400px]" ref={scrollAreaRef}>
          <div className="space-y-4 pb-4">
            {messages.map(message => (
              <div key={message.id} className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className={message.type === 'user' ? 'bg-neon-blue text-black' : 'bg-neon-purple text-black'}>
                    {message.type === 'user' ? <User className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                
                <div className={`max-w-[80%] ${message.type === 'user' ? 'text-right' : ''}`}>
                  <div className={`rounded-lg p-3 ${
                    message.type === 'user' 
                      ? 'bg-neon-blue/20 text-studio-text-primary ml-auto' 
                      : 'bg-studio-surface-secondary/50 text-studio-text-primary'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {message.content}
                    </p>
                    
                    {/* Audio Context Info */}
                    {message.audioContext && (
                      <div className="mt-2 pt-2 border-t border-studio-border/50">
                        <div className="flex gap-2 flex-wrap">
                          {message.audioContext.stems?.map((stem, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {stem}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-studio-text-secondary mt-1 px-1">
                    {message.type === 'assistant' ? 'Lando' : 'You'} • {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {(isTyping || isProcessing) && (
              <div className="flex gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-neon-purple text-black">
                    <Brain className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-studio-surface-secondary/50 rounded-lg p-3">
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 bg-neon-purple rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-neon-purple rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-neon-purple rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    {isProcessing && (
                      <span className="ml-2 text-xs text-neon-orange">Processing audio...</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Voice Chat Section */}
        <div className="p-4 border-t border-studio-border/30 bg-studio-surface/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-neon-purple" />
              <span className="text-sm font-medium text-studio-text-primary">High-Quality Voice Chat</span>
              <Badge variant={isVoiceConnected ? "default" : "outline"} className="text-xs">
                {isVoiceConnected ? "Connected" : isConnecting ? "Connecting..." : "Offline"}
              </Badge>
              {isSpeaking && (
                <Badge variant="secondary" className="text-xs animate-pulse">
                  🎤 Speaking
                </Badge>
              )}
            </div>
            
            {/* Voice Selection */}
            <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={isVoiceConnected}>
              <SelectTrigger className="w-40 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {voices.map(voice => (
                  <SelectItem key={voice.value} value={voice.value}>
                    {voice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Voice Chat Controls */}
          <div className="flex gap-2 mb-3">
            {!isVoiceConnected ? (
              <Button 
                onClick={startVoiceChat}
                disabled={isConnecting}
                className="flex-1 bg-neon-purple hover:bg-neon-purple/80"
              >
                <Phone className="w-4 h-4 mr-2" />
                {isConnecting ? "Connecting..." : "Start Voice Chat"}
              </Button>
            ) : (
              <>
                <Button 
                  onClick={endVoiceChat}
                  variant="destructive"
                  className="flex-1"
                >
                  <PhoneOff className="w-4 h-4 mr-2" />
                  End Voice Chat
                </Button>
                <Button 
                  onClick={sendVoiceMessage}
                  disabled={!inputMessage.trim()}
                  variant="outline"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>

          {/* Realtime Messages Display */}
          {realtimeMessages.length > 0 && (
            <div className="mb-3 p-2 bg-studio-surface-secondary/30 rounded border max-h-20 overflow-y-auto">
              <div className="text-xs text-studio-text-secondary mb-1">Live Transcript:</div>
              {realtimeMessages.slice(-3).map((msg, idx) => (
                <div key={idx} className="text-xs text-studio-text-primary">
                  <span className="font-medium">
                    {msg.role === 'user' ? 'You' : 'Lando'}:
                  </span>
                  {' '}
                  {msg.content}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Text Input Area */}
        <div className="p-4 border-t border-studio-border/30">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isProcessing ? "Processing... you can still type your next command!" : "Ask Lando about mixing, stems, effects..."}
              className="flex-1"
              disabled={false}
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              className="px-3"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Quick Actions - Always Available */}
          <div className="flex gap-2 mt-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setInputMessage("reverse the audio")}
              className="text-xs"
            >
              <Cog className="w-3 h-3 mr-1" />
              Reverse Audio
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setInputMessage("speed up 2x")}
              className="text-xs"
            >
              <Zap className="w-3 h-3 mr-1" />
              Speed Up
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setInputMessage("normalize volume")}
              className="text-xs"
            >
              <Volume2 className="w-3 h-3 mr-1" />
              Normalize
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setInputMessage("add distortion")}
              className="text-xs"
            >
              <Wand2 className="w-3 h-3 mr-1" />
              Add FX
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setInputMessage("slow the tempo down")}
              className="text-xs"
            >
              <Music className="w-3 h-3 mr-1" />
              Slow Down
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
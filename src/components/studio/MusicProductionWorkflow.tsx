import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Play, 
  Pause, 
  Square, 
  Mic, 
  Circle,
  SkipBack,
  SkipForward,
  Volume2,
  Headphones,
  Settings,
  Download,
  Plus,
  Layers,
  Wand2,
  Sliders,
  Award
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RecordingTrack {
  id: string;
  name: string;
  type: 'generated' | 'recorded' | 'imported';
  audioUrl?: string;
  waveformData: number[];
  isRecording: boolean;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  soloed: boolean;
  startTime: number;
  endTime: number;
}

interface ProjectSession {
  id: string;
  name: string;
  bpm: number;
  key: string;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  isRecording: boolean;
  tracks: RecordingTrack[];
  generatedAudio?: {
    id: string;
    title: string;
    audioUrl: string;
    waveformData: number[];
  };
}

export const MusicProductionWorkflow: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>('generate');
  const [session, setSession] = useState<ProjectSession>({
    id: 'project_1',
    name: 'New Project',
    bpm: 120,
    key: 'C',
    currentTime: 0,
    totalDuration: 180,
    isPlaying: false,
    isRecording: false,
    tracks: []
  });
  
  const [recordingDevice, setRecordingDevice] = useState<string>('default');
  const [recordingInput, setRecordingInput] = useState<string>('microphone');
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [countInEnabled, setCountInEnabled] = useState(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Transport Controls
  const handlePlay = useCallback(() => {
    setSession(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    toast({
      title: session.isPlaying ? "Playback stopped" : "Playback started",
      description: `Current time: ${formatTime(session.currentTime)}`
    });
  }, [session.isPlaying, session.currentTime, toast]);

  const handleStop = useCallback(() => {
    setSession(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
    toast({
      title: "Playback stopped",
      description: "Returned to beginning"
    });
  }, [toast]);

  const handleRecord = useCallback(async () => {
    if (session.isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      setSession(prev => ({ ...prev, isRecording: false }));
      toast({
        title: "Recording stopped",
        description: "Audio saved to new track"
      });
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 2,
            sampleRate: 48000
          } 
        });
        
        audioStreamRef.current = stream;
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            const audioUrl = URL.createObjectURL(event.data);
            const newTrack: RecordingTrack = {
              id: `track_${Date.now()}`,
              name: `Recording ${session.tracks.length + 1}`,
              type: 'recorded',
              audioUrl,
              waveformData: generateMockWaveform(),
              isRecording: false,
              isPlaying: false,
              volume: 100,
              muted: false,
              soloed: false,
              startTime: session.currentTime,
              endTime: session.currentTime + 30 // Estimated duration
            };
            
            setSession(prev => ({
              ...prev,
              tracks: [...prev.tracks, newTrack]
            }));
          }
        };
        
        // Count-in if enabled
        if (countInEnabled) {
          toast({
            title: "Count-in: 4... 3... 2... 1...",
            description: "Recording will start after count-in"
          });
          setTimeout(() => {
            mediaRecorder.start();
            setSession(prev => ({ ...prev, isRecording: true, isPlaying: true }));
          }, 2000);
        } else {
          mediaRecorder.start();
          setSession(prev => ({ ...prev, isRecording: true, isPlaying: true }));
        }
        
      } catch (error) {
        toast({
          title: "Recording failed",
          description: "Could not access microphone",
          variant: "destructive"
        });
      }
    }
  }, [session.isRecording, session.currentTime, session.tracks.length, countInEnabled, toast]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateMockWaveform = () => {
    return Array.from({ length: 100 }, () => Math.random() * 100);
  };

  const TrackDisplay: React.FC<{ track: RecordingTrack }> = ({ track }) => (
    <div className="flex items-center gap-3 p-3 bg-studio-surface-secondary rounded-lg">
      <div className="flex items-center gap-2 min-w-32">
        <div className={`w-3 h-3 rounded-full ${track.type === 'generated' ? 'bg-neon-purple' : track.type === 'recorded' ? 'bg-red-500' : 'bg-neon-blue'}`} />
        <span className="text-sm font-medium">{track.name}</span>
        <Badge variant="outline" className="text-xs">{track.type}</Badge>
      </div>
      
      <div className="flex-1 h-8 bg-studio-surface rounded flex items-end gap-0.5 px-2">
        {track.waveformData.slice(0, 50).map((value, index) => (
          <div
            key={index}
            className={`flex-1 rounded-sm ${track.isPlaying ? 'bg-neon-green' : 'bg-neon-blue'}`}
            style={{ height: `${Math.max(2, (value / 100) * 24)}px`, opacity: 0.7 }}
          />
        ))}
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm">
          {track.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button variant={track.muted ? "destructive" : "ghost"} size="sm">
          <Volume2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const TransportControls = () => (
    <Card className="glass-card-subtle">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleStop}>
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button 
              variant={session.isPlaying ? "destructive" : "neon"} 
              size="lg"
              onClick={handlePlay}
            >
              {session.isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </Button>
            <Button 
              variant={session.isRecording ? "destructive" : "outline"}
              size="lg"
              onClick={handleRecord}
              className={session.isRecording ? "animate-pulse" : ""}
            >
              {session.isRecording ? <Square className="w-6 h-6" /> : <Circle className="w-6 h-6 fill-red-500" />}
            </Button>
            <Button variant="ghost" size="sm">
              <SkipForward className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-mono font-bold">{formatTime(session.currentTime)}</div>
            <div className="text-sm text-studio-text-secondary">
              {session.bpm} BPM • {session.key} • {formatTime(session.totalDuration)}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Headphones className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <Progress 
            value={(session.currentTime / session.totalDuration) * 100} 
            className="w-full h-2"
          />
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
            Music Production Workflow
            {session.isRecording && (
              <Badge variant="destructive" className="animate-pulse">
                <Circle className="w-2 h-2 fill-white mr-1" />
                REC
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{session.tracks.length} tracks</Badge>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Transport Controls */}
        <TransportControls />
        
        {/* Step-by-Step Workflow Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="generate" className="flex items-center gap-1">
              <Wand2 className="w-4 h-4" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="arrange" className="flex items-center gap-1">
              <Layers className="w-4 h-4" />
              Arrange
            </TabsTrigger>
            <TabsTrigger value="record" className="flex items-center gap-1">
              <Mic className="w-4 h-4" />
              Record
            </TabsTrigger>
            <TabsTrigger value="mix" className="flex items-center gap-1">
              <Sliders className="w-4 h-4" />
              Mix
            </TabsTrigger>
            <TabsTrigger value="master" className="flex items-center gap-1">
              <Award className="w-4 h-4" />
              Master
            </TabsTrigger>
          </TabsList>

          {/* Step 1: Generate */}
          <TabsContent value="generate" className="space-y-4">
            <Card className="glass-card-subtle">
              <CardHeader>
                <CardTitle className="text-base">Step 1: AI Music Generation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-studio-text-secondary">
                  Start by generating your base track using AI. This will serve as the foundation for your production.
                </p>
                
                {session.generatedAudio ? (
                  <div className="p-4 bg-neon-purple/10 border border-neon-purple rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{session.generatedAudio.title}</h4>
                      <Button variant="outline" size="sm">
                        <Play className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
                    </div>
                    <div className="h-12 bg-studio-surface-secondary rounded flex items-end gap-0.5 p-2">
                      {session.generatedAudio.waveformData.slice(0, 80).map((value, index) => (
                        <div
                          key={index}
                          className="flex-1 bg-neon-purple rounded-sm"
                          style={{ height: `${Math.max(2, (value / 100) * 32)}px`, opacity: 0.7 }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Wand2 className="w-12 h-12 mx-auto mb-4 text-studio-text-secondary" />
                    <p className="text-studio-text-secondary mb-4">No generated audio yet</p>
                    <Button variant="neon">
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate Base Track
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Step 2: Arrange */}
          <TabsContent value="arrange" className="space-y-4">
            <Card className="glass-card-subtle">
              <CardHeader>
                <CardTitle className="text-base">Step 2: Arrangement & Structure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-studio-text-secondary">
                  Arrange your track structure and add sections like intro, verse, chorus, bridge.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {['Intro', 'Verse', 'Chorus', 'Bridge'].map(section => (
                    <Button key={section} variant="outline" className="h-20 flex flex-col">
                      <span className="font-medium">{section}</span>
                      <span className="text-xs text-studio-text-secondary">8 bars</span>
                    </Button>
                  ))}
                </div>
                
                <Button variant="outline" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Section
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Step 3: Record */}
          <TabsContent value="record" className="space-y-4">
            <Card className="glass-card-subtle">
              <CardHeader>
                <CardTitle className="text-base">Step 3: Recording</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-studio-text-secondary">
                  Record additional elements on top of your generated base. Add vocals, instruments, or creative layers.
                </p>
                
                {/* Recording Settings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Input Source</Label>
                    <Select value={recordingInput} onValueChange={setRecordingInput}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="microphone">Microphone</SelectItem>
                        <SelectItem value="line-in">Line Input</SelectItem>
                        <SelectItem value="instrument">Direct Instrument</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Recording Device</Label>
                    <Select value={recordingDevice} onValueChange={setRecordingDevice}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default Device</SelectItem>
                        <SelectItem value="usb-mic">USB Microphone</SelectItem>
                        <SelectItem value="audio-interface">Audio Interface</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Count-in</Label>
                      <Button
                        variant={countInEnabled ? "neon" : "outline"}
                        size="sm"
                        onClick={() => setCountInEnabled(!countInEnabled)}
                      >
                        {countInEnabled ? "ON" : "OFF"}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Metronome</Label>
                      <Button
                        variant={metronomeEnabled ? "neon" : "outline"}
                        size="sm"
                        onClick={() => setMetronomeEnabled(!metronomeEnabled)}
                      >
                        {metronomeEnabled ? "ON" : "OFF"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Record Button */}
                <div className="text-center">
                  <Button 
                    variant={session.isRecording ? "destructive" : "neon"}
                    size="lg"
                    onClick={handleRecord}
                    className={session.isRecording ? "animate-pulse" : ""}
                  >
                    {session.isRecording ? (
                      <>
                        <Square className="w-6 h-6 mr-2" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Circle className="w-6 h-6 mr-2 fill-red-500" />
                        Start Recording
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Step 4: Mix */}
          <TabsContent value="mix" className="space-y-4">
            <Card className="glass-card-subtle">
              <CardHeader>
                <CardTitle className="text-base">Step 4: Mixing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-studio-text-secondary">
                  Balance and blend all your tracks together. Adjust levels, EQ, and effects.
                </p>
                
                {session.tracks.length > 0 ? (
                  <div className="space-y-3">
                    {session.tracks.map(track => (
                      <TrackDisplay key={track.id} track={track} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Sliders className="w-12 h-12 mx-auto mb-4 text-studio-text-secondary" />
                    <p className="text-studio-text-secondary">No tracks to mix yet</p>
                    <p className="text-sm text-studio-text-secondary">Generate or record some audio first</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Step 5: Master */}
          <TabsContent value="master" className="space-y-4">
            <Card className="glass-card-subtle">
              <CardHeader>
                <CardTitle className="text-base">Step 5: Mastering</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-studio-text-secondary">
                  Apply final mastering to make your track ready for release on streaming platforms.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" size="lg">
                    <Award className="w-5 h-5 mr-2" />
                    Auto Master
                  </Button>
                  <Button variant="neon" size="lg">
                    <Download className="w-5 h-5 mr-2" />
                    Export Master
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Current Tracks Overview */}
        {session.tracks.length > 0 && (
          <Card className="glass-card-subtle">
            <CardHeader>
              <CardTitle className="text-base">Project Tracks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {session.tracks.map(track => (
                <TrackDisplay key={track.id} track={track} />
              ))}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};
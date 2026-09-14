import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Mic, 
  Square, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward,
  Volume2,
  Headphones,
  Radio,
  Clock,
  Zap,
  Settings,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AudioTrack {
  id: string;
  name: string;
  type: 'vocal' | 'instrument' | 'generated';
  duration: number;
  isRecording: boolean;
  isPlaying: boolean;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  waveformData?: number[];
}

interface RecordingSession {
  id: string;
  name: string;
  bpm: number;
  key: string;
  tracks: AudioTrack[];
  isRecording: boolean;
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
}

export const RecordingStudio: React.FC = () => {
  const { toast } = useToast();
  const [session, setSession] = useState<RecordingSession>({
    id: '1',
    name: 'New Recording Session',
    bpm: 120,
    key: 'C',
    tracks: [
      {
        id: '1',
        name: 'Lead Vocal',
        type: 'vocal',
        duration: 0,
        isRecording: false,
        isPlaying: false,
        volume: 75,
        pan: 0,
        muted: false,
        soloed: false
      },
      {
        id: '2',
        name: 'Guitar',
        type: 'instrument',
        duration: 0,
        isRecording: false,
        isPlaying: false,
        volume: 70,
        pan: -20,
        muted: false,
        soloed: false
      },
      {
        id: '3',
        name: 'AI Generated Beat',
        type: 'generated',
        duration: 180,
        isRecording: false,
        isPlaying: false,
        volume: 80,
        pan: 0,
        muted: false,
        soloed: false,
        waveformData: Array(100).fill(0).map(() => Math.random() * 100)
      }
    ],
    isRecording: false,
    isPlaying: false,
    currentTime: 0,
    totalDuration: 180
  });

  const [selectedTrack, setSelectedTrack] = useState<string>('1');
  const [inputDevice, setInputDevice] = useState<string>('default');
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async (trackId: string) => {
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
      chunksRef.current = [];
      setRecordingUrl(null);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.start(100); // collect chunks every 100ms
      
      setSession(prev => ({
        ...prev,
        isRecording: true,
        tracks: prev.tracks.map(track => 
          track.id === trackId 
            ? { ...track, isRecording: true }
            : track
        )
      }));
      
      toast({
        title: "Recording started",
        description: `Recording to ${session.tracks.find(t => t.id === trackId)?.name}`,
      });
      
    } catch (error) {
      toast({
        title: "Recording failed",
        description: "Could not access microphone",
        variant: "destructive"
      });
    }
  }, [session.tracks, toast]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== 'recording') return;

    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      setRecordingUrl(url);
      chunksRef.current = [];
    };

    mr.stop();

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }

    setSession(prev => ({
      ...prev,
      isRecording: false,
      tracks: prev.tracks.map(track => ({ ...track, isRecording: false }))
    }));

    toast({
      title: "Recording stopped",
      description: "Audio captured — use Download to save it",
    });
  }, [toast]);

  const togglePlayback = useCallback(() => {
    setSession(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const updateTrackVolume = useCallback((trackId: string, volume: number) => {
    setSession(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => 
        track.id === trackId ? { ...track, volume } : track
      )
    }));
  }, []);

  const updateTrackPan = useCallback((trackId: string, pan: number) => {
    setSession(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => 
        track.id === trackId ? { ...track, pan } : track
      )
    }));
  }, []);

  const toggleMute = useCallback((trackId: string) => {
    setSession(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => 
        track.id === trackId ? { ...track, muted: !track.muted } : track
      )
    }));
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const WaveformDisplay: React.FC<{ data?: number[]; isRecording?: boolean }> = ({ data, isRecording }) => {
    if (!data) {
      return (
        <div className="h-16 bg-studio-surface-secondary rounded flex items-center justify-center">
          <span className="text-studio-text-secondary text-sm">No audio data</span>
        </div>
      );
    }

    return (
      <div className="h-16 bg-studio-surface-secondary rounded p-2 flex items-end gap-0.5 overflow-hidden">
        {data.map((value, index) => (
          <div
            key={index}
            className={`flex-1 rounded-sm transition-all duration-150 ${
              isRecording 
                ? 'bg-red-500 animate-pulse' 
                : 'bg-neon-blue'
            }`}
            style={{ 
              height: `${Math.max(2, (value / 100) * 48)}px`,
              opacity: isRecording ? 0.8 : 0.6
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500" />
            Recording Studio
            {session.isRecording && (
              <Badge variant="destructive" className="animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full mr-1" />
                REC
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{session.bpm} BPM</Badge>
            <Badge variant="outline">{session.key} Major</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Transport Controls */}
        <div className="flex items-center justify-center gap-4 p-4 bg-studio-surface-secondary rounded-lg">
          <Button variant="ghost" size="sm">
            <SkipBack className="w-5 h-5" />
          </Button>
          <Button 
            variant={session.isPlaying ? "destructive" : "neon"} 
            size="lg"
            onClick={togglePlayback}
          >
            {session.isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6" />
            )}
          </Button>
          <Button variant="ghost" size="sm">
            <SkipForward className="w-5 h-5" />
          </Button>
          <div className="mx-4 text-center">
            <div className="text-lg font-mono">{formatTime(session.currentTime)}</div>
            <div className="text-sm text-studio-text-secondary">
              / {formatTime(session.totalDuration)}
            </div>
          </div>
        </div>

        {/* Input Settings */}
        <div className="space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Recording Settings
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Input Device</Label>
              <Select value={inputDevice} onValueChange={setInputDevice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-studio-surface border border-studio-border">
                  <SelectItem value="default">Default Microphone</SelectItem>
                  <SelectItem value="usb-mic">USB Microphone</SelectItem>
                  <SelectItem value="audio-interface">Audio Interface</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Recording Track</Label>
              <Select value={selectedTrack} onValueChange={setSelectedTrack}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-studio-surface border border-studio-border">
                  {session.tracks.map(track => (
                    <SelectItem key={track.id} value={track.id}>
                      {track.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Recording Controls</Label>
              <div className="flex items-center gap-3">
                <Button
                  variant={session.isRecording ? "destructive" : "neon"}
                  onClick={() => session.isRecording ? stopRecording() : startRecording(selectedTrack)}
                  className="flex-1"
                >
                  {session.isRecording ? (
                    <>
                      <Square className="w-4 h-4 mr-2" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      Record
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" className="px-3">
                  <Headphones className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Track Mixer */}
        <div className="space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            Track Mixer
          </h3>
          
          {session.tracks.map(track => (
            <Card key={track.id} className="glass-card-subtle">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-4">
                  {/* Track Info */}
                  <div className="min-w-32">
                    <h4 className="font-medium text-base mb-2">{track.name}</h4>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">
                        {track.type}
                      </Badge>
                      {track.isRecording && (
                        <Badge variant="destructive" className="text-xs animate-pulse">
                          REC
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Waveform */}
                  <div className="flex-1">
                    <WaveformDisplay 
                      data={track.waveformData} 
                      isRecording={track.isRecording}
                    />
                  </div>
                </div>
                
                {/* Controls */}
                <div className="flex items-center justify-between gap-4 pt-2 border-t border-studio-border/20">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Volume */}
                    <div className="w-24">
                      <Label className="text-xs mb-1 block">Volume</Label>
                      <Slider
                        value={[track.volume]}
                        onValueChange={([value]) => updateTrackVolume(track.id, value)}
                        min={0}
                        max={100}
                        step={1}
                        className="mb-1"
                      />
                      <span className="text-xs text-studio-text-secondary">
                        {track.volume}%
                      </span>
                    </div>
                    
                    {/* Pan */}
                    <div className="w-24">
                      <Label className="text-xs mb-1 block">Pan</Label>
                      <Slider
                        value={[track.pan]}
                        onValueChange={([value]) => updateTrackPan(track.id, value)}
                        min={-100}
                        max={100}
                        step={1}
                        className="mb-1"
                      />
                      <span className="text-xs text-studio-text-secondary">
                        {track.pan > 0 ? 'R' : track.pan < 0 ? 'L' : 'C'}{Math.abs(track.pan)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Mute/Solo */}
                    <div className="flex gap-2">
                      <Button
                        variant={track.muted ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => toggleMute(track.id)}
                        className="text-xs px-3 py-1 min-w-[2rem]"
                      >
                        M
                      </Button>
                      <Button
                        variant={track.soloed ? "neon" : "outline"}
                        size="sm"
                        className="text-xs px-3 py-1 min-w-[2rem]"
                      >
                        S
                      </Button>
                    </div>
                    
                    {/* Duration */}
                    <div className="text-sm text-studio-text-secondary min-w-[4rem] text-right">
                      <Label className="text-xs block">Duration</Label>
                      {formatTime(track.duration)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="font-medium flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Quick Actions
          </h3>
          
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" className="whitespace-nowrap">
              <Settings className="w-4 h-4 mr-2" />
              Audio Settings
            </Button>
            <Button variant="outline" size="sm" className="whitespace-nowrap">
              <Zap className="w-4 h-4 mr-2" />
              Add Track
            </Button>
            {recordingUrl ? (
              <a href={recordingUrl} download="noir-recording.webm">
                <Button variant="neon" size="sm" className="whitespace-nowrap">
                  <Download className="w-4 h-4 mr-2" />
                  Download Recording
                </Button>
              </a>
            ) : (
              <Button variant="outline" size="sm" className="whitespace-nowrap" disabled>
                <Download className="w-4 h-4 mr-2" />
                Export Session
              </Button>
            )}
            <Button variant="outline" size="sm" className="whitespace-nowrap">
              <Clock className="w-4 h-4 mr-2" />
              Metronome
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
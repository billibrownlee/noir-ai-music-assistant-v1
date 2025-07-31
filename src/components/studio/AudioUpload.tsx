import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, X, Music, FileAudio, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AudioAnalyzer, AudioAnalysis } from '@/lib/audioAnalyzer';

interface AudioSample {
  id: string;
  name: string;
  genre: string;
  bpm?: number;
  key?: string;
  tags: string[];
  file: File;
  audioUrl?: string;
  duration?: number;
  uploadProgress?: number;
  isPlaying?: boolean;
  analysis?: AudioAnalysis;
}

interface AudioUploadProps {
  onSamplesUploaded: (samples: AudioSample[]) => void;
}

export const AudioUpload: React.FC<AudioUploadProps> = ({ onSamplesUploaded }) => {
  const [uploadedSamples, setUploadedSamples] = useState<AudioSample[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null);
  const [playingSampleId, setPlayingSampleId] = useState<string | null>(null);
  const [audioAnalyzer] = useState(() => new AudioAnalyzer());
  const { toast } = useToast();

  const validateAudioFile = (file: File): boolean => {
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/m4a', 'audio/ogg'];
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload MP3, WAV, FLAC, M4A, or OGG files only.",
        variant: "destructive"
      });
      return false;
    }
    
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload files smaller than 50MB.",
        variant: "destructive"
      });
      return false;
    }
    
    return true;
  };

  const extractAudioMetadata = (file: File): Promise<{ duration: number }> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', () => {
        resolve({ duration: audio.duration });
      });
      audio.addEventListener('error', () => {
        resolve({ duration: 0 });
      });
      audio.src = URL.createObjectURL(file);
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFiles = async (files: File[]) => {
    const audioFiles = files.filter(file => validateAudioFile(file));
    
    if (audioFiles.length === 0) return;

    for (const file of audioFiles) {
      const id = Math.random().toString(36).substr(2, 9);
      const audioUrl = URL.createObjectURL(file);
      
      const sample: AudioSample = {
        id,
        name: file.name.replace(/\.[^/.]+$/, ""),
        genre: '',
        tags: [],
        file,
        audioUrl,
        uploadProgress: 0,
        isPlaying: false
      };

      // Add sample to list immediately
      setUploadedSamples(prev => [...prev, sample]);
      
      // Get audio metadata and analysis
      try {
        const metadata = await extractAudioMetadata(file);
        const analysis = await audioAnalyzer.analyzeAudioFile(file);
        
        setUploadedSamples(prev => 
          prev.map(s => s.id === id ? { 
            ...s, 
            duration: metadata.duration,
            analysis,
            // Auto-populate fields from analysis
            bpm: analysis.tempo,
            key: analysis.key
          } : s)
        );
        
        toast({
          title: "Audio analyzed!",
          description: `Detected: ${analysis.tempo} BPM, ${analysis.key} ${analysis.mode}`,
        });
        
      } catch (error) {
        console.error('Error analyzing audio:', error);
        // Still get basic metadata
        try {
          const metadata = await extractAudioMetadata(file);
          setUploadedSamples(prev => 
            prev.map(s => s.id === id ? { ...s, duration: metadata.duration } : s)
          );
        } catch (metadataError) {
          console.error('Error extracting metadata:', metadataError);
        }
      }
      
      // Simulate upload progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
        }
        
        setUploadedSamples(prev => 
          prev.map(s => s.id === id ? { ...s, uploadProgress: progress } : s)
        );
      }, 200);
    }

    toast({
      title: "Files uploaded!",
      description: `${audioFiles.length} audio file(s) processed successfully.`,
    });
  };

  const playAudio = useCallback(async (sample: AudioSample) => {
    try {
      // Stop currently playing audio
      if (playingAudio) {
        playingAudio.pause();
        playingAudio.currentTime = 0;
      }

      if (playingSampleId === sample.id) {
        // Stop current sample
        setPlayingAudio(null);
        setPlayingSampleId(null);
        setUploadedSamples(prev => 
          prev.map(s => ({ ...s, isPlaying: false }))
        );
        return;
      }

      // Play new sample
      const audio = new Audio(sample.audioUrl);
      audio.addEventListener('ended', () => {
        setPlayingAudio(null);
        setPlayingSampleId(null);
        setUploadedSamples(prev => 
          prev.map(s => ({ ...s, isPlaying: false }))
        );
      });

      audio.addEventListener('error', () => {
        toast({
          title: "Playback error",
          description: "Could not play the audio file.",
          variant: "destructive"
        });
      });

      await audio.play();
      setPlayingAudio(audio);
      setPlayingSampleId(sample.id);
      setUploadedSamples(prev => 
        prev.map(s => ({ ...s, isPlaying: s.id === sample.id }))
      );

    } catch (error) {
      toast({
        title: "Playback failed",
        description: "Could not play the audio file.",
        variant: "destructive"
      });
    }
  }, [playingAudio, playingSampleId, toast]);

  const updateSample = (id: string, updates: Partial<AudioSample>) => {
    setUploadedSamples(prev => 
      prev.map(sample => 
        sample.id === id ? { ...sample, ...updates } : sample
      )
    );
  };

  const removeSample = (id: string) => {
    // Clean up audio URL to prevent memory leaks
    const sample = uploadedSamples.find(s => s.id === id);
    if (sample?.audioUrl) {
      URL.revokeObjectURL(sample.audioUrl);
    }
    
    // Stop playing audio if it's the current sample
    if (playingSampleId === id && playingAudio) {
      playingAudio.pause();
      setPlayingAudio(null);
      setPlayingSampleId(null);
    }
    
    setUploadedSamples(prev => prev.filter(sample => sample.id !== id));
  };

  const addTag = (sampleId: string, tag: string) => {
    if (!tag.trim()) return;
    
    updateSample(sampleId, {
      tags: [...(uploadedSamples.find(s => s.id === sampleId)?.tags || []), tag.trim()]
    });
  };

  const removeTag = (sampleId: string, tagIndex: number) => {
    const sample = uploadedSamples.find(s => s.id === sampleId);
    if (!sample) return;
    
    updateSample(sampleId, {
      tags: sample.tags.filter((_, index) => index !== tagIndex)
    });
  };

  const handleUploadToLibrary = async () => {
    if (uploadedSamples.length === 0) return;
    
    try {
      // In a real implementation, you would upload to Supabase storage here
      // For now, we'll just simulate the process
      const processedSamples = uploadedSamples.filter(s => (s.uploadProgress || 0) >= 100);
      
      toast({
        title: "Samples added to library!",
        description: `${processedSamples.length} audio samples are now available in your library.`,
      });
      
      onSamplesUploaded(processedSamples);
      
      // Clean up URLs
      uploadedSamples.forEach(sample => {
        if (sample.audioUrl) {
          URL.revokeObjectURL(sample.audioUrl);
        }
      });
      
      setUploadedSamples([]);
      setPlayingAudio(null);
      setPlayingSampleId(null);
      
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Could not add samples to library. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="w-5 h-5 text-neon-blue" />
          Upload Training Samples
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
            isDragging 
              ? 'border-neon-blue bg-neon-blue/10' 
              : 'border-studio-border hover:border-neon-blue/50'
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-studio-text-secondary" />
          <p className="text-lg font-medium mb-2">Drop audio files here</p>
          <p className="text-studio-text-secondary mb-4">Supports WAV, MP3, FLAC, and other audio formats</p>
          <Input
            type="file"
            multiple
            accept="audio/*"
            onChange={(e) => handleFiles(Array.from(e.target.files || []))}
            className="hidden"
            id="audio-upload"
          />
          <Label htmlFor="audio-upload" className="cursor-pointer">
            <Button variant="neon" size="lg">
              Browse Files
            </Button>
          </Label>
        </div>

        {/* Uploaded Samples */}
        {uploadedSamples.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Configure Samples</h3>
            {uploadedSamples.map(sample => (
              <Card key={sample.id} className="glass-card-subtle">
                <CardContent className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <FileAudio className="w-6 h-6 text-neon-purple" />
                      {sample.isPlaying && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-neon-green rounded-full animate-pulse" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium">{sample.name}</h4>
                      <div className="flex items-center gap-2 text-sm text-studio-text-secondary">
                        {sample.duration && (
                          <span>{Math.floor(sample.duration / 60)}:{(sample.duration % 60).toFixed(0).padStart(2, '0')}</span>
                        )}
                        <span>•</span>
                        <span>{(sample.file.size / (1024 * 1024)).toFixed(1)} MB</span>
                        {sample.analysis && (
                          <>
                            <span>•</span>
                            <span>{sample.analysis.tempo} BPM</span>
                            <span>•</span>
                            <span>{sample.analysis.key} {sample.analysis.mode}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sample.audioUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => playAudio(sample)}
                        className="flex items-center gap-1"
                      >
                        {sample.isPlaying ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSample(sample.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                  {/* Upload Progress */}
                  {sample.uploadProgress !== undefined && sample.uploadProgress < 100 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">Uploading...</span>
                        <span className="text-sm">{Math.round(sample.uploadProgress)}%</span>
                      </div>
                      <Progress value={sample.uploadProgress} className="w-full" />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <Label htmlFor={`genre-${sample.id}`}>Genre</Label>
                      <Select 
                        value={sample.genre}
                        onValueChange={(value) => updateSample(sample.id, { genre: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select genre" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rnb">R&B</SelectItem>
                          <SelectItem value="pop">Pop</SelectItem>
                          <SelectItem value="trap">Trap</SelectItem>
                          <SelectItem value="rap">Rap</SelectItem>
                          <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                          <SelectItem value="soul">Soul</SelectItem>
                          <SelectItem value="funk">Funk</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`bpm-${sample.id}`}>BPM</Label>
                      <Input
                        id={`bpm-${sample.id}`}
                        type="number"
                        value={sample.bpm || ''}
                        placeholder="120"
                        onChange={(e) => updateSample(sample.id, { bpm: parseInt(e.target.value) || undefined })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`key-${sample.id}`}>Key</Label>
                      <Select 
                        value={sample.key || ''}
                        onValueChange={(value) => updateSample(sample.id, { key: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select key" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="C">C</SelectItem>
                          <SelectItem value="C#">C#</SelectItem>
                          <SelectItem value="D">D</SelectItem>
                          <SelectItem value="D#">D#</SelectItem>
                          <SelectItem value="E">E</SelectItem>
                          <SelectItem value="F">F</SelectItem>
                          <SelectItem value="F#">F#</SelectItem>
                          <SelectItem value="G">G</SelectItem>
                          <SelectItem value="G#">G#</SelectItem>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="A#">A#</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {sample.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <X 
                            className="w-3 h-3 cursor-pointer" 
                            onClick={() => removeTag(sample.id, index)}
                          />
                        </Badge>
                      ))}
                    </div>
                    <Input
                      placeholder="Add tags (vocal, melody, bass, etc.)"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addTag(sample.id, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button 
              onClick={handleUploadToLibrary}
              className="w-full"
              size="lg"
              variant="neon"
              disabled={uploadedSamples.length === 0 || uploadedSamples.some(s => (s.uploadProgress || 0) < 100)}
            >
              Add {uploadedSamples.filter(s => (s.uploadProgress || 0) >= 100).length} Sample(s) to Library
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
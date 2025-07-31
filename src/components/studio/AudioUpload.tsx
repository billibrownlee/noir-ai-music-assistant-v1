import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, X, Music, FileAudio } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AudioSample {
  id: string;
  name: string;
  genre: string;
  bpm?: number;
  key?: string;
  tags: string[];
  file: File;
  duration?: number;
}

interface AudioUploadProps {
  onSamplesUploaded: (samples: AudioSample[]) => void;
}

export const AudioUpload: React.FC<AudioUploadProps> = ({ onSamplesUploaded }) => {
  const [uploadedSamples, setUploadedSamples] = useState<AudioSample[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFiles = (files: File[]) => {
    const audioFiles = files.filter(file => file.type.startsWith('audio/'));
    
    if (audioFiles.length === 0) {
      toast({
        title: "Invalid files",
        description: "Please upload audio files only.",
        variant: "destructive"
      });
      return;
    }

    audioFiles.forEach(file => {
      const id = Math.random().toString(36).substr(2, 9);
      const sample: AudioSample = {
        id,
        name: file.name.replace(/\.[^/.]+$/, ""),
        genre: '',
        tags: [],
        file
      };

      // Get audio duration
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        sample.duration = audio.duration;
        setUploadedSamples(prev => {
          const updated = prev.map(s => s.id === id ? { ...s, duration: audio.duration } : s);
          return updated;
        });
      };
      audio.src = URL.createObjectURL(file);

      setUploadedSamples(prev => [...prev, sample]);
      
      // Simulate upload progress
      setUploadProgress(prev => ({ ...prev, [id]: 0 }));
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          const current = prev[id] || 0;
          if (current >= 100) {
            clearInterval(interval);
            return prev;
          }
          return { ...prev, [id]: current + 10 };
        });
      }, 100);
    });
  };

  const updateSample = (id: string, updates: Partial<AudioSample>) => {
    setUploadedSamples(prev => 
      prev.map(sample => 
        sample.id === id ? { ...sample, ...updates } : sample
      )
    );
  };

  const removeSample = (id: string) => {
    setUploadedSamples(prev => prev.filter(sample => sample.id !== id));
    setUploadProgress(prev => {
      const { [id]: removed, ...rest } = prev;
      return rest;
    });
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
    
    // Here you would upload to Supabase storage and save metadata to database
    toast({
      title: "Samples uploaded!",
      description: `${uploadedSamples.length} audio samples added to your library.`,
    });
    
    onSamplesUploaded(uploadedSamples);
    setUploadedSamples([]);
    setUploadProgress({});
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
                      <FileAudio className="w-6 h-6 text-neon-purple" />
                      <div>
                        <h4 className="font-medium">{sample.name}</h4>
                        {sample.duration && (
                          <p className="text-sm text-studio-text-secondary">
                            {Math.floor(sample.duration / 60)}:{(sample.duration % 60).toFixed(0).padStart(2, '0')}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSample(sample.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Upload Progress */}
                  {uploadProgress[sample.id] < 100 && (
                    <div className="mb-4">
                      <Progress value={uploadProgress[sample.id]} className="w-full" />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <Label htmlFor={`genre-${sample.id}`}>Genre</Label>
                      <Select onValueChange={(value) => updateSample(sample.id, { genre: value })}>
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
                        placeholder="120"
                        onChange={(e) => updateSample(sample.id, { bpm: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`key-${sample.id}`}>Key</Label>
                      <Select onValueChange={(value) => updateSample(sample.id, { key: value })}>
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
            >
              Add to Sample Library
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
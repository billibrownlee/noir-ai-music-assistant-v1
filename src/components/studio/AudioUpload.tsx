import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, X, Music, FileAudio, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AudioAnalyzer, AudioAnalysis } from '@/lib/audioAnalyzer';
import { AudioSeparationEngine, SeparatedAudio } from '@/lib/audioSeparation';
import { AudioPlayButton } from '@/components/ui/audio-play-button';
import { useGlobalAudio } from '@/hooks/useGlobalAudio';

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
  onAudioSeparated?: (separatedAudio: SeparatedAudio) => void;
  onAnalysisComplete?: (analysis: AudioAnalysis) => void;
}

export const AudioUpload: React.FC<AudioUploadProps> = ({ 
  onSamplesUploaded, 
  onAudioSeparated,
  onAnalysisComplete 
}) => {
  const [uploadedSamples, setUploadedSamples] = useState<AudioSample[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [audioAnalyzer] = useState(() => new AudioAnalyzer());
  const [separationEngine] = useState(() => new AudioSeparationEngine());
  const [separationProgress, setSeparationProgress] = useState<{ progress: number, stage: string } | null>(null);
  const [isSeparating, setIsSeparating] = useState(false);
  const { toast } = useToast();
  const { currentTrack, isPlaying } = useGlobalAudio();

  const validateAudioFile = (file: File): boolean => {
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/m4a', 'audio/ogg', 'audio/mp3', 'audio/x-wav', 'audio/aac'];
    const maxSize = 100 * 1024 * 1024; // Increased to 100MB
    
    console.log('Validating file:', file.name, 'Type:', file.type, 'Size:', file.size);
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|flac|m4a|ogg|aac)$/i)) {
      toast({
        title: "Invalid file type",
        description: `File type: ${file.type}. Please upload MP3, WAV, FLAC, M4A, OGG, or AAC files.`,
        variant: "destructive"
      });
      return false;
    }
    
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `File size: ${(file.size / (1024 * 1024)).toFixed(1)}MB. Please upload files smaller than 100MB.`,
        variant: "destructive"
      });
      return false;
    }
    
    return true;
  };

  const extractAudioMetadata = (file: File): Promise<{ duration: number, analysis?: AudioAnalysis }> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', async () => {
        try {
          // Basic metadata
          const metadata = { duration: audio.duration };
          
          // Try to do quick analysis
          try {
            const analysis = await audioAnalyzer.analyzeAudioFile(file);
            resolve({ ...metadata, analysis });
          } catch (analysisError) {
            console.log('Analysis failed, proceeding with basic metadata:', analysisError);
            resolve(metadata);
          }
        } catch (error) {
          resolve({ duration: 0 });
        }
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
    console.log('Processing files:', files.length);
    
    const audioFiles = files.filter(file => {
      console.log('Checking file:', file.name, file.type, file.size);
      return validateAudioFile(file);
    });
    
    if (audioFiles.length === 0) {
      console.log('No valid audio files found');
      return;
    }

    console.log('Valid audio files:', audioFiles.length);

    for (const file of audioFiles) {
      const id = Math.random().toString(36).substr(2, 9);
      console.log('Processing file:', file.name, 'ID:', id);
      
      try {
        const audioUrl = URL.createObjectURL(file);
        console.log('Created audio URL for:', file.name);
        
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
        console.log('Added sample to list:', sample.name);
        
        // Get metadata and analysis
        try {
          console.log('Extracting metadata for:', file.name);
          const metadata = await extractAudioMetadata(file);
          console.log('Metadata extracted:', metadata);
          
          // Update sample with metadata
          setUploadedSamples(prev => 
            prev.map(s => s.id === id ? { 
              ...s, 
              duration: metadata.duration,
              analysis: metadata.analysis,
              bpm: metadata.analysis?.tempo,
              key: metadata.analysis?.key
            } : s)
          );
          
          // Simulate upload progress with guaranteed completion
          let progress = 0;
          let attempts = 0;
          const maxAttempts = 50;
          
          const progressInterval = setInterval(() => {
            attempts++;
            const increment = Math.random() * 10 + 5;
            progress += increment;
            
            console.log(`Upload progress for ${file.name}: ${Math.round(progress)}%`);
            
            if (progress >= 100 || attempts >= maxAttempts) {
              progress = 100;
              clearInterval(progressInterval);
              
              console.log('✅ Upload complete for:', file.name);
              
              // Set final progress
              setUploadedSamples(prev => 
                prev.map(s => s.id === id ? { ...s, uploadProgress: 100 } : s)
              );
              
              // Trigger callbacks after upload completes
              setTimeout(async () => {
                console.log('🎵 File ready for processing:', file.name);
                
                // Start audio separation if callback provided
                if (onAudioSeparated) {
                  try {
                    setIsSeparating(true);
                    setSeparationProgress({ progress: 0, stage: 'Initializing...' });
                    
                    console.log('🔄 Starting audio separation...');
                    const separatedAudio = await separationEngine.separateAudio(
                      file,
                      (progress, stage) => {
                        setSeparationProgress({ progress, stage });
                        console.log(`Separation: ${Math.round(progress)}% - ${stage}`);
                      }
                    );
                    
                    console.log('✅ Audio separation complete:', separatedAudio);
                    onAudioSeparated(separatedAudio);
                    
                    toast({
                      title: "🎛️ Stems Ready!",
                      description: `Extracted ${separatedAudio.stems.length} stems from your audio. Now you can edit each part separately!`
                    });
                    
                  } catch (error) {
                    console.error('❌ Separation failed:', error);
                    toast({
                      title: "Separation Failed",
                      description: "Couldn't separate audio stems. You can still work with the full track.",
                      variant: "destructive"
                    });
                  } finally {
                    setIsSeparating(false);
                    setSeparationProgress(null);
                  }
                }
                
                // Trigger analysis callback if available
                if (onAnalysisComplete && metadata.analysis) {
                  onAnalysisComplete(metadata.analysis);
                }
              }, 500);
              
            } else {
              // Update progress normally
              setUploadedSamples(prev => 
                prev.map(s => s.id === id ? { ...s, uploadProgress: Math.round(progress) } : s)
              );
            }
          }, 150);
          
          // Backup completion after 10 seconds
          setTimeout(() => {
            clearInterval(progressInterval);
            setUploadedSamples(prev => 
              prev.map(s => s.id === id ? { ...s, uploadProgress: 100 } : s)
            );
            console.log('🔄 Backup completion triggered for:', file.name);
          }, 10000);
          
        } catch (metadataError) {
          console.error('Error extracting metadata:', metadataError);
          setUploadedSamples(prev => 
            prev.map(s => s.id === id ? { ...s, uploadProgress: 100 } : s)
          );
        }
        
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        toast({
          title: "Upload failed",
          description: `Could not process ${file.name}. Please try again.`,
          variant: "destructive"
        });
      }
    }

    toast({
      title: "Files uploaded!",
      description: `${audioFiles.length} audio file(s) processed successfully.`,
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
    const sample = uploadedSamples.find(s => s.id === id);
    if (sample?.audioUrl) {
      URL.revokeObjectURL(sample.audioUrl);
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

  const separateAudioStems = useCallback(async (sample: AudioSample) => {
    if (!sample.file) return;
    
    try {
      setSeparationProgress({ progress: 0, stage: 'Starting separation...' });
      setIsSeparating(true);
      
      const separatedAudio = await separationEngine.separateAudio(
        sample.file,
        (progress, stage) => {
          setSeparationProgress({ progress, stage });
        }
      );
      
      setSeparationProgress(null);
      setIsSeparating(false);
      
      toast({
        title: "Audio separated successfully!",
        description: `Extracted ${separatedAudio.stems.length} stems with ${separatedAudio.separationQuality}% quality`,
      });
      
      onAudioSeparated?.(separatedAudio);
      
    } catch (error) {
      setSeparationProgress(null);
      setIsSeparating(false);
      toast({
        title: "Separation failed",
        description: "Could not separate audio stems. Please try again.",
        variant: "destructive"
      });
    }
  }, [separationEngine, onAudioSeparated, toast]);

  const handleUploadToLibrary = async () => {
    if (uploadedSamples.length === 0) return;
    
    try {
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
          <p className="text-studio-text-secondary mb-2">Supports MP3, WAV, FLAC, M4A, OGG, AAC (up to 100MB)</p>
          <p className="text-sm text-studio-text-secondary mb-4">
            Files will be automatically analyzed and separated into stems for editing!
          </p>
          <input
            type="file"
            multiple
            accept=".mp3,.wav,.flac,.m4a,.ogg,.aac,audio/*"
            onChange={(e) => {
              console.log('File input changed:', e.target.files);
              handleFiles(Array.from(e.target.files || []));
            }}
            style={{ display: 'none' }}
            id="audio-upload"
          />
          <label htmlFor="audio-upload" style={{ cursor: 'pointer' }}>
            <Button variant="neon" size="lg" asChild>
              <span>Browse Files</span>
            </Button>
          </label>
        </div>

        {/* Separation Progress */}
        {separationProgress && (
          <Card className="glass-card-subtle border-neon-blue border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <Layers className="w-5 h-5 text-neon-blue animate-pulse" />
                <span className="font-medium">Separating Audio Stems...</span>
              </div>
              <Progress value={separationProgress.progress} className="w-full mb-2" />
              <p className="text-sm text-studio-text-secondary">
                {separationProgress.stage}
              </p>
            </CardContent>
          </Card>
        )}

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
                        {currentTrack?.id === sample.id && isPlaying && (
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
                          <AudioPlayButton
                            audioUrl={sample.audioUrl}
                            trackName={sample.name}
                            trackId={sample.id}
                            variant="outline"
                            size="sm"
                          />
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => separateAudioStems(sample)}
                          disabled={isSeparating}
                        >
                          <Layers className="w-4 h-4 mr-1" />
                          Separate
                        </Button>
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
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AudioProcessor } from '@/lib/audioProcessor';
import { 
  RotateCcw, 
  Play, 
  Pause, 
  Volume2,
  Settings,
  Zap
} from 'lucide-react';

interface TempoControlProps {
  uploadedSamples?: any[];
  onUpdateSample?: (sampleId: string, updates: any) => void;
  onTempoChange?: (bpm: number) => void;
}

export const TempoControl: React.FC<TempoControlProps> = ({
  uploadedSamples = [],
  onUpdateSample,
  onTempoChange
}) => {
  const [targetBPM, setTargetBPM] = useState(120);
  const [originalBPM, setOriginalBPM] = useState(120);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputValue, setInputValue] = useState('120');
  const audioProcessor = useRef(new AudioProcessor());
  const { toast } = useToast();

  // Update original BPM when new samples are uploaded
  useEffect(() => {
    if (uploadedSamples.length > 0) {
      const latestSample = uploadedSamples[uploadedSamples.length - 1];
      if (latestSample.analysis?.tempo) {
        setOriginalBPM(latestSample.analysis.tempo);
        setTargetBPM(latestSample.analysis.tempo);
        setInputValue(latestSample.analysis.tempo.toString());
      }
    }
  }, [uploadedSamples]);

  const handleSliderChange = (value: number[]) => {
    const newBPM = value[0];
    setTargetBPM(newBPM);
    setInputValue(newBPM.toString());
    onTempoChange?.(newBPM);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 200) {
      setTargetBPM(numValue);
      onTempoChange?.(numValue);
    }
  };

  const applyTempoChange = async () => {
    if (uploadedSamples.length === 0) {
      toast({
        title: "No Audio Available",
        description: "Please upload an audio file first",
        variant: "destructive"
      });
      return;
    }

    const latestSample = uploadedSamples[uploadedSamples.length - 1];
    if (!latestSample?.file) return;

    setIsProcessing(true);

    try {
      // Calculate speed factor based on BPM change
      const speedFactor = targetBPM / originalBPM;
      
      console.log(`🎵 Changing tempo from ${originalBPM} BPM to ${targetBPM} BPM (${speedFactor.toFixed(2)}x speed)`);
      
      const result = await audioProcessor.current.changeSpeed(latestSample.file, speedFactor);
      
      if (result.success && result.processedAudioUrl) {
        // Validate the processed audio URL before updating
        if (!result.processedAudioUrl || result.processedAudioUrl.trim() === '') {
          throw new Error('Processed audio URL is empty - processing may have failed');
        }

        // Validate URL format
        try {
          new URL(result.processedAudioUrl);
        } catch (urlError) {
          throw new Error('Processed audio URL has invalid format');
        }

        // Update the sample with new tempo - only pass the changes
        const updates = {
          audioUrl: result.processedAudioUrl,
          name: `${latestSample.name.replace(/ \(\d+ BPM\)$/, '')} (${targetBPM} BPM)`,
          tags: [...(latestSample.tags || []), 'tempo-adjusted'],
          analysis: {
            ...latestSample.analysis,
            tempo: targetBPM
          }
        };
        
        console.log('🎵 Updating sample with new audio URL:', {
          sampleId: latestSample.id,
          oldUrl: latestSample.audioUrl?.substring(0, 50),
          newUrl: result.processedAudioUrl?.substring(0, 50),
          urlValid: !!result.processedAudioUrl
        });
        
        onUpdateSample?.(latestSample.id, updates);
        
        toast({
          title: "Tempo Adjusted",
          description: `Successfully changed from ${originalBPM} BPM to ${targetBPM} BPM`,
        });
        
        // Update original BPM for future calculations
        setOriginalBPM(targetBPM);
        
      } else {
        toast({
          title: "Tempo Adjustment Failed",
          description: result.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('Tempo adjustment error:', error);
      toast({
        title: "Processing Error",
        description: "Failed to adjust tempo",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetTempo = () => {
    if (uploadedSamples.length > 0) {
      const latestSample = uploadedSamples[uploadedSamples.length - 1];
      const originalTempo = latestSample.analysis?.tempo || 120;
      setTargetBPM(originalTempo);
      setInputValue(originalTempo.toString());
      onTempoChange?.(originalTempo);
    }
  };

  const getTempoDescription = (bpm: number) => {
    if (bpm < 60) return "Very Slow";
    if (bpm < 90) return "Slow";
    if (bpm < 110) return "Moderate";
    if (bpm < 130) return "Medium";
    if (bpm < 150) return "Fast";
    if (bpm < 180) return "Very Fast";
    return "Extremely Fast";
  };

  const getTempoColor = (bpm: number) => {
    if (bpm < 60) return "text-blue-400";
    if (bpm < 90) return "text-green-400";
    if (bpm < 110) return "text-yellow-400";
    if (bpm < 130) return "text-orange-400";
    if (bpm < 150) return "text-red-400";
    if (bpm < 180) return "text-purple-400";
    return "text-pink-400";
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-neon-purple" />
            Tempo Control
            <Badge variant="outline" className="text-xs">
              BPM Adjuster
            </Badge>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={resetTempo}
            className="text-studio-text-secondary hover:text-studio-text-primary"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Current Status */}
        {uploadedSamples.length > 0 && (
          <div className="bg-studio-surface-secondary/50 p-4 rounded-lg border border-neon-blue/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Current Track:</span>
              <span className="text-xs text-studio-text-secondary">
                {uploadedSamples[uploadedSamples.length - 1]?.name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Original BPM:</span>
              <Badge variant="outline" className="text-neon-blue">
                {originalBPM} BPM
              </Badge>
            </div>
          </div>
        )}

        {/* BPM Input and Display */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="bpm-input" className="text-sm font-medium">
              Target BPM
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="bpm-input"
                type="number"
                min="1"
                max="200"
                value={inputValue}
                onChange={handleInputChange}
                className="w-20 text-center"
              />
              <span className="text-xs text-studio-text-secondary">BPM</span>
            </div>
          </div>

          {/* Large BPM Display */}
          <div className="text-center space-y-2">
            <div className={`text-4xl font-bold ${getTempoColor(targetBPM)}`}>
              {targetBPM}
            </div>
            <div className="text-sm text-studio-text-secondary">
              {getTempoDescription(targetBPM)}
            </div>
          </div>
        </div>

        {/* BPM Slider */}
        <div className="space-y-4">
          <div className="px-2">
            <Slider
              value={[targetBPM]}
              onValueChange={handleSliderChange}
              min={1}
              max={200}
              step={1}
              className="w-full"
            />
          </div>
          
          {/* Scale markers */}
          <div className="flex justify-between text-xs text-studio-text-secondary px-2">
            <span>1</span>
            <span>50</span>
            <span>100</span>
            <span>150</span>
            <span>200</span>
          </div>
        </div>

        {/* Speed Factor Display */}
        {targetBPM !== originalBPM && (
          <div className="bg-studio-surface/50 p-3 rounded-lg border border-neon-green/30">
            <div className="flex items-center justify-between">
              <span className="text-sm">Speed Factor:</span>
              <Badge variant="outline" className="text-neon-green">
                {(targetBPM / originalBPM).toFixed(2)}x
              </Badge>
            </div>
            <div className="text-xs text-studio-text-secondary mt-1">
              {targetBPM > originalBPM ? 'Faster' : 'Slower'} than original
            </div>
          </div>
        )}

        {/* Apply Button */}
        <Button 
          onClick={applyTempoChange}
          disabled={isProcessing || uploadedSamples.length === 0 || targetBPM === originalBPM}
          className="w-full bg-neon-purple hover:bg-neon-purple/80 text-white font-medium"
        >
          {isProcessing ? (
            <>
              <Settings className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Apply Tempo Change
            </>
          )}
        </Button>

        {/* Quick Presets */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Quick Presets:</Label>
          <div className="grid grid-cols-4 gap-2">
            {[60, 90, 120, 140].map(bpm => (
              <Button
                key={bpm}
                variant="outline"
                size="sm"
                onClick={() => {
                  setTargetBPM(bpm);
                  setInputValue(bpm.toString());
                  onTempoChange?.(bpm);
                }}
                className="text-xs"
              >
                {bpm}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
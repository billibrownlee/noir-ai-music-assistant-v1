import React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApplyAudioEffects } from "@/hooks/useApplyAudioEffects";
import { AUDIO_EFFECTS } from "@/lib/audioEffects";
import { Music, RotateCcw, Volume2, Zap } from "lucide-react";
import { useGlobalAudio } from "@/hooks/useGlobalAudio";

interface AudioEffectsQuickPanelProps {
  uploadedSamples: any[];
  onUpdateSample?: (sampleId: string, updates: Record<string, unknown>) => void;
}

/**
 * Standalone pitch / tempo / reverse controls (isolated from the chat UI)
 * so heavy Web Audio work does not run in the same React subtree as voice chat.
 */
export const AudioEffectsQuickPanel: React.FC<AudioEffectsQuickPanelProps> = ({
  uploadedSamples,
  onUpdateSample,
}) => {
  const { currentTrack } = useGlobalAudio();
  const { applyAudioEffect, isProcessingAudio } = useApplyAudioEffects({
    onUpdateSample,
  });

  const [selectedId, setSelectedId] = React.useState<string>("");

  React.useEffect(() => {
    if (uploadedSamples.length === 0) {
      setSelectedId("");
      return;
    }
    if (!selectedId || !uploadedSamples.some((s) => s.id === selectedId)) {
      const preferred =
        uploadedSamples.find((s) => s.id === currentTrack?.id) ??
        uploadedSamples[uploadedSamples.length - 1];
      if (preferred) setSelectedId(preferred.id);
    }
  }, [uploadedSamples, currentTrack?.id, selectedId]);

  const selectedSample = uploadedSamples.find((s) => s.id === selectedId);

  const run = async (effect: string) => {
    if (!selectedSample) return;
    await applyAudioEffect(selectedSample, effect);
  };

  const disabled = uploadedSamples.length === 0 || isProcessingAudio;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Apply reverse, tempo, echo, and pitch to a sample here—separate from the chat so the
        rest of the app stays stable.
      </p>

      {uploadedSamples.length > 0 ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Sample to process</label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a sample" />
            </SelectTrigger>
            <SelectContent>
              {uploadedSamples.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name || "Untitled"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Upload audio in the Upload &amp; Library tab first.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => run(AUDIO_EFFECTS.REVERSE)}
          disabled={disabled}
          className="text-xs"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Reverse
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => run(AUDIO_EFFECTS.SPEED_UP)}
          disabled={disabled}
          className="text-xs"
        >
          <Zap className="w-3 h-3 mr-1" />
          Speed Up
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => run(AUDIO_EFFECTS.SLOW_DOWN)}
          disabled={disabled}
          className="text-xs"
        >
          <Music className="w-3 h-3 mr-1" />
          Slow Down
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => run(AUDIO_EFFECTS.ECHO)}
          disabled={disabled}
          className="text-xs"
        >
          <Volume2 className="w-3 h-3 mr-1" />
          Echo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => run(AUDIO_EFFECTS.PITCH_UP)}
          disabled={disabled}
          className="text-xs"
        >
          <Music className="w-3 h-3 mr-1" />
          Pitch Up
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => run(AUDIO_EFFECTS.PITCH_DOWN)}
          disabled={disabled}
          className="text-xs"
        >
          <Music className="w-3 h-3 mr-1" />
          Pitch Down
        </Button>
      </div>
    </div>
  );
};

export default AudioEffectsQuickPanel;

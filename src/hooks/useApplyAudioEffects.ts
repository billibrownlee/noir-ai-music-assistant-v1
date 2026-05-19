import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { AudioEffectsProcessor, AUDIO_EFFECTS } from "@/lib/audioEffects";
import { useGlobalAudio } from "@/hooks/useGlobalAudio";

export type ApplyAudioEffectFn = (sample: any, effect: string) => Promise<void>;

export interface UseApplyAudioEffectsOptions {
  onUpdateSample?: (sampleId: string, updates: Record<string, unknown>) => void;
  /** Optional chat / log line (e.g. AI assistant transcript) */
  onNotify?: (message: string) => void;
}

export function useApplyAudioEffects({
  onUpdateSample,
  onNotify,
}: UseApplyAudioEffectsOptions) {
  const { toast } = useToast();
  const audioEffectsRef = useRef(new AudioEffectsProcessor());
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const {
    currentTrack,
    currentTime,
    duration,
    isPlaying,
    playTrack,
    seekTo,
    getReversedAudio,
  } = useGlobalAudio();

  const applyAudioEffect = useCallback(
    async (sample: any, effect: string) => {
      let audioUrl = sample?.audioUrl;

      if (!audioUrl && sample?.file) {
        audioUrl = URL.createObjectURL(sample.file);
      }

      if (!audioUrl) {
        toast({
          title: "No Audio Available",
          description: "Cannot process audio without a valid file or URL",
          variant: "destructive",
        });
        return;
      }

      const wasPlaying = currentTrack?.id === sample.id && isPlaying;
      const currentPlaybackTime = wasPlaying ? currentTime : 0;
      const originalDuration = wasPlaying ? duration : 0;

      setIsProcessingAudio(true);
      if (wasPlaying) {
        onNotify?.(
          `🔄 Real-time processing: ${effect} while playing...\n\nProcessing audio at position ${Math.floor(currentPlaybackTime)}s. Playback will continue seamlessly!`
        );
      } else {
        onNotify?.(`🔄 Processing: ${effect}...`);
      }

      try {
        const audioEffects = audioEffectsRef.current;
        let result: { audioUrl: string; audioBlob: Blob };

        switch (effect) {
          case AUDIO_EFFECTS.REVERSE:
            if (wasPlaying) {
              const cachedReversed = await getReversedAudio(audioUrl);
              if (cachedReversed) {
                result = cachedReversed;
              } else {
                result = await audioEffects.reverseAudio(audioUrl);
              }
            } else {
              result = await audioEffects.reverseAudio(audioUrl);
            }
            break;
          case AUDIO_EFFECTS.SPEED_UP:
            result = await audioEffects.changeSpeed(audioUrl, 2.0);
            break;
          case AUDIO_EFFECTS.SLOW_DOWN:
            result = await audioEffects.changeSpeed(audioUrl, 0.5);
            break;
          case AUDIO_EFFECTS.ECHO:
            result = await audioEffects.addEcho(audioUrl);
            break;
          case AUDIO_EFFECTS.PITCH_UP:
            result = await audioEffects.changePitch(audioUrl, 1.5);
            break;
          case AUDIO_EFFECTS.PITCH_DOWN:
            result = await audioEffects.changePitch(audioUrl, 0.75);
            break;
          default:
            throw new Error(`Unknown effect: ${effect}`);
        }

        const updates = {
          audioUrl: result.audioUrl,
          name: `${sample.name} (${effect})`,
          tags: [...(sample.tags || []), "processed", effect],
          processHistory: [
            ...(sample.processHistory || []),
            {
              effect: effect,
              timestamp: new Date(),
              processingTime: Date.now(),
            },
          ],
        };

        if (onUpdateSample) {
          onUpdateSample(sample.id, updates);
        }

        // Calculate seek position (only relevant if was already playing)
        let seekPosition = 0;
        if (wasPlaying) {
          if (
            effect === AUDIO_EFFECTS.REVERSE &&
            originalDuration > 0 &&
            currentPlaybackTime > 0
          ) {
            seekPosition = Math.max(0, originalDuration - currentPlaybackTime);
          } else if (originalDuration > 0 && currentPlaybackTime > 0) {
            seekPosition = currentPlaybackTime;
          }
        }

        // Always play the processed audio so the effect is immediately audible
        setTimeout(async () => {
          try {
            await playTrack({
              id: sample.id,
              name: updates.name,
              audioUrl: result.audioUrl,
            });

            if (seekPosition > 0 && originalDuration > 0) {
              const attemptSeek = (attempt: number = 0) => {
                if (attempt > 5) return;
                setTimeout(() => {
                  try {
                    seekTo(seekPosition);
                  } catch {
                    if (attempt < 4) attemptSeek(attempt + 1);
                  }
                }, 100 * (attempt + 1));
              };
              attemptSeek();
            }
          } catch (playError) {
            console.error("Failed to play processed audio:", playError);
          }
        }, 100);

        onNotify?.(
          effect === AUDIO_EFFECTS.REVERSE && wasPlaying
            ? `✅ **REVERSE Applied!**\n\nAudio reversed and playing from equivalent position.`
            : `✅ **${effect.toUpperCase()} Applied!**\n\nNow playing the processed audio!`
        );

        toast({
          title: "🎛️ Effect Applied!",
          description: `${effect} applied — now playing processed audio.`,
        });
      } catch (error: unknown) {
        console.error("Audio effect error:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        onNotify?.(`❌ **Effect Failed**\n\nError applying ${effect}: ${errorMessage}`);

        toast({
          title: "Effect Failed",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsProcessingAudio(false);
      }
    },
    [
      currentTrack?.id,
      isPlaying,
      currentTime,
      duration,
      getReversedAudio,
      onNotify,
      onUpdateSample,
      playTrack,
      seekTo,
      toast,
    ]
  );

  return { applyAudioEffect, isProcessingAudio };
}

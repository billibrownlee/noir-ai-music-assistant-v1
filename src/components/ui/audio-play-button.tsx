import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { useGlobalAudio } from '@/hooks/useGlobalAudio';

interface AudioPlayButtonProps {
  audioUrl: string;
  trackName: string;
  trackId: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "neon";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  disabled?: boolean;
}

export const AudioPlayButton: React.FC<AudioPlayButtonProps> = ({
  audioUrl,
  trackName,
  trackId,
  variant = "ghost",
  size = "sm",
  className = "",
  disabled = false
}) => {
  const { currentTrack, isPlaying, playTrack } = useGlobalAudio();

  const isCurrentTrack = currentTrack?.id === trackId;
  const isCurrentlyPlaying = isCurrentTrack && isPlaying;

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Enhanced validation
    if (!audioUrl || audioUrl.trim() === '' || disabled) {
      console.warn('🔇 AudioPlayButton: Cannot play - missing/empty audioUrl or disabled:', { 
        audioUrl: audioUrl?.substring(0, 50) || 'undefined', 
        disabled, 
        trackName,
        trackId
      });
      return;
    }

    // Validate URL format
    try {
      new URL(audioUrl);
    } catch (urlError) {
      console.error('🔇 AudioPlayButton: Invalid URL format:', {
        audioUrl: audioUrl.substring(0, 50),
        trackName,
        error: urlError
      });
      return;
    }

    console.log('🎵 AudioPlayButton: Playing sample through selected audio output:', {
      trackName,
      trackId,
      audioUrl: audioUrl.substring(0, 50) + '...'
    });
    
    try {
      // Use global audio system which handles AirPods routing automatically
      await playTrack({
        id: trackId,
        name: trackName,
        audioUrl: audioUrl
      });
    } catch (playError) {
      console.error('🔇 AudioPlayButton: Failed to play track:', playError);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handlePlay}
      className={`${className} ${isCurrentlyPlaying ? 'text-neon-green' : ''}`}
      disabled={disabled || !audioUrl}
    >
      {isCurrentlyPlaying ? (
        <Pause className="w-4 h-4" />
      ) : (
        <Play className="w-4 h-4" />
      )}
    </Button>
  );
};
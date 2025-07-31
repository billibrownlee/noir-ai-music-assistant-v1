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
    
    if (!audioUrl || disabled) return;

    await playTrack({
      id: trackId,
      name: trackName,
      audioUrl: audioUrl
    });
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
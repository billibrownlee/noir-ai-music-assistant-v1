import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

interface AudioTrack {
  id: string;
  name: string;
  audioUrl: string;
  duration?: number;
  currentTime?: number;
}

interface GlobalAudioContextType {
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  playTrack: (track: AudioTrack) => Promise<void>;
  pauseTrack: () => void;
  stopTrack: () => void;
  setVolume: (volume: number) => void;
  seekTo: (time: number) => void;
}

const GlobalAudioContext = createContext<GlobalAudioContextType | undefined>(undefined);

export const GlobalAudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeUpdateRef = useRef<NodeJS.Timeout>();

  const createAudioElement = useCallback(async (track: AudioTrack) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    const audio = new Audio(track.audioUrl);
    audio.volume = volume;
    
    // Ensure audio uses default system output device
    audio.setAttribute('crossorigin', 'anonymous');
    
    // For better compatibility with AirPods and other Bluetooth devices
    try {
      // Request audio context if not already active (helps with Bluetooth devices)
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
      }
    } catch (error) {
      console.log('AudioContext setup info:', error);
    }
    
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
      console.log('Audio loaded - should play through default output device (AirPods if connected)');
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (timeUpdateRef.current) {
        clearInterval(timeUpdateRef.current);
      }
    });

    audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      setIsPlaying(false);
      setCurrentTrack(null);
    });

    // Add explicit play promise handling for better device compatibility
    audio.addEventListener('canplaythrough', () => {
      console.log('Audio ready to play through system output device');
    });

    audioRef.current = audio;
    return audio;
  }, [volume]);

  const playTrack = useCallback(async (track: AudioTrack) => {
    try {
      console.log('Playing track through system default output:', track.name);
      
      // If same track is playing, just pause/unpause
      if (currentTrack?.id === track.id && audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
          console.log('Paused audio');
        } else {
          await audioRef.current.play();
          setIsPlaying(true);
          console.log('Resumed audio through AirPods/default output');
        }
        return;
      }

      // Stop current track if playing
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }

      // Create new audio element for new track
      const audio = await createAudioElement(track);
      setCurrentTrack(track);
      
      // Play with explicit promise handling
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
        console.log('Audio playing through system output device (AirPods)');
      }
      
      setIsPlaying(true);

    } catch (error) {
      console.error('Error playing track:', error);
      console.log('If audio not playing through AirPods, check system audio settings');
      setIsPlaying(false);
    }
  }, [currentTrack, isPlaying, createAudioElement]);

  const pauseTrack = useCallback(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const stopTrack = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
      setCurrentTrack(null);
    }
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const value: GlobalAudioContextType = {
    currentTrack,
    isPlaying,
    volume,
    currentTime,
    duration,
    playTrack,
    pauseTrack,
    stopTrack,
    setVolume,
    seekTo
  };

  return (
    <GlobalAudioContext.Provider value={value}>
      {children}
    </GlobalAudioContext.Provider>
  );
};

export const useGlobalAudio = () => {
  const context = useContext(GlobalAudioContext);
  if (context === undefined) {
    throw new Error('useGlobalAudio must be used within a GlobalAudioProvider');
  }
  return context;
};
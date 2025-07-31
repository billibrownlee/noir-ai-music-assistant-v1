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
  setAudioOutputDevice: (deviceId: string) => void;
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
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>(() => {
    // Load saved device from localStorage
    return localStorage.getItem('preferredAudioDevice') || '';
  });

  const createAudioElement = useCallback(async (track: AudioTrack) => {
    try {
      // Clean up existing audio first
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.remove();
        audioRef.current = null;
      }

      // Validate track data
      if (!track?.audioUrl) {
        console.error('❌ Invalid track - no audioUrl:', track);
        throw new Error('Invalid audio track');
      }

      console.log('🎵 Creating audio element for:', track.name);
      const audio = new Audio();
      
      // Set volume safely
      try {
        audio.volume = Math.max(0, Math.min(1, volume));
      } catch (volumeError) {
        console.log('Volume setting failed, using default:', volumeError);
        audio.volume = 0.8;
      }
      
      // CRITICAL: Set audio output device FIRST (if supported)
      if (selectedAudioDevice && 'setSinkId' in audio) {
        try {
          await (audio as any).setSinkId(selectedAudioDevice);
          console.log('✅ Audio routed to device:', selectedAudioDevice);
        } catch (error) {
          console.log('⚠️ Device routing failed, using default:', error);
        }
      }
      
      // Set crossorigin for better compatibility
      audio.setAttribute('crossorigin', 'anonymous');
      audio.setAttribute('preload', 'metadata');
      
      // Enhanced audio context setup for better device compatibility
      try {
        if (typeof window !== 'undefined' && 'AudioContext' in window) {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log('✅ AudioContext resumed');
          }
        }
      } catch (contextError) {
        console.log('AudioContext setup warning:', contextError);
      }
      
      // BULLETPROOF EVENT LISTENERS
      const setupEventListeners = () => {
        // Metadata loaded
        audio.addEventListener('loadedmetadata', () => {
          try {
            const audioDuration = audio.duration || 0;
            setDuration(audioDuration);
            console.log('✅ Audio metadata loaded - Duration:', audioDuration);
          } catch (error) {
            console.log('Metadata processing error:', error);
            setDuration(0);
          }
        }, { once: true });

        // Time updates
        audio.addEventListener('timeupdate', () => {
          try {
            setCurrentTime(audio.currentTime || 0);
          } catch (error) {
            console.log('Time update error:', error);
          }
        });

        // Audio ended
        audio.addEventListener('ended', () => {
          try {
            setIsPlaying(false);
            setCurrentTime(0);
            if (timeUpdateRef.current) {
              clearInterval(timeUpdateRef.current);
            }
            console.log('✅ Audio playback ended cleanly');
          } catch (error) {
            console.log('End event error:', error);
          }
        });

        // Error handling
        audio.addEventListener('error', (e) => {
          console.error('❌ Audio playback error:', e);
          setIsPlaying(false);
          setCurrentTrack(null);
          
          // Don't crash on errors - just reset
          try {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.src = '';
            }
          } catch (cleanupError) {
            console.log('Error cleanup warning:', cleanupError);
          }
        });

        // Can play through (ready to play)
        audio.addEventListener('canplaythrough', () => {
          console.log('✅ Audio ready to play through selected output');
        }, { once: true });
      };

      setupEventListeners();
      
      // Set the source LAST after all setup
      audio.src = track.audioUrl;
      audio.load();
      
      audioRef.current = audio;
      return audio;
      
    } catch (error) {
      console.error('❌ Failed to create audio element:', error);
      setIsPlaying(false);
      setCurrentTrack(null);
      throw error;
    }
  }, [volume, selectedAudioDevice]);
  const playTrack = useCallback(async (track: AudioTrack) => {
    try {
      console.log('🎵 Playing track through selected output:', track.name);
      console.log('🎧 Selected device:', selectedAudioDevice || 'System Default');
      
      // If same track is playing, just pause/unpause
      if (currentTrack?.id === track.id && audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
          console.log('Paused audio');
        } else {
          await audioRef.current.play();
          setIsPlaying(true);
          console.log('Resumed audio through selected output');
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
        console.log('🔊 Audio now playing through selected output!');
      }
      
      setIsPlaying(true);

    } catch (error) {
      console.error('❌ Error playing track:', error);
      console.log('💡 Check your audio output device settings');
      setIsPlaying(false);
    }
  }, [currentTrack, isPlaying, createAudioElement, selectedAudioDevice]);

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

  const setAudioOutputDevice = useCallback((deviceId: string) => {
    setSelectedAudioDevice(deviceId);
    // Save to localStorage for persistence
    localStorage.setItem('preferredAudioDevice', deviceId);
    console.log('💾 AirPods connection saved! Device:', deviceId);
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
    seekTo,
    setAudioOutputDevice
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
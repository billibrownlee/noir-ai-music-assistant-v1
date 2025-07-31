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
      // Clean up existing audio first with comprehensive cleanup
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.src = '';
          audioRef.current.load(); // Force cleanup
          audioRef.current.remove();
        } catch (cleanupError) {
          console.log('Audio cleanup warning:', cleanupError);
        }
        audioRef.current = null;
      }

      // Validate track data
      if (!track?.audioUrl) {
        console.error('❌ Invalid track - no audioUrl:', track);
        throw new Error('Invalid audio track');
      }

      console.log('🎵 Creating optimized audio element for:', track.name);
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
      
      // Optimize attributes for large files
      audio.setAttribute('crossorigin', 'anonymous');
      audio.setAttribute('preload', 'metadata'); // Only metadata for large files
      audio.setAttribute('controlsList', 'nodownload noremoteplayback');
      
      // Additional optimizations for stability
      audio.loop = false;
      audio.autoplay = false;
      
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

        // Enhanced error handling for large files
        audio.addEventListener('error', (e) => {
          const audioElement = e.target as HTMLAudioElement;
          const error = audioElement.error;
          
          console.error('❌ Audio playback error:', {
            code: error?.code,
            message: error?.message,
            track: track.name
          });
          
          // Handle specific error codes
          let errorAction = 'Reset audio';
          if (error?.code === 4) errorAction = 'Unsupported format';
          if (error?.code === 3) errorAction = 'Corrupted file';
          if (error?.code === 2) errorAction = 'Network error';
          
          console.log('🔧 Error action:', errorAction);
          
          setIsPlaying(false);
          setCurrentTrack(null);
          
          // Graceful cleanup without crashing
          try {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
              audioRef.current.src = '';
              audioRef.current.load();
            }
          } catch (cleanupError) {
            console.log('Error cleanup warning:', cleanupError);
          }
        });

        // Handle stalling for large files
        audio.addEventListener('stalled', () => {
          console.log('⚠️ Audio stalled (large file) - continuing...');
          // Don't error out, large files may stall briefly
        });

        // Handle waiting events
        audio.addEventListener('waiting', () => {
          console.log('⏳ Audio buffering (large file) - please wait...');
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
      
      // Enhanced play with large file handling
      try {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
          console.log('🔊 Audio now playing through selected output!');
        }
        setIsPlaying(true);
      } catch (playError) {
        console.error('❌ Play promise failed:', playError);
        
        // Try alternative playback method for large files
        setTimeout(() => {
          try {
            audio.load();
            audio.play().then(() => {
              setIsPlaying(true);
              console.log('🔊 Audio started after retry');
            }).catch(retryError => {
              console.error('❌ Retry play failed:', retryError);
              setIsPlaying(false);
            });
          } catch (retryError) {
            console.error('❌ Audio retry setup failed:', retryError);
            setIsPlaying(false);
          }
        }, 100);
      }

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
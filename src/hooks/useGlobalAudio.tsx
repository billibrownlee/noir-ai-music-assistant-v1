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
  getCurrentTime: () => number;
  getDuration: () => number;
  getReversedAudio: (audioUrl: string) => Promise<{ audioUrl: string; audioBlob: Blob } | null>;
  preloadReversedAudio: (audioUrl: string) => Promise<void>;
}

const GlobalAudioContext = createContext<GlobalAudioContextType | undefined>(undefined);

export const GlobalAudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(() => {
    try {
      const saved = localStorage.getItem('audioVolume');
      return saved ? Math.max(0, Math.min(1, parseFloat(saved))) : 0.8;
    } catch {
      return 0.8;
    }
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);
  const reversedAudioCache = useRef<Map<string, { audioUrl: string; audioBlob: Blob }>>(new Map());
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>(() => {
    try {
      return localStorage.getItem('preferredAudioDevice') || '';
    } catch {
      return '';
    }
  });

  // Cleanup function to prevent memory leaks
  React.useEffect(() => {
    return () => {
      try {
        // Clear time update interval
        if (timeUpdateRef.current) {
          clearInterval(timeUpdateRef.current);
          timeUpdateRef.current = null;
        }
        
        // Cleanup audio element
        if (audioRef.current) {
          try {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current.load();
            if (audioRef.current.parentNode) {
              audioRef.current.remove();
            }
          } catch (e) {
            // Ignore cleanup errors
          }
          audioRef.current = null;
        }
        
        // Run all registered cleanup functions
        cleanupRef.current.forEach(cleanup => {
          try {
            cleanup();
          } catch (e) {
            // Ignore cleanup errors
          }
        });
        cleanupRef.current = [];
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, []);

  const createAudioElement = useCallback(async (track: AudioTrack | null | undefined): Promise<HTMLAudioElement> => {
    if (!track) {
      throw new Error('Cannot create audio element: track is null or undefined');
    }

    try {
      // Clean up existing audio first with comprehensive cleanup
      if (audioRef.current) {
        try {
          const oldAudio = audioRef.current;
          oldAudio.pause();
          oldAudio.currentTime = 0;
          oldAudio.src = '';
          oldAudio.load();
          if (oldAudio.parentNode) {
            oldAudio.remove();
          }
          // Revoke any blob URLs
          try {
            if (oldAudio.src && oldAudio.src.startsWith('blob:')) {
              URL.revokeObjectURL(oldAudio.src);
            }
          } catch (e) {
            // Ignore URL revocation errors
          }
        } catch (cleanupError) {
          console.warn('Audio cleanup warning:', cleanupError);
        }
        audioRef.current = null;
      }

      // Enhanced validation for track data with comprehensive checks
      if (!track) {
        throw new Error('Track is null or undefined');
      }
      
      if (!track.id || typeof track.id !== 'string') {
        throw new Error('Track ID is missing or invalid');
      }
      
      if (!track.name || typeof track.name !== 'string') {
        throw new Error('Track name is missing or invalid');
      }
      
      if (!track.audioUrl || typeof track.audioUrl !== 'string' || track.audioUrl.trim() === '') {
        console.error('❌ Invalid track - missing or empty audioUrl:', {
          track: track?.name || 'Unknown',
          audioUrl: track?.audioUrl || 'undefined',
          id: track?.id || 'no-id'
        });
        throw new Error(`Cannot play audio: Invalid audio URL for track "${track?.name || 'Unknown'}"`);
      }

      // Validate URL format - handle both blob URLs and HTTP URLs
      let isValidUrl = false;
      try {
        if (track.audioUrl.startsWith('blob:') || track.audioUrl.startsWith('data:')) {
          isValidUrl = true;
        } else {
          new URL(track.audioUrl);
          isValidUrl = true;
        }
      } catch (urlError) {
        console.error('❌ Invalid audio URL format:', track.audioUrl);
        throw new Error(`Cannot play audio: Invalid URL format for track "${track?.name || 'Unknown'}"`);
      }
      
      if (!isValidUrl) {
        throw new Error(`Invalid audio URL for track "${track.name}"`);
      }

      console.log('🎵 Creating optimized audio element for:', track.name);
      
      // Create audio element with error handling
      let audio: HTMLAudioElement;
      try {
        audio = new Audio();
        if (!audio) {
          throw new Error('Failed to create Audio element');
        }
      } catch (audioError) {
        console.error('❌ Failed to create Audio element:', audioError);
        throw new Error('Browser does not support Audio API');
      }
      
      // Set volume safely with validation
      try {
        const safeVolume = typeof volume === 'number' && !isNaN(volume) 
          ? Math.max(0, Math.min(1, volume)) 
          : 0.8;
        audio.volume = safeVolume;
      } catch (volumeError) {
        console.warn('Volume setting failed, using default:', volumeError);
        try {
          audio.volume = 0.8;
        } catch (e) {
          // If volume setting completely fails, continue anyway
        }
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
      
      // BULLETPROOF EVENT LISTENERS with proper cleanup tracking
      const setupEventListeners = () => {
        const handlers: Array<{ event: string; handler: EventListener; options?: boolean | AddEventListenerOptions }> = [];
        
        // Metadata loaded
        const metadataHandler = () => {
          try {
            if (!audio || audio.readyState === 0) return;
            const audioDuration = (audio.duration && isFinite(audio.duration) && audio.duration > 0) ? audio.duration : 0;
            setDuration(audioDuration);
            console.log('✅ Audio metadata loaded - Duration:', audioDuration);
          } catch (error) {
            console.warn('Metadata processing error:', error);
            setDuration(0);
          }
        };
        audio.addEventListener('loadedmetadata', metadataHandler, { once: true });
        handlers.push({ event: 'loadedmetadata', handler: metadataHandler, options: { once: true } });

        // Time updates with throttling to prevent performance issues
        let lastUpdateTime = 0;
        const timeUpdateHandler = () => {
          try {
            if (!audio) return;
            const now = Date.now();
            // Throttle updates to every 100ms
            if (now - lastUpdateTime < 100) return;
            lastUpdateTime = now;
            
            const currentTime = (audio.currentTime && isFinite(audio.currentTime) && audio.currentTime >= 0) 
              ? audio.currentTime 
              : 0;
            setCurrentTime(currentTime);
          } catch (error) {
            console.warn('Time update error:', error);
          }
        };
        audio.addEventListener('timeupdate', timeUpdateHandler);
        handlers.push({ event: 'timeupdate', handler: timeUpdateHandler });

        // Audio ended
        const endedHandler = () => {
          try {
            setIsPlaying(false);
            setCurrentTime(0);
            if (timeUpdateRef.current) {
              clearInterval(timeUpdateRef.current);
              timeUpdateRef.current = null;
            }
            console.log('✅ Audio playback ended cleanly');
          } catch (error) {
            console.warn('End event error:', error);
          }
        };
        audio.addEventListener('ended', endedHandler);
        handlers.push({ event: 'ended', handler: endedHandler });

        // Enhanced error handling for large files
        const errorHandler = (e: Event) => {
          try {
            const audioElement = e.target as HTMLAudioElement;
            const error = audioElement?.error;
            
            console.error('❌ Audio playback error:', {
              code: error?.code,
              message: error?.message,
              track: track?.name || 'Unknown'
            });
            
            // Handle specific error codes
            let errorAction = 'Reset audio';
            if (error?.code === 4) errorAction = 'Unsupported format';
            if (error?.code === 3) errorAction = 'Corrupted file';
            if (error?.code === 2) errorAction = 'Network error';
            
            console.warn('🔧 Error action:', errorAction);
            
            setIsPlaying(false);
            setCurrentTrack(null);
            
            // Graceful cleanup without crashing
            try {
              if (audioRef.current) {
                const currentAudio = audioRef.current;
                currentAudio.pause();
                currentAudio.currentTime = 0;
                currentAudio.src = '';
                currentAudio.load();
              }
            } catch (cleanupError) {
              console.warn('Error cleanup warning:', cleanupError);
            }
          } catch (handlerError) {
            console.error('Error in error handler:', handlerError);
            // Still try to stop playback
            setIsPlaying(false);
            setCurrentTrack(null);
          }
        };
        audio.addEventListener('error', errorHandler);
        handlers.push({ event: 'error', handler: errorHandler });

        // Handle stalling for large files
        const stalledHandler = () => {
          try {
            console.log('⚠️ Audio stalled (large file) - continuing...');
            // Don't error out, large files may stall briefly
          } catch (e) {
            // Ignore
          }
        };
        audio.addEventListener('stalled', stalledHandler);
        handlers.push({ event: 'stalled', handler: stalledHandler });

        // Handle waiting events
        const waitingHandler = () => {
          try {
            console.log('⏳ Audio buffering (large file) - please wait...');
          } catch (e) {
            // Ignore
          }
        };
        audio.addEventListener('waiting', waitingHandler);
        handlers.push({ event: 'waiting', handler: waitingHandler });

        // Can play through (ready to play)
        const canPlayThroughHandler = () => {
          try {
            console.log('✅ Audio ready to play through selected output');
          } catch (e) {
            // Ignore
          }
        };
        audio.addEventListener('canplaythrough', canPlayThroughHandler, { once: true });
        handlers.push({ event: 'canplaythrough', handler: canPlayThroughHandler, options: { once: true } });
        
        // Register cleanup function to remove all listeners
        cleanupRef.current.push(() => {
          handlers.forEach(({ event, handler, options }) => {
            try {
              audio.removeEventListener(event, handler, options as any);
            } catch (e) {
              // Ignore cleanup errors
            }
          });
        });
      };

      setupEventListeners();
      
      // Set the source LAST after all setup with error handling
      try {
        audio.src = track.audioUrl;
        audio.load();
      } catch (srcError) {
        console.error('❌ Failed to set audio source:', srcError);
        throw new Error(`Failed to load audio source: ${srcError instanceof Error ? srcError.message : 'Unknown error'}`);
      }
      
      audioRef.current = audio;
      return audio;
      
    } catch (error) {
      console.error('❌ Failed to create audio element:', error);
      setIsPlaying(false);
      setCurrentTrack(null);
      // Clean up any partial audio element
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
          audioRef.current = null;
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create audio element: ${errorMessage}`);
    }
  }, [volume, selectedAudioDevice]);
  
  const playTrack = useCallback(async (track: AudioTrack | null | undefined): Promise<void> => {
    if (!track) {
      console.error('❌ Cannot play track - track is null or undefined');
      return;
    }
    
    try {
      // Enhanced validation for empty or invalid URLs
      if (!track.audioUrl || typeof track.audioUrl !== 'string' || track.audioUrl.trim() === '') {
        console.error('❌ Cannot play track - empty audioUrl:', {
          name: track.name || 'Unknown',
          id: track.id || 'Unknown',
          audioUrl: track.audioUrl || 'undefined'
        });
        return;
      }
      
      if (!track.id || typeof track.id !== 'string') {
        console.error('❌ Cannot play track - invalid track ID');
        return;
      }
      
      if (!track.name || typeof track.name !== 'string') {
        console.error('❌ Cannot play track - invalid track name');
        return;
      }

      console.log('🎵 Playing track through selected output:', track.name);
      console.log('🎧 Selected device:', selectedAudioDevice || 'System Default');
      console.log('🔗 Audio URL:', track.audioUrl?.substring(0, 100) + '...');
      
      // Check if this is the same track with the same URL (for pause/unpause)
      // If the URL changed (e.g., after processing), treat it as a new track
      const isSameTrack = currentTrack?.id === track.id;
      const isSameUrl = currentTrack?.audioUrl === track.audioUrl;
      
      // If same track with same URL is playing, just pause/unpause
      if (isSameTrack && isSameUrl && audioRef.current) {
        try {
          if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            console.log('Paused audio');
          } else {
            const playPromise = audioRef.current.play();
            if (playPromise) {
              await playPromise.catch(err => {
                console.warn('Play promise rejected:', err);
                setIsPlaying(false);
              });
            }
            setIsPlaying(true);
            console.log('Resumed audio through selected output');
          }
        } catch (pauseResumeError) {
          console.error('❌ Error pausing/resuming audio:', pauseResumeError);
          setIsPlaying(false);
        }
        return;
      }
      
      // If same track ID but different URL (processed version), switch to new URL
      if (isSameTrack && !isSameUrl) {
        console.log('🔄 Same track but new URL detected - switching to processed version');
      }

      // Stop current track if playing with error handling
      if (audioRef.current) {
        try {
          const currentAudio = audioRef.current;
          currentAudio.pause();
          currentAudio.currentTime = 0;
        } catch (stopError) {
          console.warn('Error stopping current audio:', stopError);
        }
        setIsPlaying(false);
      }

      // Create new audio element for new track with error handling
      let audio: HTMLAudioElement;
      try {
        audio = await createAudioElement(track);
        if (!audio) {
          throw new Error('createAudioElement returned null');
        }
      } catch (createError) {
        console.error('❌ Failed to create audio element:', createError);
        setIsPlaying(false);
        setCurrentTrack(null);
        return;
      }
      
      try {
        setCurrentTrack(track);
        
        // Preload reversed audio in background for instant switching
        if (track.audioUrl) {
          preloadReversedAudio(track.audioUrl).catch(err => {
            console.warn('Background preload failed (non-critical):', err);
          });
        }
      } catch (setTrackError) {
        console.error('❌ Failed to set current track:', setTrackError);
        // Continue anyway
      }
      
      // Enhanced play with large file handling and multiple retry attempts
      let playAttempts = 0;
      const maxPlayAttempts = 3;
      
      const attemptPlay = async (): Promise<boolean> => {
        try {
          if (!audio) return false;
          
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            await playPromise;
            console.log('🔊 Audio now playing through selected output!');
            setIsPlaying(true);
            return true;
          }
          setIsPlaying(true);
          return true;
        } catch (playError: any) {
          playAttempts++;
          console.warn(`❌ Play attempt ${playAttempts} failed:`, playError);
          
          if (playAttempts < maxPlayAttempts) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 200 * playAttempts));
            try {
              audio.load();
              return await attemptPlay();
            } catch (retryError) {
              console.error('❌ Retry play failed:', retryError);
            }
          }
          
          setIsPlaying(false);
          return false;
        }
      };
      
      const playSuccess = await attemptPlay();
      if (!playSuccess) {
        console.error('❌ All play attempts failed');
        setIsPlaying(false);
      }

    } catch (error) {
      console.error('❌ Error playing track:', error);
      console.log('💡 Check your audio output device settings');
      setIsPlaying(false);
      setCurrentTrack(null);
      
      // Clean up on error
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
  }, [currentTrack, isPlaying, createAudioElement, selectedAudioDevice]);

  const pauseTrack = useCallback(() => {
    try {
      if (audioRef.current && isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('❌ Error pausing track:', error);
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const stopTrack = useCallback(() => {
    try {
      if (audioRef.current) {
        const currentAudio = audioRef.current;
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setIsPlaying(false);
        setCurrentTime(0);
        setCurrentTrack(null);
      }
    } catch (error) {
      console.error('❌ Error stopping track:', error);
      setIsPlaying(false);
      setCurrentTime(0);
      setCurrentTrack(null);
    }
  }, []);

  const setVolume = useCallback((newVolume: number | null | undefined) => {
    try {
      // Validate volume
      if (typeof newVolume !== 'number' || isNaN(newVolume)) {
        console.warn('Invalid volume value:', newVolume);
        return;
      }
      
      const safeVolume = Math.max(0, Math.min(1, newVolume));
      setVolumeState(safeVolume);
      
      // Save to localStorage
      try {
        localStorage.setItem('audioVolume', safeVolume.toString());
      } catch (storageError) {
        console.warn('Failed to save volume to localStorage:', storageError);
      }
      
      if (audioRef.current) {
        try {
          audioRef.current.volume = safeVolume;
        } catch (volumeError) {
          console.warn('Failed to set audio volume:', volumeError);
        }
      }
    } catch (error) {
      console.error('❌ Error setting volume:', error);
    }
  }, []);

  const seekTo = useCallback((time: number | null | undefined) => {
    try {
      if (typeof time !== 'number' || isNaN(time) || time < 0) {
        console.warn('Invalid seek time:', time);
        return;
      }
      
      if (audioRef.current) {
        const currentAudio = audioRef.current;
        const safeTime = Math.max(0, Math.min(time, currentAudio.duration || 0));
        currentAudio.currentTime = safeTime;
        setCurrentTime(safeTime);
      }
    } catch (error) {
      console.error('❌ Error seeking:', error);
    }
  }, []);

  const setAudioOutputDevice = useCallback((deviceId: string | null | undefined) => {
    try {
      const safeDeviceId = deviceId && typeof deviceId === 'string' ? deviceId : '';
      setSelectedAudioDevice(safeDeviceId);
      
      // Save to localStorage for persistence
      try {
        if (safeDeviceId) {
          localStorage.setItem('preferredAudioDevice', safeDeviceId);
        } else {
          localStorage.removeItem('preferredAudioDevice');
        }
        console.log('💾 Audio device saved! Device:', safeDeviceId || 'System Default');
      } catch (storageError) {
        console.warn('Failed to save device to localStorage:', storageError);
      }
    } catch (error) {
      console.error('❌ Error setting audio output device:', error);
    }
  }, []);

  const getCurrentTime = useCallback(() => {
    try {
      if (audioRef.current) {
        return audioRef.current.currentTime || 0;
      }
      return currentTime;
    } catch {
      return currentTime;
    }
  }, [currentTime]);

  const getDuration = useCallback(() => {
    try {
      if (audioRef.current) {
        return audioRef.current.duration || 0;
      }
      return duration;
    } catch {
      return duration;
    }
  }, [duration]);

  // Preload reversed audio in background for instant switching
  const preloadReversedAudio = useCallback(async (audioUrl: string) => {
    try {
      if (!audioUrl || reversedAudioCache.current.has(audioUrl)) {
        return; // Already cached or invalid
      }

      console.log('🔄 Preloading reversed audio in background...');
      
      // Import AudioEffectsProcessor dynamically
      const { AudioEffectsProcessor } = await import('@/lib/audioEffects');
      const audioEffects = new AudioEffectsProcessor();
      
      // Process in background (non-blocking)
      audioEffects.reverseAudio(audioUrl)
        .then((result) => {
          reversedAudioCache.current.set(audioUrl, result);
          console.log('✅ Reversed audio preloaded and cached');
        })
        .catch((error) => {
          console.warn('⚠️ Failed to preload reversed audio (non-critical):', error);
        });
    } catch (error) {
      console.warn('⚠️ Error preloading reversed audio:', error);
    }
  }, []);

  // Get cached reversed audio or return null
  const getReversedAudio = useCallback(async (audioUrl: string): Promise<{ audioUrl: string; audioBlob: Blob } | null> => {
    try {
      // Check cache first
      const cached = reversedAudioCache.current.get(audioUrl);
      if (cached) {
        console.log('✅ Using cached reversed audio - INSTANT!');
        return cached;
      }

      // If not cached, process it (this will take time but won't crash)
      console.log('🔄 Reversed audio not cached, processing now...');
      const { AudioEffectsProcessor } = await import('@/lib/audioEffects');
      const audioEffects = new AudioEffectsProcessor();
      const result = await audioEffects.reverseAudio(audioUrl);
      reversedAudioCache.current.set(audioUrl, result);
      return result;
    } catch (error) {
      console.error('❌ Error getting reversed audio:', error);
      return null;
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
    seekTo,
    setAudioOutputDevice,
    getCurrentTime,
    getDuration,
    getReversedAudio,
    preloadReversedAudio
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
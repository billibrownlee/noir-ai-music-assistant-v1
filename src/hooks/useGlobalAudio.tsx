import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => {
    try { return Math.max(0, Math.min(1, parseFloat(localStorage.getItem('audioVolume') || '0.8'))); } catch { return 0.8; }
  });

  // Single persistent audio element for the app lifetime — avoids per-track
  // creation which breaks browser autoplay policy when play() is called from
  // async code (gesture context expires during audio processing).
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reversedAudioCache = useRef(new Map<string, { audioUrl: string; audioBlob: Blob }>());

  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () => setDuration(isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      const err = audio.error;
      console.error('Audio element error:', err?.code, err?.message);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.src = '';
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const playTrack = useCallback(async (track: AudioTrack | null | undefined): Promise<void> => {
    if (!track?.audioUrl || !track?.id || !track?.name) return;

    const audio = audioRef.current;
    if (!audio) return;

    // Same URL already loaded — just resume if paused
    if (audio.src === track.audioUrl) {
      setCurrentTrack(track);
      if (audio.paused) {
        try { await audio.play(); } catch (e) { console.error('Resume failed:', e); }
      }
      return;
    }

    // New URL — swap src and play
    audio.pause();
    audio.src = track.audioUrl;
    audio.load();
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(0);

    try {
      await audio.play();
    } catch (err) {
      // NotAllowedError: user hasn't interacted yet. GlobalAudioBar will show
      // paused so user can click play manually.
      console.warn('audio.play() blocked (autoplay policy) — user can click play:', err);
      setIsPlaying(false);
    }
  }, []);

  const pauseTrack = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const stopTrack = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setCurrentTrack(null);
  }, []);

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !isFinite(time)) return;
    const safeTime = Math.max(0, Math.min(time, audio.duration || 0));
    audio.currentTime = safeTime;
    setCurrentTime(safeTime);
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    const v = Math.max(0, Math.min(1, newVolume));
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
    try { localStorage.setItem('audioVolume', v.toString()); } catch {}
  }, []);

  const setAudioOutputDevice = useCallback((deviceId: string) => {
    const id = deviceId || '';
    try {
      if (id) localStorage.setItem('preferredAudioDevice', id);
      else localStorage.removeItem('preferredAudioDevice');
    } catch {}
    const audio = audioRef.current;
    if (audio && 'setSinkId' in audio && id) {
      (audio as any).setSinkId(id).catch(console.warn);
    }
  }, []);

  const getCurrentTime = useCallback(() => audioRef.current?.currentTime ?? currentTime, [currentTime]);
  const getDuration = useCallback(() => audioRef.current?.duration ?? duration, [duration]);

  const getReversedAudio = useCallback(async (audioUrl: string) => {
    try {
      const cached = reversedAudioCache.current.get(audioUrl);
      if (cached) return cached;
      const { AudioEffectsProcessor } = await import('@/lib/audioEffects');
      const result = await new AudioEffectsProcessor().reverseAudio(audioUrl);
      reversedAudioCache.current.set(audioUrl, result);
      return result;
    } catch { return null; }
  }, []);

  const preloadReversedAudio = useCallback(async (audioUrl: string) => {
    if (!audioUrl || reversedAudioCache.current.has(audioUrl)) return;
    try {
      const { AudioEffectsProcessor } = await import('@/lib/audioEffects');
      const result = await new AudioEffectsProcessor().reverseAudio(audioUrl);
      reversedAudioCache.current.set(audioUrl, result);
    } catch {}
  }, []);

  return (
    <GlobalAudioContext.Provider value={{
      currentTrack, isPlaying, volume, currentTime, duration,
      playTrack, pauseTrack, stopTrack, setVolume, seekTo,
      setAudioOutputDevice, getCurrentTime, getDuration,
      getReversedAudio, preloadReversedAudio,
    }}>
      {children}
    </GlobalAudioContext.Provider>
  );
};

export const useGlobalAudio = () => {
  const context = useContext(GlobalAudioContext);
  if (context === undefined) throw new Error('useGlobalAudio must be used within a GlobalAudioProvider');
  return context;
};

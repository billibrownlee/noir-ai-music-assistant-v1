import type { AudioAnalysis } from '@/lib/audioAnalyzer';

export interface AudioSample {
  id: string;
  name: string;
  genre: string;
  bpm?: number;
  key?: string;
  tags: string[];
  file?: File;
  audioUrl?: string;
  duration?: number;
  uploadProgress?: number;
  isPlaying?: boolean;
  analysis?: AudioAnalysis;
  songId?: { title: string; artist: string; album?: string } | null;
}

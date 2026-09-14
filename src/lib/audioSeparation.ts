export interface AudioStem {
  id: string;
  name: string;
  type: 'vocals' | 'drums' | 'bass' | 'melody' | 'other';
  audioUrl: string;
  waveformData: number[];
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  effects: {
    reverb: number;
    delay: number;
    distortion: number;
    filter: {
      type: 'lowpass' | 'highpass' | 'bandpass';
      frequency: number;
      resonance: number;
    };
    eq: {
      low: number;
      mid: number;
      high: number;
    };
  };
  originalFile?: File;
}

export interface SeparatedAudio {
  id: string;
  originalFileName: string;
  stems: AudioStem[];
  separationQuality: number;
  processingTime: number;
}

export class AudioSeparationEngine {
  private isProcessing: boolean = false;
  private audioContext: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  async separateAudio(file: File, onProgress?: (progress: number, stage: string) => void): Promise<SeparatedAudio> {
    if (this.isProcessing) {
      throw new Error('Already processing another file');
    }

    // Safety check: Skip separation for very large files
    const MAX_FILE_SIZE = 75 * 1024 * 1024; // 75MB limit
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large for separation (max ${MAX_FILE_SIZE / (1024 * 1024)}MB)`);
    }

    this.isProcessing = true;

    try {
      const startTime = Date.now();
      
      // Stage 1: Load and decode audio with error handling
      onProgress?.(10, 'Loading audio file...');
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await this.loadAudioFile(file);
      } catch (error) {
        console.error('Failed to load audio file:', error);
        throw new Error('Failed to load audio file. Please ensure the file is a valid audio format.');
      }
      
      // Stage 2: Preprocess audio with error handling
      onProgress?.(20, 'Preprocessing audio...');
      let preprocessedData: any;
      try {
        preprocessedData = await this.preprocessAudio(audioBuffer);
      } catch (error) {
        console.error('Preprocessing failed:', error);
        // Continue with raw audio buffer
        preprocessedData = audioBuffer;
      }
      
      // Stage 3: Vocal separation with error handling
      onProgress?.(40, 'Separating vocals...');
      let vocalStem: AudioStem | null = null;
      try {
        vocalStem = await this.separateVocals(preprocessedData);
      } catch (error) {
        console.warn('Vocal separation failed:', error);
      }
      
      // Stage 4: Drum separation with error handling
      onProgress?.(55, 'Separating drums...');
      let drumStems: AudioStem[] = [];
      try {
        drumStems = await this.separateDrums(preprocessedData);
      } catch (error) {
        console.warn('Drum separation failed:', error);
      }
      
      // Stage 5: Bass separation with error handling
      onProgress?.(70, 'Separating bass...');
      let bassStem: AudioStem | null = null;
      try {
        bassStem = await this.separateBass(preprocessedData);
      } catch (error) {
        console.warn('Bass separation failed:', error);
      }
      
      // Stage 6: Melody separation with error handling
      onProgress?.(85, 'Separating melody...');
      let melodyStem: AudioStem | null = null;
      try {
        melodyStem = await this.separateMelody(preprocessedData);
      } catch (error) {
        console.warn('Melody separation failed:', error);
      }
      
      // Stage 7: Finalize - ensure we have at least some stems
      onProgress?.(95, 'Finalizing stems...');
      const stems = [vocalStem, ...drumStems, bassStem, melodyStem].filter(Boolean) as AudioStem[];
      
      // If no stems were created, throw error
      if (stems.length === 0) {
        throw new Error('Failed to separate any stems from the audio');
      }
      
      onProgress?.(100, 'Complete!');
      
      const processingTime = Date.now() - startTime;
      
      return {
        id: `sep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        originalFileName: file.name,
        stems,
        separationQuality: this.calculateSeparationQuality(stems),
        processingTime
      };
      
    } catch (error) {
      console.error('Audio separation failed:', error);
      throw error; // Re-throw to let caller handle
    } finally {
      this.isProcessing = false;
    }
  }

  private async loadAudioFile(file: File): Promise<AudioBuffer> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Empty file');
      }

      const audioContext = this.getAudioContext();

      // Resume context if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('Failed to decode audio');
      }
      
      return audioBuffer;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'EncodingError') {
        throw new Error('Unsupported audio format. Please use WAV, MP3, or OGG format.');
      }
      throw error;
    }
  }

  private async preprocessAudio(audioBuffer: AudioBuffer): Promise<Float32Array> {
    // Convert to mono and normalize
    const channelData = audioBuffer.getChannelData(0);
    const normalizedData = new Float32Array(channelData.length);
    
    // Find peak for normalization
    let peak = 0;
    for (let i = 0; i < channelData.length; i++) {
      const abs = Math.abs(channelData[i]);
      if (abs > peak) peak = abs;
    }
    
    const normalizationFactor = peak > 0 ? 0.95 / peak : 1;
    
    for (let i = 0; i < channelData.length; i++) {
      normalizedData[i] = channelData[i] * normalizationFactor;
    }
    
    return normalizedData;
  }

  private async separateVocals(audioData: Float32Array): Promise<AudioStem | null> {
    // Simulate vocal separation using spectral analysis
    // In a real implementation, this would use a trained ML model like Spleeter or Demucs
    
    const vocalData = this.simulateVocalSeparation(audioData);
    const audioUrl = this.createAudioUrl(vocalData);
    const waveformData = this.generateWaveformData(vocalData);
    
    return {
      id: `vocal_${Date.now()}`,
      name: 'Vocals',
      type: 'vocals',
      audioUrl,
      waveformData,
      volume: 100,
      pan: 0,
      muted: false,
      soloed: false,
      effects: {
        reverb: 20,
        delay: 10,
        distortion: 0,
        filter: {
          type: 'highpass',
          frequency: 80,
          resonance: 0.5
        },
        eq: {
          low: 0,
          mid: 2,
          high: 1
        }
      }
    };
  }

  private async separateDrums(audioData: Float32Array): Promise<AudioStem[]> {
    // Separate different drum elements
    const kickData = this.simulateKickSeparation(audioData);
    const snareData = this.simulateSnareSeparation(audioData);
    const hihatData = this.simulateHihatSeparation(audioData);
    
    const drumStems: AudioStem[] = [];
    
    // Kick drum
    if (kickData.some(sample => Math.abs(sample) > 0.01)) {
      drumStems.push({
        id: `kick_${Date.now()}`,
        name: 'Kick',
        type: 'drums',
        audioUrl: this.createAudioUrl(kickData),
        waveformData: this.generateWaveformData(kickData),
        volume: 100,
        pan: 0,
        muted: false,
        soloed: false,
        effects: {
          reverb: 5,
          delay: 0,
          distortion: 0,
          filter: {
            type: 'lowpass',
            frequency: 100,
            resonance: 0.3
          },
          eq: {
            low: 3,
            mid: -1,
            high: -2
          }
        }
      });
    }
    
    // Snare
    if (snareData.some(sample => Math.abs(sample) > 0.01)) {
      drumStems.push({
        id: `snare_${Date.now()}`,
        name: 'Snare',
        type: 'drums',
        audioUrl: this.createAudioUrl(snareData),
        waveformData: this.generateWaveformData(snareData),
        volume: 100,
        pan: 0,
        muted: false,
        soloed: false,
        effects: {
          reverb: 15,
          delay: 5,
          distortion: 0,
          filter: {
            type: 'bandpass',
            frequency: 200,
            resonance: 0.4
          },
          eq: {
            low: 0,
            mid: 2,
            high: 1
          }
        }
      });
    }
    
    // Hi-hats
    if (hihatData.some(sample => Math.abs(sample) > 0.01)) {
      drumStems.push({
        id: `hihat_${Date.now()}`,
        name: 'Hi-Hats',
        type: 'drums',
        audioUrl: this.createAudioUrl(hihatData),
        waveformData: this.generateWaveformData(hihatData),
        volume: 80,
        pan: 20,
        muted: false,
        soloed: false,
        effects: {
          reverb: 10,
          delay: 0,
          distortion: 0,
          filter: {
            type: 'highpass',
            frequency: 5000,
            resonance: 0.2
          },
          eq: {
            low: -2,
            mid: 0,
            high: 2
          }
        }
      });
    }
    
    return drumStems;
  }

  private async separateBass(audioData: Float32Array): Promise<AudioStem | null> {
    const bassData = this.simulateBassSeparation(audioData);
    
    if (!bassData.some(sample => Math.abs(sample) > 0.01)) {
      return null;
    }
    
    return {
      id: `bass_${Date.now()}`,
      name: 'Bass',
      type: 'bass',
      audioUrl: this.createAudioUrl(bassData),
      waveformData: this.generateWaveformData(bassData),
      volume: 100,
      pan: 0,
      muted: false,
      soloed: false,
      effects: {
        reverb: 5,
        delay: 0,
        distortion: 0,
        filter: {
          type: 'lowpass',
          frequency: 200,
          resonance: 0.4
        },
        eq: {
          low: 2,
          mid: 0,
          high: -3
        }
      }
    };
  }

  private async separateMelody(audioData: Float32Array): Promise<AudioStem | null> {
    const melodyData = this.simulateMelodySeparation(audioData);
    
    if (!melodyData.some(sample => Math.abs(sample) > 0.01)) {
      return null;
    }
    
    return {
      id: `melody_${Date.now()}`,
      name: 'Melody',
      type: 'melody',
      audioUrl: this.createAudioUrl(melodyData),
      waveformData: this.generateWaveformData(melodyData),
      volume: 90,
      pan: 0,
      muted: false,
      soloed: false,
      effects: {
        reverb: 25,
        delay: 15,
        distortion: 0,
        filter: {
          type: 'bandpass',
          frequency: 1000,
          resonance: 0.3
        },
        eq: {
          low: 0,
          mid: 1,
          high: 1
        }
      }
    };
  }

  // Simulation methods (in a real implementation, these would use trained ML models)
  private simulateVocalSeparation(audioData: Float32Array): Float32Array {
    const result = new Float32Array(audioData.length);
    const windowSize = 1024;
    const half = windowSize >> 1;

    // Rolling-sum window to compute local average energy in O(N) instead of O(N²)
    let windowSum = 0;
    for (let j = 0; j < Math.min(half, audioData.length); j++) {
      windowSum += Math.abs(audioData[j]);
    }

    for (let i = 0; i < audioData.length; i++) {
      const tail = i - half - 1;
      const head = i + half;
      if (tail >= 0) windowSum -= Math.abs(audioData[tail]);
      if (head < audioData.length) windowSum += Math.abs(audioData[head]);
      const winLen = Math.min(head, audioData.length) - Math.max(0, tail + 1);
      const avgEnergy = winLen > 0 ? windowSum / winLen : 0;

      if (avgEnergy > 0.05 && i % 100 < 60) {
        result[i] = audioData[i] * 0.8;
      }
    }

    return result;
  }

  private simulateKickSeparation(audioData: Float32Array): Float32Array {
    const result = new Float32Array(audioData.length);
    
    // Simulate kick extraction by finding low-frequency transients
    for (let i = 1; i < audioData.length; i++) {
      const transient = Math.abs(audioData[i] - audioData[i - 1]);
      if (transient > 0.1 && Math.abs(audioData[i]) > 0.3) {
        // Create a decaying kick-like sound
        for (let j = 0; j < 2000 && i + j < audioData.length; j++) {
          const decay = Math.exp(-j / 500);
          result[i + j] += audioData[i] * decay * 0.7;
        }
      }
    }
    
    return result;
  }

  private simulateSnareSeparation(audioData: Float32Array): Float32Array {
    const result = new Float32Array(audioData.length);
    
    // Simulate snare extraction by finding mid-frequency transients
    for (let i = 1; i < audioData.length; i++) {
      const transient = Math.abs(audioData[i] - audioData[i - 1]);
      if (transient > 0.08 && i % 22050 > 11000 && i % 22050 < 11500) { // Every ~0.5 seconds
        for (let j = 0; j < 1000 && i + j < audioData.length; j++) {
          const decay = Math.exp(-j / 200);
          result[i + j] += audioData[i] * decay * 0.6;
        }
      }
    }
    
    return result;
  }

  private simulateHihatSeparation(audioData: Float32Array): Float32Array {
    const result = new Float32Array(audioData.length);
    
    // Simulate hi-hat extraction by isolating high-frequency content
    for (let i = 0; i < audioData.length; i++) {
      if (i % 5512 < 100) { // Every 1/8 note at 120 BPM
        result[i] = audioData[i] * 0.4 * (Math.random() * 0.5 + 0.5);
      }
    }
    
    return result;
  }

  private simulateBassSeparation(audioData: Float32Array): Float32Array {
    const result = new Float32Array(audioData.length);
    
    // Simulate bass extraction by isolating low-frequency content
    for (let i = 0; i < audioData.length; i++) {
      // Simple low-pass filter simulation
      const windowSize = 64;
      let sum = 0;
      for (let j = Math.max(0, i - windowSize); j < Math.min(audioData.length, i + windowSize); j++) {
        sum += audioData[j];
      }
      const lowFreqContent = sum / (windowSize * 2);
      result[i] = lowFreqContent * 0.6;
    }
    
    return result;
  }

  private simulateMelodySeparation(audioData: Float32Array): Float32Array {
    const result = new Float32Array(audioData.length);
    const windowSize = 512;
    const half = windowSize >> 1;

    // Rolling-sum window — O(N) instead of O(N²)
    let windowSum = 0;
    for (let j = 0; j < Math.min(half, audioData.length); j++) {
      windowSum += Math.abs(audioData[j]);
    }

    for (let i = 0; i < audioData.length; i++) {
      const tail = i - half - 1;
      const head = i + half;
      if (tail >= 0) windowSum -= Math.abs(audioData[tail]);
      if (head < audioData.length) windowSum += Math.abs(audioData[head]);
      const winLen = Math.min(head, audioData.length) - Math.max(0, tail + 1);
      const sustainedEnergy = winLen > 0 ? windowSum / winLen : 0;

      if (sustainedEnergy > 0.03 && sustainedEnergy < 0.8) {
        result[i] = audioData[i] * 0.7;
      }
    }

    return result;
  }

  private createAudioUrl(audioData: Float32Array, sampleRate: number = 44100): string {
    const numSamples = audioData.length;
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataByteLength = numSamples * blockAlign;
    const buffer = new ArrayBuffer(44 + dataByteLength);
    const view = new DataView(buffer);

    const writeStr = (off: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataByteLength, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeStr(36, 'data');
    view.setUint32(40, dataByteLength, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  }

  private generateWaveformData(audioData: Float32Array): number[] {
    const samplesPerPixel = Math.floor(audioData.length / 200);
    const waveform: number[] = [];
    
    for (let i = 0; i < 200; i++) {
      const start = i * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, audioData.length);
      
      let peak = 0;
      for (let j = start; j < end; j++) {
        peak = Math.max(peak, Math.abs(audioData[j]));
      }
      
      waveform.push(peak * 100);
    }
    
    return waveform;
  }

  private calculateSeparationQuality(stems: AudioStem[]): number {
    // Calculate quality based on stem content and separation
    const totalStems = stems.length;
    const qualityFactors = stems.map(stem => {
      const avgLevel = stem.waveformData.reduce((sum, val) => sum + val, 0) / stem.waveformData.length;
      return Math.min(1, avgLevel / 50); // Normalize to 0-1
    });
    
    const avgQuality = qualityFactors.reduce((sum, quality) => sum + quality, 0) / totalStems;
    return Math.round(avgQuality * 100);
  }
}
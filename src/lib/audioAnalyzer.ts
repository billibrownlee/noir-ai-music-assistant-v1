export interface AudioAnalysis {
  tempo: number;
  key: string;
  mode: 'major' | 'minor';
  energy: number;
  valence: number;
  danceability: number;
  spectralFeatures: {
    centroid: number;
    rolloff: number;
    zcr: number;
    mfcc: number[];
  };
  rhythmPattern: number[];
  harmonicContent: number[];
}

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyzer: AnalyserNode | null = null;
  private readonly MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limit for analysis
  private readonly MAX_DURATION = 600; // 10 minutes max
  private readonly ANALYSIS_TIMEOUT = 30000; // 30 seconds timeout

  constructor() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        this.analyzer = this.audioContext.createAnalyser();
        this.analyzer.fftSize = 2048;
      }
    } catch (error) {
      console.warn('AudioContext initialization failed:', error);
    }
  }

  async analyzeAudioFile(file: File): Promise<AudioAnalysis> {
    // Safety check: Skip analysis for very large files
    if (file.size > this.MAX_FILE_SIZE) {
      console.log('⚠️ File too large for analysis, using defaults');
      return this.getDefaultAnalysis();
    }

    // Add timeout protection
    const timeoutPromise = new Promise<AudioAnalysis>((_, reject) => {
      setTimeout(() => reject(new Error('Analysis timeout')), this.ANALYSIS_TIMEOUT);
    });

    try {
      const analysisPromise = this.performAnalysis(file);
      return await Promise.race([analysisPromise, timeoutPromise]);
    } catch (error) {
      console.error('Audio analysis failed:', error);
      // Return default analysis instead of crashing
      return this.getDefaultAnalysis();
    }
  }

  private async performAnalysis(file: File): Promise<AudioAnalysis> {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    try {
      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (error) {
      console.warn('Failed to resume AudioContext:', error);
    }

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Empty file');
      }
    } catch (error) {
      console.error('Failed to read file:', error);
      return this.getDefaultAnalysis();
    }

    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
      
      // Check duration
      if (audioBuffer.duration > this.MAX_DURATION) {
        console.log('⚠️ File too long, using first 10 minutes');
        // Truncate to first 10 minutes
        const maxSamples = Math.floor(this.MAX_DURATION * audioBuffer.sampleRate);
        const truncatedBuffer = this.audioContext.createBuffer(
          audioBuffer.numberOfChannels,
          Math.min(audioBuffer.length, maxSamples),
          audioBuffer.sampleRate
        );
        for (let i = 0; i < truncatedBuffer.numberOfChannels; i++) {
          truncatedBuffer.getChannelData(i).set(
            audioBuffer.getChannelData(i).slice(0, truncatedBuffer.length)
          );
        }
        audioBuffer = truncatedBuffer;
      }
    } catch (error) {
      console.error('Failed to decode audio:', error);
      return this.getDefaultAnalysis();
    }
    
    try {
      // Extract audio features with error handling
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      // Limit data size for processing to prevent crashes
      const maxSamples = 44100 * 60; // Max 1 minute of samples
      const processingData = channelData.length > maxSamples 
        ? channelData.slice(0, maxSamples)
        : channelData;
      
      // Basic tempo detection with error handling
      let tempo = 120;
      try {
        tempo = this.detectTempo(processingData, sampleRate);
      } catch (error) {
        console.warn('Tempo detection failed:', error);
      }
      
      // Key detection with error handling
      let key = 'C';
      let mode: 'major' | 'minor' = 'major';
      try {
        const keyResult = this.detectKeyAndMode(processingData, sampleRate);
        key = keyResult.key;
        mode = keyResult.mode;
      } catch (error) {
        console.warn('Key detection failed:', error);
      }
      
      // Energy and spectral features with error handling
      let spectralFeatures = {
        centroid: 1000,
        rolloff: 5000,
        zcr: 0.1,
        mfcc: new Array(13).fill(0)
      };
      try {
        spectralFeatures = this.extractSpectralFeatures(processingData, sampleRate);
      } catch (error) {
        console.warn('Spectral features extraction failed:', error);
      }
      
      // Rhythm pattern with error handling
      let rhythmPattern: number[] = new Array(16).fill(0.5);
      try {
        rhythmPattern = this.extractRhythmPattern(processingData, sampleRate, tempo);
      } catch (error) {
        console.warn('Rhythm pattern extraction failed:', error);
      }
      
      // Harmonic content with error handling
      let harmonicContent: number[] = new Array(8).fill(0);
      try {
        harmonicContent = this.extractHarmonicContent(processingData, sampleRate);
      } catch (error) {
        console.warn('Harmonic content extraction failed:', error);
      }
      
      return {
        tempo,
        key,
        mode,
        energy: this.calculateEnergy(processingData),
        valence: this.calculateValence(spectralFeatures),
        danceability: this.calculateDanceability(tempo, rhythmPattern),
        spectralFeatures,
        rhythmPattern,
        harmonicContent
      };
    } catch (error) {
      console.error('Feature extraction failed:', error);
      return this.getDefaultAnalysis();
    }
  }

  private getDefaultAnalysis(): AudioAnalysis {
    return {
      tempo: 120,
      key: 'C',
      mode: 'major',
      energy: 0.5,
      valence: 0.5,
      danceability: 0.5,
      spectralFeatures: {
        centroid: 1000,
        rolloff: 5000,
        zcr: 0.1,
        mfcc: new Array(13).fill(0)
      },
      rhythmPattern: new Array(16).fill(0.5),
      harmonicContent: new Array(8).fill(0)
    };
  }

  private detectTempo(data: Float32Array, sampleRate: number): number {
    try {
      // Simplified tempo detection using onset detection
      const hopSize = 512;
      const frameSize = 1024;
      const onsets: number[] = [];
      
      // Limit processing to prevent crashes
      const maxFrames = Math.min(data.length - frameSize, 10000 * hopSize);
      
      for (let i = 0; i < maxFrames; i += hopSize) {
        try {
          const frame = data.slice(i, i + frameSize);
          if (frame.length < frameSize) break;
          
          const energy = frame.reduce((sum, sample) => {
            const val = isNaN(sample) ? 0 : sample;
            return sum + val * val;
          }, 0);
          
          if (i > 0 && onsets.length > 0 && energy > onsets[onsets.length - 1] * 1.3) {
            onsets.push(i / sampleRate);
          }
        } catch (error) {
          console.warn('Tempo detection frame error:', error);
          break;
        }
      }
      
      // Calculate intervals between onsets
      const intervals: number[] = [];
      for (let i = 1; i < onsets.length; i++) {
        intervals.push(onsets[i] - onsets[i - 1]);
      }
      
      // Find most common interval (approximate beat)
      if (intervals.length === 0) {
        return 120; // Default tempo
      }
      
      const avgInterval = intervals.reduce((sum, interval) => {
        const val = isNaN(interval) ? 0 : interval;
        return sum + val;
      }, 0) / intervals.length;
      
      if (avgInterval <= 0 || !isFinite(avgInterval)) {
        return 120; // Default tempo
      }
      
      const bpm = Math.round(60 / avgInterval);
      
      // Clamp to reasonable range
      return Math.max(60, Math.min(200, bpm));
    } catch (error) {
      console.warn('Tempo detection failed:', error);
      return 120; // Safe default
    }
  }

  private detectKeyAndMode(data: Float32Array, sampleRate: number): { key: string, mode: 'major' | 'minor' } {
    // Simplified key detection using pitch class profile
    const chromaVector = this.calculateChromaVector(data, sampleRate);
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    // Major and minor templates (Krumhansl-Schmuckler)
    const majorTemplate = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const minorTemplate = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
    
    let bestKey = 'C';
    let bestMode: 'major' | 'minor' = 'major';
    let bestCorr = -1;
    
    for (let i = 0; i < 12; i++) {
      // Test major
      const majorCorr = this.correlate(chromaVector, this.rotateArray(majorTemplate, i));
      if (majorCorr > bestCorr) {
        bestCorr = majorCorr;
        bestKey = keys[i];
        bestMode = 'major';
      }
      
      // Test minor
      const minorCorr = this.correlate(chromaVector, this.rotateArray(minorTemplate, i));
      if (minorCorr > bestCorr) {
        bestCorr = minorCorr;
        bestKey = keys[i];
        bestMode = 'minor';
      }
    }
    
    return { key: bestKey, mode: bestMode };
  }

  private calculateChromaVector(data: Float32Array, sampleRate: number): number[] {
    const chroma = new Array(12).fill(0);
    const fftSize = 2048;
    const hopSize = 512;
    
    for (let i = 0; i < data.length - fftSize; i += hopSize) {
      const frame = data.slice(i, i + fftSize);
      const spectrum = this.fft(frame);
      
      for (let bin = 1; bin < spectrum.length / 2; bin++) {
        const freq = (bin * sampleRate) / fftSize;
        const magnitude = Math.sqrt(spectrum[bin * 2] ** 2 + spectrum[bin * 2 + 1] ** 2);
        
        if (freq > 80 && freq < 2000) {
          const pitch = 12 * Math.log2(freq / 440) + 69;
          const pitchClass = Math.round(pitch) % 12;
          if (pitchClass >= 0 && pitchClass < 12) {
            chroma[pitchClass] += magnitude;
          }
        }
      }
    }
    
    // Normalize
    const sum = chroma.reduce((a, b) => a + b, 0);
    return chroma.map(val => val / sum);
  }

  private extractSpectralFeatures(data: Float32Array, sampleRate: number) {
    const fftSize = 2048;
    const spectrum = this.fft(data.slice(0, fftSize));
    const magnitudes = [];
    
    for (let i = 0; i < spectrum.length / 2; i++) {
      magnitudes.push(Math.sqrt(spectrum[i * 2] ** 2 + spectrum[i * 2 + 1] ** 2));
    }
    
    // Spectral centroid
    let weightedSum = 0;
    let magnitudeSum = 0;
    for (let i = 0; i < magnitudes.length; i++) {
      const freq = (i * sampleRate) / fftSize;
      weightedSum += freq * magnitudes[i];
      magnitudeSum += magnitudes[i];
    }
    const centroid = weightedSum / magnitudeSum;
    
    // Spectral rolloff (85% of energy)
    const totalEnergy = magnitudes.reduce((sum, mag) => sum + mag ** 2, 0);
    let cumulativeEnergy = 0;
    let rolloff = 0;
    for (let i = 0; i < magnitudes.length; i++) {
      cumulativeEnergy += magnitudes[i] ** 2;
      if (cumulativeEnergy >= 0.85 * totalEnergy) {
        rolloff = (i * sampleRate) / fftSize;
        break;
      }
    }
    
    // Zero crossing rate
    let zcr = 0;
    for (let i = 1; i < data.length; i++) {
      if ((data[i] >= 0) !== (data[i - 1] >= 0)) {
        zcr++;
      }
    }
    zcr = zcr / data.length;
    
    // MFCC (simplified)
    const mfcc = this.calculateMFCC(magnitudes);
    
    return { centroid, rolloff, zcr, mfcc };
  }

  private extractRhythmPattern(data: Float32Array, sampleRate: number, tempo: number): number[] {
    try {
      if (!data || data.length === 0 || tempo <= 0 || !isFinite(tempo)) {
        return new Array(16).fill(0.5);
      }
      
      const beatLength = (60 / Math.max(60, Math.min(200, tempo))) * sampleRate;
      if (!isFinite(beatLength) || beatLength <= 0) {
        return new Array(16).fill(0.5);
      }
      
      const pattern: number[] = [];
      const maxBeats = Math.min(16, Math.floor(data.length / beatLength));
      
      for (let i = 0; i < maxBeats; i++) {
        try {
          const start = Math.floor(i * beatLength);
          const end = Math.floor((i + 1) * beatLength);
          
          if (start >= data.length || end > data.length) break;
          
          const segment = data.slice(start, end);
          if (segment.length === 0) {
            pattern.push(0.5);
            continue;
          }
          
          const energy = segment.reduce((sum, sample) => {
            const val = isNaN(sample) ? 0 : sample;
            return sum + val * val;
          }, 0) / segment.length;
          
          pattern.push(isFinite(energy) ? energy : 0.5);
        } catch (error) {
          pattern.push(0.5);
        }
      }
      
      // Ensure we have at least 16 values
      while (pattern.length < 16) {
        pattern.push(0.5);
      }
      
      // Normalize safely
      const maxEnergy = Math.max(...pattern.filter(v => isFinite(v)));
      if (maxEnergy > 0 && isFinite(maxEnergy)) {
        return pattern.map(energy => {
          const normalized = energy / maxEnergy;
          return isFinite(normalized) ? normalized : 0.5;
        });
      }
      
      return pattern;
    } catch (error) {
      console.warn('Rhythm pattern extraction failed:', error);
      return new Array(16).fill(0.5);
    }
  }

  private extractHarmonicContent(data: Float32Array, sampleRate: number): number[] {
    const fftSize = 2048;
    const spectrum = this.fft(data.slice(0, fftSize));
    const harmonics: number[] = [];
    
    // Extract first 8 harmonics
    for (let harmonic = 1; harmonic <= 8; harmonic++) {
      let harmonicEnergy = 0;
      const startBin = Math.floor((harmonic * 440 * fftSize) / sampleRate);
      const endBin = Math.floor(((harmonic + 0.5) * 440 * fftSize) / sampleRate);
      
      for (let bin = startBin; bin < endBin && bin < spectrum.length / 2; bin++) {
        harmonicEnergy += Math.sqrt(spectrum[bin * 2] ** 2 + spectrum[bin * 2 + 1] ** 2);
      }
      
      harmonics.push(harmonicEnergy);
    }
    
    return harmonics;
  }

  private calculateEnergy(data: Float32Array): number {
    try {
      if (!data || data.length === 0) return 0.5;
      
      const energy = data.reduce((sum, sample) => {
        const val = isNaN(sample) ? 0 : sample;
        return sum + val * val;
      }, 0) / data.length;
      
      if (!isFinite(energy) || energy <= 0) return 0.5;
      
      return Math.min(1, Math.max(0, Math.sqrt(energy) * 10)); // Normalize to 0-1
    } catch (error) {
      console.warn('Energy calculation failed:', error);
      return 0.5; // Safe default
    }
  }

  private calculateValence(spectralFeatures: any): number {
    // Simplified valence calculation based on spectral features
    const brightnessRatio = spectralFeatures.centroid / 2000; // Normalize
    return Math.min(1, Math.max(0, brightnessRatio));
  }

  private calculateDanceability(tempo: number, rhythmPattern: number[]): number {
    try {
      if (!rhythmPattern || rhythmPattern.length === 0) return 0.5;
      
      // Calculate rhythm regularity
      const validPattern = rhythmPattern.filter(v => isFinite(v));
      if (validPattern.length === 0) return 0.5;
      
      const avgEnergy = validPattern.reduce((sum, energy) => sum + energy, 0) / validPattern.length;
      if (!isFinite(avgEnergy)) return 0.5;
      
      const variance = validPattern.reduce((sum, energy) => {
        const diff = energy - avgEnergy;
        return sum + (isFinite(diff) ? diff ** 2 : 0);
      }, 0) / validPattern.length;
      
      const regularity = isFinite(variance) && variance > 0 ? 1 / (1 + variance) : 0.5;
      
      // Optimal tempo range for danceability
      const validTempo = isFinite(tempo) ? Math.max(60, Math.min(200, tempo)) : 120;
      const tempoScore = 1 - Math.abs(validTempo - 120) / 120;
      
      const result = (regularity + tempoScore) / 2;
      return Math.min(1, Math.max(0, isFinite(result) ? result : 0.5));
    } catch (error) {
      console.warn('Danceability calculation failed:', error);
      return 0.5;
    }
  }

  private calculateMFCC(magnitudes: number[]): number[] {
    // Simplified MFCC calculation (first 13 coefficients)
    const mfcc: number[] = [];
    const numCoeffs = 13;
    
    for (let i = 0; i < numCoeffs; i++) {
      let sum = 0;
      for (let j = 0; j < magnitudes.length; j++) {
        sum += magnitudes[j] * Math.cos((Math.PI * i * (2 * j + 1)) / (2 * magnitudes.length));
      }
      mfcc.push(sum);
    }
    
    return mfcc;
  }

  private fft(data: Float32Array): Float32Array {
    // Simplified FFT implementation (normally you'd use a proper FFT library)
    const N = data.length;
    const result = new Float32Array(N * 2);
    
    for (let k = 0; k < N; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = (-2 * Math.PI * k * n) / N;
        real += data[n] * Math.cos(angle);
        imag += data[n] * Math.sin(angle);
      }
      
      result[k * 2] = real;
      result[k * 2 + 1] = imag;
    }
    
    return result;
  }

  private correlate(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumA += a[i];
      sumB += b[i];
      sumAB += a[i] * b[i];
      sumA2 += a[i] * a[i];
      sumB2 += b[i] * b[i];
    }
    
    const numerator = n * sumAB - sumA * sumB;
    const denominator = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private rotateArray(array: number[], steps: number): number[] {
    const result = [...array];
    for (let i = 0; i < steps; i++) {
      result.unshift(result.pop()!);
    }
    return result;
  }
}
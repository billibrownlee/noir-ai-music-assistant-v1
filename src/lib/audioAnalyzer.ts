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
  private audioContext: AudioContext;
  private analyzer: AnalyserNode;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.analyzer = this.audioContext.createAnalyser();
    this.analyzer.fftSize = 2048;
  }

  async analyzeAudioFile(file: File): Promise<AudioAnalysis> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Extract audio features
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      // Basic tempo detection using autocorrelation
      const tempo = this.detectTempo(channelData, sampleRate);
      
      // Key detection using chroma features
      const { key, mode } = this.detectKeyAndMode(channelData, sampleRate);
      
      // Energy and spectral features
      const spectralFeatures = this.extractSpectralFeatures(channelData, sampleRate);
      
      // Rhythm pattern analysis
      const rhythmPattern = this.extractRhythmPattern(channelData, sampleRate, tempo);
      
      // Harmonic content analysis
      const harmonicContent = this.extractHarmonicContent(channelData, sampleRate);
      
      return {
        tempo,
        key,
        mode,
        energy: this.calculateEnergy(channelData),
        valence: this.calculateValence(spectralFeatures),
        danceability: this.calculateDanceability(tempo, rhythmPattern),
        spectralFeatures,
        rhythmPattern,
        harmonicContent
      };
    } catch (error) {
      console.error('Audio analysis failed:', error);
      throw new Error('Failed to analyze audio file');
    }
  }

  private detectTempo(data: Float32Array, sampleRate: number): number {
    // Simplified tempo detection using onset detection
    const hopSize = 512;
    const frameSize = 1024;
    const onsets: number[] = [];
    
    for (let i = 0; i < data.length - frameSize; i += hopSize) {
      const frame = data.slice(i, i + frameSize);
      const energy = frame.reduce((sum, sample) => sum + sample * sample, 0);
      
      if (i > 0 && energy > onsets[onsets.length - 1] * 1.3) {
        onsets.push(i / sampleRate);
      }
    }
    
    // Calculate intervals between onsets
    const intervals: number[] = [];
    for (let i = 1; i < onsets.length; i++) {
      intervals.push(onsets[i] - onsets[i - 1]);
    }
    
    // Find most common interval (approximate beat)
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const bpm = Math.round(60 / avgInterval);
    
    // Clamp to reasonable range
    return Math.max(60, Math.min(200, bpm));
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
    const beatLength = (60 / tempo) * sampleRate;
    const pattern: number[] = [];
    
    for (let i = 0; i < Math.min(16, Math.floor(data.length / beatLength)); i++) {
      const start = Math.floor(i * beatLength);
      const end = Math.floor((i + 1) * beatLength);
      const segment = data.slice(start, end);
      const energy = segment.reduce((sum, sample) => sum + sample * sample, 0) / segment.length;
      pattern.push(energy);
    }
    
    // Normalize
    const maxEnergy = Math.max(...pattern);
    return pattern.map(energy => energy / maxEnergy);
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
    const energy = data.reduce((sum, sample) => sum + sample * sample, 0) / data.length;
    return Math.min(1, Math.sqrt(energy) * 10); // Normalize to 0-1
  }

  private calculateValence(spectralFeatures: any): number {
    // Simplified valence calculation based on spectral features
    const brightnessRatio = spectralFeatures.centroid / 2000; // Normalize
    return Math.min(1, Math.max(0, brightnessRatio));
  }

  private calculateDanceability(tempo: number, rhythmPattern: number[]): number {
    // Calculate rhythm regularity
    const avgEnergy = rhythmPattern.reduce((sum, energy) => sum + energy, 0) / rhythmPattern.length;
    const variance = rhythmPattern.reduce((sum, energy) => sum + (energy - avgEnergy) ** 2, 0) / rhythmPattern.length;
    const regularity = 1 / (1 + variance);
    
    // Optimal tempo range for danceability
    const tempoScore = 1 - Math.abs(tempo - 120) / 120;
    
    return Math.min(1, (regularity + tempoScore) / 2);
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
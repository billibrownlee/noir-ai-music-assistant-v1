// Audio synthesis utilities for generating music programmatically
export class AudioSynthesizer {
  private _audioContext: AudioContext | null = null;

  private get audioContext(): AudioContext {
    if (!this._audioContext) {
      this._audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this._audioContext;
  }

  private get sampleRate(): number {
    return this.audioContext.sampleRate;
  }

  // Generate a sine wave
  generateSineWave(frequency: number, duration: number, amplitude: number = 0.3): Float32Array {
    const samples = Math.floor(this.sampleRate * duration);
    const wave = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      wave[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / this.sampleRate);
    }
    
    return wave;
  }

  // Generate a sawtooth wave
  generateSawtoothWave(frequency: number, duration: number, amplitude: number = 0.3): Float32Array {
    const samples = Math.floor(this.sampleRate * duration);
    const wave = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const t = (i / this.sampleRate) * frequency;
      wave[i] = amplitude * (2 * (t - Math.floor(t + 0.5)));
    }
    
    return wave;
  }

  // Generate a square wave
  generateSquareWave(frequency: number, duration: number, amplitude: number = 0.3): Float32Array {
    const samples = Math.floor(this.sampleRate * duration);
    const wave = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const t = (i / this.sampleRate) * frequency;
      wave[i] = amplitude * (Math.sin(2 * Math.PI * t) > 0 ? 1 : -1);
    }
    
    return wave;
  }

  // Generate noise
  generateNoise(duration: number, amplitude: number = 0.1): Float32Array {
    const samples = Math.floor(this.sampleRate * duration);
    const wave = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      wave[i] = amplitude * (Math.random() * 2 - 1);
    }
    
    return wave;
  }

  // Apply ADSR envelope
  applyEnvelope(wave: Float32Array, attack: number, decay: number, sustain: number, release: number): Float32Array {
    const samples = wave.length;
    const attackSamples = Math.floor(attack * this.sampleRate);
    const decaySamples = Math.floor(decay * this.sampleRate);
    const releaseSamples = Math.floor(release * this.sampleRate);
    const sustainSamples = samples - attackSamples - decaySamples - releaseSamples;

    for (let i = 0; i < samples; i++) {
      let envelope = 1;
      
      if (i < attackSamples) {
        // Attack phase
        envelope = i / attackSamples;
      } else if (i < attackSamples + decaySamples) {
        // Decay phase
        envelope = 1 - (1 - sustain) * (i - attackSamples) / decaySamples;
      } else if (i < attackSamples + decaySamples + sustainSamples) {
        // Sustain phase
        envelope = sustain;
      } else {
        // Release phase
        envelope = sustain * (1 - (i - attackSamples - decaySamples - sustainSamples) / releaseSamples);
      }
      
      wave[i] *= envelope;
    }
    
    return wave;
  }

  // Combine multiple waves
  combineWaves(waves: Float32Array[]): Float32Array {
    console.log('🔊 Combining waves:', waves.length, 'tracks');
    if (waves.length === 0) return new Float32Array(0);
    
    // Find max length without using spread operator to avoid stack overflow
    let maxLength = 0;
    for (const wave of waves) {
      if (wave.length > maxLength) maxLength = wave.length;
    }
    console.log('🔊 Max length found:', maxLength);
    const combined = new Float32Array(maxLength);
    
    console.log('🔊 Starting wave combination...');
    for (const wave of waves) {
      console.log('🔊 Processing wave with length:', wave.length);
      for (let i = 0; i < wave.length; i++) {
        combined[i] += wave[i];
      }
    }
    
    // Normalize to prevent clipping - use iterative approach to avoid stack overflow
    let max = 0;
    for (let i = 0; i < combined.length; i++) {
      const abs = Math.abs(combined[i]);
      if (abs > max) max = abs;
    }
    
    if (max > 1) {
      for (let i = 0; i < combined.length; i++) {
        combined[i] /= max;
      }
    }
    
    return combined;
  }

  // Add reverb effect
  addReverb(wave: Float32Array, roomSize: number = 0.3, damping: number = 0.5): Float32Array {
    const delaySamples = Math.floor(roomSize * this.sampleRate * 0.1);
    const reverbed = new Float32Array(wave.length + delaySamples);
    
    // Copy original signal
    reverbed.set(wave);
    
    // Add delayed and dampened signal
    for (let i = 0; i < wave.length; i++) {
      const delayIndex = i + delaySamples;
      if (delayIndex < reverbed.length) {
        reverbed[delayIndex] += wave[i] * damping;
      }
    }
    
    return reverbed;
  }

  // Convert Float32Array to WAV blob
  exportToWAV(audioData: Float32Array): Blob {
    const length = audioData.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}

// Music note frequencies (in Hz)
export const NOTE_FREQUENCIES = {
  'C': { 0: 16.35, 1: 32.70, 2: 65.41, 3: 130.81, 4: 261.63, 5: 523.25, 6: 1046.50, 7: 2093.00 },
  'C#': { 0: 17.32, 1: 34.65, 2: 69.30, 3: 138.59, 4: 277.18, 5: 554.37, 6: 1108.73, 7: 2217.46 },
  'D': { 0: 18.35, 1: 36.71, 2: 73.42, 3: 146.83, 4: 293.66, 5: 587.33, 6: 1174.66, 7: 2349.32 },
  'D#': { 0: 19.45, 1: 38.89, 2: 77.78, 3: 155.56, 4: 311.13, 5: 622.25, 6: 1244.51, 7: 2489.02 },
  'E': { 0: 20.60, 1: 41.20, 2: 82.41, 3: 164.81, 4: 329.63, 5: 659.25, 6: 1318.51, 7: 2637.02 },
  'F': { 0: 21.83, 1: 43.65, 2: 87.31, 3: 174.61, 4: 349.23, 5: 698.46, 6: 1396.91, 7: 2793.83 },
  'F#': { 0: 23.12, 1: 46.25, 2: 92.50, 3: 185.00, 4: 369.99, 5: 739.99, 6: 1479.98, 7: 2959.96 },
  'G': { 0: 24.50, 1: 49.00, 2: 98.00, 3: 196.00, 4: 392.00, 5: 783.99, 6: 1567.98, 7: 3135.96 },
  'G#': { 0: 25.96, 1: 51.91, 2: 103.83, 3: 207.65, 4: 415.30, 5: 830.61, 6: 1661.22, 7: 3322.44 },
  'A': { 0: 27.50, 1: 55.00, 2: 110.00, 3: 220.00, 4: 440.00, 5: 880.00, 6: 1760.00, 7: 3520.00 },
  'A#': { 0: 29.14, 1: 58.27, 2: 116.54, 3: 233.08, 4: 466.16, 5: 932.33, 6: 1864.66, 7: 3729.31 },
  'B': { 0: 30.87, 1: 61.74, 2: 123.47, 3: 246.94, 4: 493.88, 5: 987.77, 6: 1975.53, 7: 3951.07 }
};

// Chord progressions
export const CHORD_PROGRESSIONS = {
  'major': [
    [0, 4, 7], // I
    [2, 5, 9], // ii
    [4, 7, 11], // iii
    [5, 9, 0], // IV
    [7, 11, 2], // V
    [9, 0, 4], // vi
    [11, 2, 5]  // vii°
  ],
  'minor': [
    [0, 3, 7], // i
    [2, 5, 8], // ii°
    [3, 7, 10], // III
    [5, 8, 0], // iv
    [7, 10, 2], // v
    [8, 0, 3], // VI
    [10, 2, 5]  // VII
  ]
};

// Scale patterns
export const SCALES = {
  'major': [0, 2, 4, 5, 7, 9, 11],
  'minor': [0, 2, 3, 5, 7, 8, 10],
  'dorian': [0, 2, 3, 5, 7, 9, 10],
  'mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'pentatonic': [0, 2, 4, 7, 9]
};
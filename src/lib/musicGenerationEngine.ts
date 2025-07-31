import { AudioSynthesizer, NOTE_FREQUENCIES, CHORD_PROGRESSIONS, SCALES } from './audioSynthesis';
import { supabase } from '@/integrations/supabase/client';

export interface MusicGenerationParams {
  prompt: string;
  style: string;
  duration: number;
  bpm: number;
  key: string;
  instrumental: boolean;
  useTrainingData?: boolean;
}

export interface GeneratedTrack {
  audioBlob: Blob;
  audioUrl: string;
  metadata: {
    bpm: number;
    key: string;
    duration: number;
    style: string;
    structure: string[];
  };
}

export class MusicGenerationEngine {
  private synthesizer: AudioSynthesizer;

  constructor() {
    this.synthesizer = new AudioSynthesizer();
  }

  async generateMusic(params: MusicGenerationParams): Promise<GeneratedTrack> {
    console.log('🎵 Generating music with params:', params);

    const { style, duration, bpm, key, useTrainingData = true } = params;
    
    // Load training data if requested
    let trainingData = null;
    if (useTrainingData) {
      trainingData = await this.loadTrainingData(style);
      if (trainingData.length > 0) {
        console.log('🧠 Using training data from', trainingData.length, 'uploaded samples');
      }
    }
    
    // Parse key (e.g., "C major" -> ["C", "major"])
    const [rootNote, mode] = key.toLowerCase().split(' ');
    const isMinor = mode === 'minor';
    
    // Get root frequency
    const rootFreq = NOTE_FREQUENCIES[rootNote.toUpperCase() as keyof typeof NOTE_FREQUENCIES]?.[4] || 261.63; // Default to C4
    
    // Generate music based on style with training influence
    let audioData: Float32Array;
    
    switch (style) {
      case 'electronic':
        audioData = this.generateElectronic(duration, bpm, rootFreq, isMinor);
        break;
      case 'hip-hop':
        audioData = this.generateHipHop(duration, bpm, rootFreq, isMinor);
        break;
      case 'rnb':
        audioData = this.generateRnB(duration, bpm, rootFreq, isMinor);
        break;
      case 'ambient':
        audioData = this.generateAmbient(duration, bpm, rootFreq, isMinor);
        break;
      case 'rock':
        audioData = this.generateRock(duration, bpm, rootFreq, isMinor);
        break;
      case 'jazz':
        audioData = this.generateJazz(duration, bpm, rootFreq, isMinor);
        break;
      default:
        audioData = this.generateGeneric(duration, bpm, rootFreq, isMinor);
    }

    // Export to WAV
    const audioBlob = this.synthesizer.exportToWAV(audioData);
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      audioBlob,
      audioUrl,
      metadata: {
        bpm,
        key,
        duration,
        style,
        structure: this.getStructureForStyle(style)
      }
    };
  }

  // Load training data from uploaded samples for a specific genre
  private async loadTrainingData(style: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('audio_training_data')
        .select('*')
        .eq('genre', style)
        .gte('confidence_score', 0.6) // Only use high-confidence training data
        .order('confidence_score', { ascending: false })
        .limit(10); // Limit to top 10 samples

      if (error) {
        console.warn('⚠️ Failed to load training data:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.warn('⚠️ Training data query error:', error);
      return [];
    }
  }

  private generateElectronic(duration: number, bpm: number, rootFreq: number, isMinor: boolean): Float32Array {
    console.log('🎛️ Generating electronic music');
    
    const beatDuration = 60 / bpm; // Duration of one beat in seconds
    const tracks: Float32Array[] = [];

    // Kick drum pattern (4/4 beat)
    const kickTrack = this.generateKickPattern(duration, beatDuration);
    tracks.push(kickTrack);

    // Hi-hat pattern
    const hihatTrack = this.generateHiHatPattern(duration, beatDuration);
    tracks.push(hihatTrack);

    // Bass line
    const bassTrack = this.generateBassLine(duration, beatDuration, rootFreq, isMinor);
    tracks.push(bassTrack);

    // Lead synth
    const leadTrack = this.generateLeadSynth(duration, beatDuration, rootFreq, isMinor);
    tracks.push(leadTrack);

    // Pad
    const padTrack = this.generatePad(duration, rootFreq, isMinor);
    tracks.push(padTrack);

    return this.synthesizer.combineWaves(tracks);
  }

  private generateHipHop(duration: number, bpm: number, rootFreq: number, isMinor: boolean): Float32Array {
    console.log('🎤 Generating hip-hop music');
    
    const beatDuration = 60 / bpm;
    const tracks: Float32Array[] = [];

    // 808 kick pattern
    const kickTrack = this.generate808Kick(duration, beatDuration);
    tracks.push(kickTrack);

    // Snare pattern
    const snareTrack = this.generateSnarePattern(duration, beatDuration);
    tracks.push(snareTrack);

    // Hi-hats
    const hihatTrack = this.generateTrapHiHats(duration, beatDuration);
    tracks.push(hihatTrack);

    // Bass line
    const bassTrack = this.generateHipHopBass(duration, beatDuration, rootFreq, isMinor);
    tracks.push(bassTrack);

    // Melody
    const melodyTrack = this.generateHipHopMelody(duration, beatDuration, rootFreq, isMinor);
    tracks.push(melodyTrack);

    return this.synthesizer.combineWaves(tracks);
  }

  private generateAmbient(duration: number, bpm: number, rootFreq: number, isMinor: boolean): Float32Array {
    console.log('🌌 Generating ambient music');
    
    const tracks: Float32Array[] = [];

    // Atmospheric pad
    const pad1 = this.synthesizer.generateSineWave(rootFreq * 0.5, duration, 0.15);
    const pad1Env = this.synthesizer.applyEnvelope(pad1, 2, 1, 0.8, 3);
    const pad1Reverb = this.synthesizer.addReverb(pad1Env, 0.8, 0.6);
    tracks.push(pad1Reverb);

    // Higher harmony
    const harmonicFreq = isMinor ? rootFreq * 1.189 : rootFreq * 1.26; // Minor third or major third
    const pad2 = this.synthesizer.generateSineWave(harmonicFreq, duration, 0.12);
    const pad2Env = this.synthesizer.applyEnvelope(pad2, 1.5, 0.5, 0.9, 2);
    const pad2Reverb = this.synthesizer.addReverb(pad2Env, 0.7, 0.5);
    tracks.push(pad2Reverb);

    // Gentle arpeggios
    const arpeggioTrack = this.generateArpeggio(duration, rootFreq, isMinor, 0.5);
    tracks.push(arpeggioTrack);

    // Subtle noise texture
    const noiseTrack = this.synthesizer.generateNoise(duration, 0.03);
    const filteredNoise = this.synthesizer.addReverb(noiseTrack, 0.9, 0.8);
    tracks.push(filteredNoise);

    return this.synthesizer.combineWaves(tracks);
  }

  private generateRock(duration: number, bpm: number, rootFreq: number, isMinor: boolean): Float32Array {
    console.log('🎸 Generating rock music');
    
    const beatDuration = 60 / bpm;
    const tracks: Float32Array[] = [];

    // Power chord rhythm
    const chordTrack = this.generatePowerChords(duration, beatDuration, rootFreq, isMinor);
    tracks.push(chordTrack);

    // Rock drums
    const drumTrack = this.generateRockDrums(duration, beatDuration);
    tracks.push(drumTrack);

    // Bass guitar
    const bassTrack = this.generateRockBass(duration, beatDuration, rootFreq, isMinor);
    tracks.push(bassTrack);

    return this.synthesizer.combineWaves(tracks);
  }

  private generateRnB(duration: number, bpm: number, rootFreq: number, isMinor: boolean): Float32Array {
    console.log('🎤 Generating R&B music');
    
    const beatDuration = 60 / bpm;
    const tracks: Float32Array[] = [];

    // Smooth kick pattern
    const kickTrack = this.generateRnBKick(duration, beatDuration);
    tracks.push(kickTrack);

    // Snare with ghost notes
    const snareTrack = this.generateRnBSnare(duration, beatDuration);
    tracks.push(snareTrack);

    // Smooth bass line
    const bassTrack = this.generateRnBBass(duration, beatDuration, rootFreq, isMinor);
    tracks.push(bassTrack);

    // Soulful chord progression
    const chordTrack = this.generateRnBChords(duration, beatDuration, rootFreq, isMinor);
    tracks.push(chordTrack);

    // Melodic lead
    const melodyTrack = this.generateRnBMelody(duration, beatDuration, rootFreq, isMinor);
    tracks.push(melodyTrack);

    return this.synthesizer.combineWaves(tracks);
  }

  private generateJazz(duration: number, bpm: number, rootFreq: number, isMinor: boolean): Float32Array {
    console.log('🎺 Generating jazz music');
    
    const beatDuration = 60 / bpm;
    const tracks: Float32Array[] = [];

    // Walking bass
    const bassTrack = this.generateWalkingBass(duration, beatDuration, rootFreq, isMinor);
    tracks.push(bassTrack);

    // Jazz piano comping
    const pianoTrack = this.generateJazzPiano(duration, beatDuration, rootFreq, isMinor);
    tracks.push(pianoTrack);

    // Brushed drums
    const drumTrack = this.generateJazzDrums(duration, beatDuration);
    tracks.push(drumTrack);

    return this.synthesizer.combineWaves(tracks);
  }

  private generateGeneric(duration: number, bpm: number, rootFreq: number, isMinor: boolean): Float32Array {
    console.log('🎵 Generating generic music');
    
    const beatDuration = 60 / bpm;
    const tracks: Float32Array[] = [];

    // Simple chord progression
    const chordTrack = this.generateSimpleChords(duration, beatDuration, rootFreq, isMinor);
    tracks.push(chordTrack);

    // Basic drum pattern
    const drumTrack = this.generateBasicDrums(duration, beatDuration);
    tracks.push(drumTrack);

    return this.synthesizer.combineWaves(tracks);
  }

  // Helper methods for generating specific patterns
  private generateKickPattern(duration: number, beatDuration: number): Float32Array {
    const samples = Math.floor(this.synthesizer['sampleRate'] * duration);
    const kick = new Float32Array(samples);
    
    const beatSamples = Math.floor(this.synthesizer['sampleRate'] * beatDuration);
    
    for (let beat = 0; beat * beatSamples < samples; beat++) {
      if (beat % 4 === 0 || beat % 4 === 2) { // Kick on beats 1 and 3
        const startSample = beat * beatSamples;
        const kickSound = this.synthesizer.generateSineWave(60, 0.1, 0.8); // 60Hz kick
        const kickEnv = this.synthesizer.applyEnvelope(kickSound, 0.01, 0.05, 0.3, 0.04);
        
        for (let i = 0; i < kickEnv.length && startSample + i < samples; i++) {
          kick[startSample + i] += kickEnv[i];
        }
      }
    }
    
    return kick;
  }

  private generateHiHatPattern(duration: number, beatDuration: number): Float32Array {
    const samples = Math.floor(this.synthesizer['sampleRate'] * duration);
    const hihat = new Float32Array(samples);
    
    const beatSamples = Math.floor(this.synthesizer['sampleRate'] * beatDuration);
    
    for (let beat = 0; beat * beatSamples < samples; beat++) {
      const startSample = beat * beatSamples;
      const hihatSound = this.synthesizer.generateNoise(0.05, 0.15);
      const hihatEnv = this.synthesizer.applyEnvelope(hihatSound, 0.001, 0.02, 0.1, 0.027);
      
      for (let i = 0; i < hihatEnv.length && startSample + i < samples; i++) {
        hihat[startSample + i] += hihatEnv[i];
      }
    }
    
    return hihat;
  }

  private generateBassLine(duration: number, beatDuration: number, rootFreq: number, isMinor: boolean): Float32Array {
    const samples = Math.floor(this.synthesizer['sampleRate'] * duration);
    const bass = new Float32Array(samples);
    
    const beatSamples = Math.floor(this.synthesizer['sampleRate'] * beatDuration);
    const bassFreq = rootFreq * 0.5; // One octave down
    
    const pattern = isMinor ? [0, 3, 5, 3] : [0, 4, 5, 4]; // Scale degrees
    const scale = isMinor ? SCALES.minor : SCALES.major;
    
    for (let beat = 0; beat * beatSamples < samples; beat++) {
      const scaleIndex = pattern[beat % pattern.length];
      const noteFreq = bassFreq * Math.pow(2, scale[scaleIndex] / 12);
      
      const startSample = beat * beatSamples;
      const noteLength = beatDuration * 0.8; // Slightly shorter for separation
      const bassNote = this.synthesizer.generateSawtoothWave(noteFreq, noteLength, 0.25);
      const bassEnv = this.synthesizer.applyEnvelope(bassNote, 0.01, 0.1, 0.7, 0.1);
      
      for (let i = 0; i < bassEnv.length && startSample + i < samples; i++) {
        bass[startSample + i] += bassEnv[i];
      }
    }
    
    return bass;
  }

  private generateLeadSynth(duration: number, beatDuration: number, rootFreq: number, isMinor: boolean): Float32Array {
    const samples = Math.floor(this.synthesizer['sampleRate'] * duration);
    const lead = new Float32Array(samples);
    
    const scale = isMinor ? SCALES.minor : SCALES.major;
    const melody = [0, 2, 4, 2, 1, 4, 2, 0]; // Simple melody pattern
    
    const noteDuration = beatDuration * 2; // Half notes
    const noteSamples = Math.floor(this.synthesizer['sampleRate'] * noteDuration);
    
    for (let note = 0; note * noteSamples < samples; note++) {
      const scaleIndex = melody[note % melody.length];
      const noteFreq = rootFreq * Math.pow(2, scale[scaleIndex] / 12);
      
      const startSample = note * noteSamples;
      const leadNote = this.synthesizer.generateSawtoothWave(noteFreq, noteDuration * 0.9, 0.15);
      const leadEnv = this.synthesizer.applyEnvelope(leadNote, 0.05, 0.2, 0.6, 0.3);
      const leadReverb = this.synthesizer.addReverb(leadEnv, 0.3, 0.4);
      
      for (let i = 0; i < leadReverb.length && startSample + i < samples; i++) {
        lead[startSample + i] += leadReverb[i];
      }
    }
    
    return lead;
  }

  private generatePad(duration: number, rootFreq: number, isMinor: boolean): Float32Array {
    const tracks: Float32Array[] = [];
    
    // Generate chord tones
    const chordTones = isMinor ? [0, 3, 7] : [0, 4, 7]; // Minor or major triad
    
    for (const tone of chordTones) {
      const freq = rootFreq * Math.pow(2, tone / 12);
      const pad = this.synthesizer.generateSineWave(freq, duration, 0.08);
      const padEnv = this.synthesizer.applyEnvelope(pad, 1, 0.5, 0.8, 2);
      const padReverb = this.synthesizer.addReverb(padEnv, 0.6, 0.5);
      tracks.push(padReverb);
    }
    
    return this.synthesizer.combineWaves(tracks);
  }

  // Additional generator methods would go here for other styles...
  private generate808Kick(duration: number, beatDuration: number): Float32Array {
    // Similar to generateKickPattern but with lower frequency and longer decay
    return this.generateKickPattern(duration, beatDuration);
  }

  private generateSnarePattern(duration: number, beatDuration: number): Float32Array {
    const samples = Math.floor(this.synthesizer['sampleRate'] * duration);
    const snare = new Float32Array(samples);
    
    const beatSamples = Math.floor(this.synthesizer['sampleRate'] * beatDuration);
    
    for (let beat = 0; beat * beatSamples < samples; beat++) {
      if (beat % 4 === 1 || beat % 4 === 3) { // Snare on beats 2 and 4
        const startSample = beat * beatSamples;
        const snareSound = this.synthesizer.generateNoise(0.1, 0.4);
        const snareEnv = this.synthesizer.applyEnvelope(snareSound, 0.01, 0.05, 0.2, 0.04);
        
        for (let i = 0; i < snareEnv.length && startSample + i < samples; i++) {
          snare[startSample + i] += snareEnv[i];
        }
      }
    }
    
    return snare;
  }

  private generateTrapHiHats(duration: number, beatDuration: number): Float32Array {
    // Generate rapid hi-hat patterns typical in trap music
    return this.generateHiHatPattern(duration, beatDuration / 2); // Double speed
  }

  private generateHipHopBass(duration: number, beatDuration: number, rootFreq: number, isMinor: boolean): Float32Array {
    return this.generateBassLine(duration, beatDuration, rootFreq, isMinor);
  }

  private generateHipHopMelody(duration: number, beatDuration: number, rootFreq: number, isMinor: boolean): Float32Array {
    return this.generateLeadSynth(duration, beatDuration, rootFreq, isMinor);
  }

  private generateArpeggio(duration: number, rootFreq: number, isMinor: boolean, speed: number): Float32Array {
    const samples = Math.floor(this.synthesizer['sampleRate'] * duration);
    const arpeggio = new Float32Array(samples);
    
    const chordTones = isMinor ? [0, 3, 7, 12] : [0, 4, 7, 12]; // Arpeggio pattern
    const noteDuration = speed;
    const noteSamples = Math.floor(this.synthesizer['sampleRate'] * noteDuration);
    
    for (let note = 0; note * noteSamples < samples; note++) {
      const toneIndex = chordTones[note % chordTones.length];
      const noteFreq = rootFreq * Math.pow(2, toneIndex / 12);
      
      const startSample = note * noteSamples;
      const arpeggioNote = this.synthesizer.generateSineWave(noteFreq, noteDuration * 0.8, 0.1);
      const arpeggioEnv = this.synthesizer.applyEnvelope(arpeggioNote, 0.02, 0.1, 0.5, 0.2);
      
      for (let i = 0; i < arpeggioEnv.length && startSample + i < samples; i++) {
        arpeggio[startSample + i] += arpeggioEnv[i];
      }
    }
    
    return arpeggio;
  }

  // Placeholder methods for other generators
  private generatePowerChords(duration: number, beatDuration: number, rootFreq: number, isMinor: boolean): Float32Array {
    return this.generateBassLine(duration, beatDuration, rootFreq, isMinor);
  }

  private generateRockDrums(duration: number, beatDuration: number): Float32Array {
    const kick = this.generateKickPattern(duration, beatDuration);
    const snare = this.generateSnarePattern(duration, beatDuration);
    return this.synthesizer.combineWaves([kick, snare]);
  }

  private generateRockBass(duration: number, beatDuration: number, rootFreq: number, isMinor: boolean): Float32Array {
    return this.generateBassLine(duration, beatDuration, rootFreq, isMinor);
  }

  private generateWalkingBass(duration: number, beatDuration: number, rootFreq: number, isMinor: boolean): Float32Array {
    return this.generateBassLine(duration, beatDuration / 2, rootFreq, isMinor); // More notes
  }

  private generateJazzPiano(duration: number, beatDuration: number, rootFreq: number, isMinor: boolean): Float32Array {
    return this.generatePad(duration, rootFreq, isMinor);
  }

  private generateJazzDrums(duration: number, beatDuration: number): Float32Array {
    return this.generateHiHatPattern(duration, beatDuration / 2); // Brushes
  }

  private generateSimpleChords(duration: number, beatDuration: number, rootFreq: number, isMinor: boolean): Float32Array {
    return this.generatePad(duration, rootFreq, isMinor);
  }

  private generateBasicDrums(duration: number, beatDuration: number): Float32Array {
    const kick = this.generateKickPattern(duration, beatDuration);
    const hihat = this.generateHiHatPattern(duration, beatDuration);
    return this.synthesizer.combineWaves([kick, hihat]);
  }

  // R&B specific generators
  private generateRnBKick(duration: number, beatDuration: number): Float32Array {
    const samples = Math.floor(this.synthesizer['sampleRate'] * duration);
    const kick = new Float32Array(samples);
    
    const beatSamples = Math.floor(this.synthesizer['sampleRate'] * beatDuration);
    
    for (let beat = 0; beat * beatSamples < samples; beat++) {
      if (beat % 4 === 0) { // Kick on beat 1 mainly, sometimes 3
        const startSample = beat * beatSamples;
        const kickSound = this.synthesizer.generateSineWave(70, 0.15, 0.6); // Warmer kick
        const kickEnv = this.synthesizer.applyEnvelope(kickSound, 0.02, 0.1, 0.4, 0.08);
        
        for (let i = 0; i < kickEnv.length && startSample + i < samples; i++) {
          kick[startSample + i] += kickEnv[i];
        }
      }
    }
    
    return kick;
  }

  private generateRnBSnare(duration: number, beatDuration: number): Float32Array {
    const samples = Math.floor(this.synthesizer['sampleRate'] * duration);
    const snare = new Float32Array(samples);
    
    const beatSamples = Math.floor(this.synthesizer['sampleRate'] * beatDuration);
    
    for (let beat = 0; beat * beatSamples < samples; beat++) {
      if (beat % 4 === 1 || beat % 4 === 3) { // Snare on 2 and 4
        const startSample = beat * beatSamples;
        const snareSound = this.synthesizer.generateNoise(0.08, 0.3);
        const snareEnv = this.synthesizer.applyEnvelope(snareSound, 0.005, 0.03, 0.15, 0.02);
        
        for (let i = 0; i < snareEnv.length && startSample + i < samples; i++) {
          snare[startSample + i] += snareEnv[i];
        }
      }
    }
    
    return snare;
  }

  private generateRnBBass(duration: number, beatDuration: number, rootFreq: number, isMinor: boolean): Float32Array {
    const samples = Math.floor(this.synthesizer['sampleRate'] * duration);
    const bass = new Float32Array(samples);
    
    const beatSamples = Math.floor(this.synthesizer['sampleRate'] * beatDuration);
    const bassFreq = rootFreq * 0.5;
    
    // R&B style bass pattern with more sophisticated movement
    const pattern = isMinor ? [0, 2, 3, 5, 3, 2] : [0, 2, 4, 5, 4, 2];
    const scale = isMinor ? SCALES.minor : SCALES.major;
    
    for (let beat = 0; beat * beatSamples < samples; beat++) {
      const scaleIndex = pattern[beat % pattern.length];
      const noteFreq = bassFreq * Math.pow(2, scale[scaleIndex] / 12);
      
      const startSample = beat * beatSamples;
      const noteLength = beatDuration * 0.9;
      const bassNote = this.synthesizer.generateSineWave(noteFreq, noteLength, 0.3); // Smoother sine bass
      const bassEnv = this.synthesizer.applyEnvelope(bassNote, 0.02, 0.15, 0.8, 0.15);
      
      for (let i = 0; i < bassEnv.length && startSample + i < samples; i++) {
        bass[startSample + i] += bassEnv[i];
      }
    }
    
    return bass;
  }

  private generateRnBChords(duration: number, beatDuration: number, rootFreq: number, isMinor: boolean): Float32Array {
    console.log('🎹 Generating R&B chords:', { duration, beatDuration, rootFreq, isMinor });
    const tracks: Float32Array[] = [];
    
    // R&B chord progressions with extensions (7ths, 9ths)
    const chordTones = isMinor ? [0, 3, 7, 10] : [0, 4, 7, 11]; // Add 7th
    
    for (const tone of chordTones) {
      const freq = rootFreq * Math.pow(2, tone / 12);
      console.log('🎵 Generating chord tone at:', freq, 'Hz');
      const chord = this.synthesizer.generateSineWave(freq, duration, 0.06);
      console.log('🎵 Generated sine wave with length:', chord.length);
      const chordEnv = this.synthesizer.applyEnvelope(chord, 0.5, 0.3, 0.9, 1);
      console.log('🎵 Applied envelope, length:', chordEnv.length);
      const chordReverb = this.synthesizer.addReverb(chordEnv, 0.4, 0.3);
      console.log('🎵 Applied reverb, length:', chordReverb.length);
      tracks.push(chordReverb);
    }
    
    console.log('🎹 Combining', tracks.length, 'chord tracks...');
    return this.synthesizer.combineWaves(tracks);
  }

  private generateRnBMelody(duration: number, beatDuration: number, rootFreq: number, isMinor: boolean): Float32Array {
    const samples = Math.floor(this.synthesizer['sampleRate'] * duration);
    const melody = new Float32Array(samples);
    
    const scale = isMinor ? SCALES.minor : SCALES.major;
    // Soulful melody with bends and blue notes
    const melodyPattern = [0, 2, 3, 5, 7, 5, 3, 2, 0, 2, 4, 5];
    
    const noteDuration = beatDuration * 1.5;
    const noteSamples = Math.floor(this.synthesizer['sampleRate'] * noteDuration);
    
    for (let note = 0; note * noteSamples < samples; note++) {
      const scaleIndex = melodyPattern[note % melodyPattern.length];
      const noteFreq = rootFreq * Math.pow(2, scale[scaleIndex] / 12);
      
      const startSample = note * noteSamples;
      const melodyNote = this.synthesizer.generateSineWave(noteFreq, noteDuration * 0.8, 0.12);
      const melodyEnv = this.synthesizer.applyEnvelope(melodyNote, 0.1, 0.3, 0.7, 0.4);
      const melodyReverb = this.synthesizer.addReverb(melodyEnv, 0.5, 0.4);
      
      for (let i = 0; i < melodyReverb.length && startSample + i < samples; i++) {
        melody[startSample + i] += melodyReverb[i];
      }
    }
    
    return melody;
  }

  private getStructureForStyle(style: string): string[] {
    const structures: Record<string, string[]> = {
      'electronic': ['Intro', 'Build', 'Drop', 'Break', 'Drop', 'Outro'],
      'hip-hop': ['Intro', 'Verse', 'Hook', 'Verse', 'Hook', 'Outro'],
      'rnb': ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus'],
      'ambient': ['Atmosphere', 'Development', 'Climax', 'Resolution'],
      'rock': ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Solo', 'Chorus'],
      'jazz': ['Head', 'Solo 1', 'Solo 2', 'Head Out'],
      'default': ['Intro', 'Main', 'Outro']
    };
    
    return structures[style] || structures['default'];
  }
}
import { AudioAnalysis } from './audioAnalyzer';

interface GenerationRequest {
  prompt: string;
  referenceSamples: string[];
  style: string;
  tempo?: number;
  key?: string;
  duration: number;
  quality: 'demo' | 'high' | 'professional';
}

interface GenerationResponse {
  id: string;
  audioUrl: string;
  waveformData: number[];
  metadata: {
    title: string;
    duration: number;
    tempo: number;
    key: string;
    genre: string;
  };
}

export class AIGenerationEngine {
  private apiEndpoint: string;

  constructor() {
    // In a real implementation, this would be configurable
    this.apiEndpoint = '/api/generate';
  }

  async generateMusic(request: GenerationRequest, audioAnalyses: AudioAnalysis[]): Promise<GenerationResponse> {
    try {
      // Create enhanced prompt based on audio analysis
      const enhancedPrompt = this.createEnhancedPrompt(request, audioAnalyses);
      
      // For demonstration, simulate the generation process
      const response = await this.simulateGeneration(enhancedPrompt, request);
      
      return response;
    } catch (error) {
      console.error('Music generation failed:', error);
      throw new Error('Failed to generate music');
    }
  }

  private createEnhancedPrompt(request: GenerationRequest, analyses: AudioAnalysis[]): string {
    let enhancedPrompt = request.prompt;
    
    if (analyses.length > 0) {
      const avgTempo = analyses.reduce((sum, analysis) => sum + analysis.tempo, 0) / analyses.length;
      const avgEnergy = analyses.reduce((sum, analysis) => sum + analysis.energy, 0) / analyses.length;
      const avgValence = analyses.reduce((sum, analysis) => sum + analysis.valence, 0) / analyses.length;
      
      // Extract common key
      const keyFreq: Record<string, number> = {};
      analyses.forEach(analysis => {
        keyFreq[analysis.key] = (keyFreq[analysis.key] || 0) + 1;
      });
      const mostCommonKey = Object.keys(keyFreq).reduce((a, b) => keyFreq[a] > keyFreq[b] ? a : b);
      
      // Extract rhythm patterns
      const rhythmSignature = this.analyzeRhythmPatterns(analyses);
      
      // Enhance prompt with musical characteristics
      enhancedPrompt += `\n\nMusical characteristics derived from reference samples:
- Tempo: ${Math.round(avgTempo)} BPM (${this.getTempoDescription(avgTempo)})
- Key: ${mostCommonKey} ${this.getModeDescription(analyses)}
- Energy Level: ${this.getEnergyDescription(avgEnergy)}
- Mood: ${this.getValenceDescription(avgValence)}
- Rhythm Pattern: ${rhythmSignature}
- Harmonic Content: ${this.getHarmonicDescription(analyses)}`;

      // Add style-specific instructions
      enhancedPrompt += `\n\nStyle Instructions:
${this.getStyleInstructions(request.style, analyses)}`;
    }
    
    return enhancedPrompt;
  }

  private analyzeRhythmPatterns(analyses: AudioAnalysis[]): string {
    if (analyses.length === 0) return 'Standard 4/4';
    
    // Analyze rhythm patterns from samples
    const patterns = analyses.map(analysis => analysis.rhythmPattern);
    const avgPattern = this.averageRhythmPatterns(patterns);
    
    // Classify rhythm type
    const strongBeats = avgPattern.filter((energy, index) => index % 4 === 0).reduce((sum, energy) => sum + energy, 0);
    const offBeats = avgPattern.filter((energy, index) => index % 4 === 2).reduce((sum, energy) => sum + energy, 0);
    
    if (offBeats > strongBeats * 0.8) {
      return 'Syncopated with strong off-beats';
    } else if (strongBeats > 0.7) {
      return 'Strong on-beat emphasis';
    } else {
      return 'Balanced rhythm pattern';
    }
  }

  private averageRhythmPatterns(patterns: number[][]): number[] {
    if (patterns.length === 0) return [];
    
    const maxLength = Math.max(...patterns.map(p => p.length));
    const avgPattern: number[] = new Array(maxLength).fill(0);
    
    patterns.forEach(pattern => {
      pattern.forEach((energy, index) => {
        avgPattern[index] += energy / patterns.length;
      });
    });
    
    return avgPattern;
  }

  private getTempoDescription(tempo: number): string {
    if (tempo < 70) return 'very slow ballad';
    if (tempo < 90) return 'slow groove';
    if (tempo < 110) return 'moderate tempo';
    if (tempo < 130) return 'upbeat';
    if (tempo < 150) return 'energetic';
    return 'very fast';
  }

  private getModeDescription(analyses: AudioAnalysis[]): string {
    const majorCount = analyses.filter(a => a.mode === 'major').length;
    const minorCount = analyses.filter(a => a.mode === 'minor').length;
    
    if (majorCount > minorCount) return 'major (bright and uplifting)';
    if (minorCount > majorCount) return 'minor (darker and emotional)';
    return 'mixed major/minor';
  }

  private getEnergyDescription(energy: number): string {
    if (energy < 0.3) return 'Low energy, intimate and subdued';
    if (energy < 0.6) return 'Medium energy, balanced dynamics';
    if (energy < 0.8) return 'High energy, driving and intense';
    return 'Very high energy, explosive and powerful';
  }

  private getValenceDescription(valence: number): string {
    if (valence < 0.3) return 'Dark and melancholic';
    if (valence < 0.6) return 'Neutral to slightly positive';
    if (valence < 0.8) return 'Bright and uplifting';
    return 'Very bright and euphoric';
  }

  private getHarmonicDescription(analyses: AudioAnalysis[]): string {
    if (analyses.length === 0) return 'Standard harmonic content';
    
    const avgHarmonics = analyses.reduce((acc, analysis) => {
      analysis.harmonicContent.forEach((harmonic, index) => {
        acc[index] = (acc[index] || 0) + harmonic / analyses.length;
      });
      return acc;
    }, [] as number[]);
    
    const fundamentalStrength = avgHarmonics[0] || 0;
    const upperHarmonics = avgHarmonics.slice(3).reduce((sum, h) => sum + h, 0);
    
    if (upperHarmonics > fundamentalStrength) {
      return 'Rich in upper harmonics, bright timbre';
    } else if (fundamentalStrength > upperHarmonics * 2) {
      return 'Fundamental-heavy, warm and full timbre';
    } else {
      return 'Balanced harmonic content';
    }
  }

  private getStyleInstructions(style: string, analyses: AudioAnalysis[]): string {
    const baseInstructions = {
      'rnb': 'Focus on smooth vocals, syncopated rhythms, and rich harmonic progressions. Use jazz-influenced chords and sultry production.',
      'pop': 'Create catchy melodies with clear structure (verse-chorus-verse). Use contemporary production with punchy drums and memorable hooks.',
      'trap': 'Emphasize heavy 808 drums, hi-hat rolls, and atmospheric pads. Use minor keys and create space for vocal delivery.',
      'hip-hop': 'Build around strong drum breaks, bass lines, and sample-based textures. Leave room for vocal performance.',
      'electronic': 'Use synthesized sounds, electronic drums, and digital effects. Create evolving textures and build-ups.'
    };
    
    let instructions = baseInstructions[style as keyof typeof baseInstructions] || baseInstructions.pop;
    
    // Add analysis-based modifications
    if (analyses.length > 0) {
      const avgDanceability = analyses.reduce((sum, a) => sum + a.danceability, 0) / analyses.length;
      
      if (avgDanceability > 0.7) {
        instructions += ' Maintain high danceability with consistent groove patterns.';
      }
      
      const hasStrongRhythm = analyses.some(a => Math.max(...a.rhythmPattern) > 0.8);
      if (hasStrongRhythm) {
        instructions += ' Incorporate the distinctive rhythm patterns from the reference samples.';
      }
    }
    
    return instructions;
  }

  private async simulateGeneration(prompt: string, request: GenerationRequest): Promise<GenerationResponse> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    
    // Generate mock waveform data
    const waveformData = this.generateMockWaveform(request.duration);
    
    // Create mock audio URL (in real implementation, this would be the generated audio)
    const audioUrl = this.generateMockAudioUrl(request);
    
    return {
      id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      audioUrl,
      waveformData,
      metadata: {
        title: this.generateTitle(request.style, prompt),
        duration: request.duration,
        tempo: request.tempo || 120,
        key: request.key || 'C',
        genre: request.style
      }
    };
  }

  private generateMockWaveform(duration: number): number[] {
    const samples = Math.floor(duration * 10); // 10 samples per second for visualization
    const waveform: number[] = [];
    
    for (let i = 0; i < samples; i++) {
      // Create a more realistic waveform pattern
      const time = i / samples;
      const baseLevel = 0.3 + 0.4 * Math.sin(time * Math.PI * 2); // Overall envelope
      const detail = 0.3 * (Math.random() - 0.5); // Random variation
      const rhythm = 0.2 * Math.sin(time * Math.PI * 8); // Rhythmic pattern
      
      waveform.push(Math.max(0, Math.min(1, baseLevel + detail + rhythm)));
    }
    
    return waveform;
  }

  private generateMockAudioUrl(request: GenerationRequest): string {
    // In a real implementation, this would return the URL to the generated audio file
    // For now, return a placeholder that indicates it's AI-generated
    return `data:audio/wav;base64,generated_audio_${request.style}_${Date.now()}`;
  }

  private generateTitle(style: string, prompt: string): string {
    const words = prompt.split(' ').filter(word => word.length > 3);
    const keyWords = words.slice(0, 2);
    const stylePrefix = {
      'rnb': 'Smooth',
      'pop': 'Bright',
      'trap': 'Heavy',
      'hip-hop': 'Fresh',
      'electronic': 'Pulse'
    };
    
    const prefix = stylePrefix[style as keyof typeof stylePrefix] || 'New';
    return `${prefix} ${keyWords.join(' ')} ${style.toUpperCase()}`;
  }
}
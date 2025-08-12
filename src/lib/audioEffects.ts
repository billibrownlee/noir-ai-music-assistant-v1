export class AudioEffectsProcessor {
  private audioContext: AudioContext;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  // Reverse audio effect
  async reverseAudio(audioUrl: string): Promise<{ audioUrl: string; audioBlob: Blob }> {
    try {
      console.log('🔄 Starting audio reversal process...');
      
      // Fetch the audio file
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log('✅ Audio decoded:', audioBuffer.duration, 'seconds');
      
      // Create new buffer for reversed audio
      const reversedBuffer = this.audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );
      
      // Reverse each channel
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const originalData = audioBuffer.getChannelData(channel);
        const reversedData = reversedBuffer.getChannelData(channel);
        
        // Copy data in reverse order
        for (let i = 0; i < originalData.length; i++) {
          reversedData[i] = originalData[originalData.length - 1 - i];
        }
      }
      
      console.log('✅ Audio reversed successfully');
      
      // Convert back to audio blob
      const wavBlob = await this.audioBufferToWav(reversedBuffer);
      const reversedUrl = URL.createObjectURL(wavBlob);
      
      return { audioUrl: reversedUrl, audioBlob: wavBlob };
      
    } catch (error) {
      console.error('❌ Error reversing audio:', error);
      throw new Error(`Failed to reverse audio: ${error.message}`);
    }
  }

  // Speed up/slow down audio
  async changeSpeed(audioUrl: string, speedFactor: number): Promise<{ audioUrl: string; audioBlob: Blob }> {
    try {
      console.log('⚡ Changing audio speed by factor:', speedFactor);
      
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Calculate new buffer length
      const newLength = Math.floor(audioBuffer.length / speedFactor);
      const newBuffer = this.audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        newLength,
        audioBuffer.sampleRate
      );
      
      // Resample each channel
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const originalData = audioBuffer.getChannelData(channel);
        const newData = newBuffer.getChannelData(channel);
        
        for (let i = 0; i < newLength; i++) {
          const sourceIndex = Math.floor(i * speedFactor);
          if (sourceIndex < originalData.length) {
            newData[i] = originalData[sourceIndex];
          }
        }
      }
      
      const wavBlob = await this.audioBufferToWav(newBuffer);
      const newUrl = URL.createObjectURL(wavBlob);
      
      console.log('✅ Speed changed successfully');
      return { audioUrl: newUrl, audioBlob: wavBlob };
      
    } catch (error) {
      console.error('❌ Error changing speed:', error);
      throw new Error(`Failed to change speed: ${error.message}`);
    }
  }

  // Add echo effect
  async addEcho(audioUrl: string, delay: number = 0.3, feedback: number = 0.3): Promise<{ audioUrl: string; audioBlob: Blob }> {
    try {
      console.log('🔊 Adding echo effect...');
      
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const delayInSamples = Math.floor(delay * audioBuffer.sampleRate);
      const newLength = audioBuffer.length + delayInSamples;
      
      const newBuffer = this.audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        newLength,
        audioBuffer.sampleRate
      );
      
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const originalData = audioBuffer.getChannelData(channel);
        const newData = newBuffer.getChannelData(channel);
        
        // Copy original audio
        for (let i = 0; i < originalData.length; i++) {
          newData[i] = originalData[i];
        }
        
        // Add echo
        for (let i = 0; i < originalData.length; i++) {
          const echoIndex = i + delayInSamples;
          if (echoIndex < newLength) {
            newData[echoIndex] += originalData[i] * feedback;
          }
        }
      }
      
      const wavBlob = await this.audioBufferToWav(newBuffer);
      const newUrl = URL.createObjectURL(wavBlob);
      
      console.log('✅ Echo added successfully');
      return { audioUrl: newUrl, audioBlob: wavBlob };
      
    } catch (error) {
      console.error('❌ Error adding echo:', error);
      throw new Error(`Failed to add echo: ${error.message}`);
    }
  }

  // Pitch shift (simple implementation)
  async changePitch(audioUrl: string, pitchFactor: number): Promise<{ audioUrl: string; audioBlob: Blob }> {
    try {
      console.log('🎵 Changing pitch by factor:', pitchFactor);
      
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Simple pitch shifting by resampling (affects speed too)
      const newSampleRate = Math.floor(audioBuffer.sampleRate * pitchFactor);
      const newBuffer = this.audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        newSampleRate
      );
      
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const originalData = audioBuffer.getChannelData(channel);
        const newData = newBuffer.getChannelData(channel);
        
        for (let i = 0; i < originalData.length; i++) {
          newData[i] = originalData[i];
        }
      }
      
      const wavBlob = await this.audioBufferToWav(newBuffer);
      const newUrl = URL.createObjectURL(wavBlob);
      
      console.log('✅ Pitch changed successfully');
      return { audioUrl: newUrl, audioBlob: wavBlob };
      
    } catch (error) {
      console.error('❌ Error changing pitch:', error);
      throw new Error(`Failed to change pitch: ${error.message}`);
    }
  }

  // Convert AudioBuffer to WAV blob
  private async audioBufferToWav(audioBuffer: AudioBuffer): Promise<Blob> {
    const length = audioBuffer.length * audioBuffer.numberOfChannels * 2;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);
    
    // Write WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);
    
    // Write audio data
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = audioBuffer.getChannelData(channel)[i];
        const intSample = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, intSample < 0 ? intSample * 0x8000 : intSample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }
}

// Audio effects that can be applied
export const AUDIO_EFFECTS = {
  REVERSE: 'reverse',
  SPEED_UP: 'speed_up',
  SLOW_DOWN: 'slow_down',
  ECHO: 'echo',
  PITCH_UP: 'pitch_up',
  PITCH_DOWN: 'pitch_down',
} as const;

export type AudioEffect = typeof AUDIO_EFFECTS[keyof typeof AUDIO_EFFECTS];
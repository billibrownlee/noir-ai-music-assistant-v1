export interface AudioProcessingResult {
  success: boolean;
  processedAudioUrl?: string;
  processedData?: Float32Array;
  error?: string;
  processingTime: number;
}

export class AudioProcessor {
  private audioContext: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  // Load audio file and decode to AudioBuffer
  async loadAudioFile(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    return await this.getAudioContext().decodeAudioData(arrayBuffer);
  }

  // Convert AudioBuffer to Float32Array
  bufferToFloat32Array(buffer: AudioBuffer): Float32Array {
    const channelData = buffer.getChannelData(0); // Use first channel
    return new Float32Array(channelData);
  }

  // Convert Float32Array back to AudioBuffer
  float32ArrayToBuffer(data: Float32Array, sampleRate: number = 44100): AudioBuffer {
    const buffer = this.getAudioContext().createBuffer(1, data.length, sampleRate);
    // Create a new Float32Array with regular ArrayBuffer to ensure type compatibility
    const compatibleData = new Float32Array(data);
    buffer.copyToChannel(compatibleData, 0);
    return buffer;
  }

  // Convert AudioBuffer to Blob URL with proper WAV format
  async bufferToBlobUrl(buffer: AudioBuffer): Promise<string> {
    const numberOfChannels = buffer.numberOfChannels;
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    
    // Create WAV header - ensure proper format
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header with proper byte ordering
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM format
    view.setUint16(20, 1, true);  // Audio format
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true); // Bits per sample
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Convert audio data with proper interleaving for multi-channel
    let offset = 44;
    if (numberOfChannels === 1) {
      // Mono audio
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    } else {
      // Stereo/multi-channel audio - interleave channels
      for (let i = 0; i < length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const channelData = buffer.getChannelData(channel);
          const sample = Math.max(-1, Math.min(1, channelData[i]));
          view.setInt16(offset, sample * 0x7FFF, true);
          offset += 2;
        }
      }
    }
    
    const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    
    // Verify the created audio is valid
    
    // Additional validation for reverse audio
    if (blob.size === 0) {
      throw new Error('Generated audio blob is empty');
    }
    
    return url;
  }

  // Reverse audio - SAFE VERSION with proper multi-channel support
  async reverseAudio(file: File): Promise<AudioProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }

      if (!file.type.startsWith('audio/')) {
        throw new Error('File is not an audio file');
      }

      
      // Load and decode audio with error handling
      let buffer: AudioBuffer;
      try {
        buffer = await this.loadAudioFile(file);
        if (!buffer) {
          throw new Error('Failed to decode audio file');
        }
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'EncodingError') {
          throw new Error('Unsupported audio format. Please use WAV, MP3, or OGG format.');
        }
        throw new Error(`Failed to load audio: ${loadError instanceof Error ? loadError.message : 'Unknown error'}`);
      }

      // Handle multi-channel audio properly
      // Create reversed buffer with same properties
      const reversedBuffer = this.getAudioContext().createBuffer(
        buffer.numberOfChannels,
        buffer.length,
        buffer.sampleRate
      );

      // Reverse each channel
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        const reversedChannelData = reversedBuffer.getChannelData(channel);
        
        // Reverse the array
        for (let i = 0; i < channelData.length; i++) {
          reversedChannelData[i] = channelData[channelData.length - 1 - i];
        }
      }

      // Use first channel for processedData (for compatibility)
      const processedData = new Float32Array(reversedBuffer.getChannelData(0));
      
      // Convert back to buffer and create URL
      let processedAudioUrl: string;
      try {
        processedAudioUrl = await this.bufferToBlobUrl(reversedBuffer);
        if (!processedAudioUrl || processedAudioUrl.trim() === '') {
          throw new Error('Failed to create audio URL');
        }
      } catch (urlError) {
        throw new Error(`Failed to create audio file: ${urlError instanceof Error ? urlError.message : 'Unknown error'}`);
      }
      
      
      return {
        success: true,
        processedAudioUrl,
        processedData,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('❌ Audio reversal failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  // Change speed (and pitch) — all channels
  async changeSpeed(file: File, speedFactor: number): Promise<AudioProcessingResult> {
    const startTime = Date.now();
    try {
      const buffer = await this.loadAudioFile(file);
      const newLength = Math.floor(buffer.length / speedFactor);
      const newBuffer = this.getAudioContext().createBuffer(
        buffer.numberOfChannels, newLength, buffer.sampleRate
      );
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const src = buffer.getChannelData(ch);
        const dst = newBuffer.getChannelData(ch);
        for (let i = 0; i < newLength; i++) {
          const srcIdx = Math.floor(i * speedFactor);
          dst[i] = srcIdx < src.length ? src[srcIdx] : 0;
        }
      }
      const processedAudioUrl = await this.bufferToBlobUrl(newBuffer);
      return { success: true, processedAudioUrl, processedData: new Float32Array(newBuffer.getChannelData(0)), processingTime: Date.now() - startTime };
    } catch (error) {
      console.error('❌ Audio speed change failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', processingTime: Date.now() - startTime };
    }
  }

  // Apply fade in/out — all channels
  async applyFade(file: File, fadeInDuration: number = 0, fadeOutDuration: number = 0): Promise<AudioProcessingResult> {
    const startTime = Date.now();
    try {
      const buffer = await this.loadAudioFile(file);
      const { sampleRate, numberOfChannels, length } = buffer;
      const newBuffer = this.getAudioContext().createBuffer(numberOfChannels, length, sampleRate);
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const src = buffer.getChannelData(ch);
        const dst = newBuffer.getChannelData(ch);
        dst.set(src);
        if (fadeInDuration > 0) {
          const fadeInSamples = Math.floor(fadeInDuration * sampleRate);
          for (let i = 0; i < Math.min(fadeInSamples, length); i++) {
            dst[i] *= i / fadeInSamples;
          }
        }
        if (fadeOutDuration > 0) {
          const fadeOutSamples = Math.floor(fadeOutDuration * sampleRate);
          const startFadeOut = length - fadeOutSamples;
          for (let i = Math.max(0, startFadeOut); i < length; i++) {
            dst[i] *= (length - i) / fadeOutSamples;
          }
        }
      }
      const processedAudioUrl = await this.bufferToBlobUrl(newBuffer);
      return { success: true, processedAudioUrl, processedData: new Float32Array(newBuffer.getChannelData(0)), processingTime: Date.now() - startTime };
    } catch (error) {
      console.error('❌ Fade application failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', processingTime: Date.now() - startTime };
    }
  }

  // Normalize audio — peak found across all channels, applied to all channels
  async normalizeAudio(file: File): Promise<AudioProcessingResult> {
    const startTime = Date.now();
    try {
      const buffer = await this.loadAudioFile(file);
      let peak = 0;
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
          const abs = Math.abs(data[i]);
          if (abs > peak) peak = abs;
        }
      }
      const factor = peak > 0 ? 0.9 / peak : 1;
      const newBuffer = this.getAudioContext().createBuffer(
        buffer.numberOfChannels, buffer.length, buffer.sampleRate
      );
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const src = buffer.getChannelData(ch);
        const dst = newBuffer.getChannelData(ch);
        for (let i = 0; i < src.length; i++) dst[i] = src[i] * factor;
      }
      const processedAudioUrl = await this.bufferToBlobUrl(newBuffer);
      return { success: true, processedAudioUrl, processedData: new Float32Array(newBuffer.getChannelData(0)), processingTime: Date.now() - startTime };
    } catch (error) {
      console.error('❌ Audio normalization failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', processingTime: Date.now() - startTime };
    }
  }

  // Add simple distortion/overdrive — all channels
  async addDistortion(file: File, amount: number = 0.5): Promise<AudioProcessingResult> {
    const startTime = Date.now();
    try {
      const buffer = await this.loadAudioFile(file);
      const newBuffer = this.getAudioContext().createBuffer(
        buffer.numberOfChannels, buffer.length, buffer.sampleRate
      );
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const src = buffer.getChannelData(ch);
        const dst = newBuffer.getChannelData(ch);
        for (let i = 0; i < src.length; i++) {
          dst[i] = Math.tanh(src[i] * (1 + amount * 10)) * 0.8;
        }
      }
      const processedAudioUrl = await this.bufferToBlobUrl(newBuffer);
      return { success: true, processedAudioUrl, processedData: new Float32Array(newBuffer.getChannelData(0)), processingTime: Date.now() - startTime };
    } catch (error) {
      console.error('❌ Distortion application failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', processingTime: Date.now() - startTime };
    }
  }
}
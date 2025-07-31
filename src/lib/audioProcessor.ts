export interface AudioProcessingResult {
  success: boolean;
  processedAudioUrl?: string;
  processedData?: Float32Array;
  error?: string;
  processingTime: number;
}

export class AudioProcessor {
  private audioContext: AudioContext;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  // Load audio file and decode to AudioBuffer
  async loadAudioFile(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    return await this.audioContext.decodeAudioData(arrayBuffer);
  }

  // Convert AudioBuffer to Float32Array
  bufferToFloat32Array(buffer: AudioBuffer): Float32Array {
    const channelData = buffer.getChannelData(0); // Use first channel
    return new Float32Array(channelData);
  }

  // Convert Float32Array back to AudioBuffer
  float32ArrayToBuffer(data: Float32Array, sampleRate: number = 44100): AudioBuffer {
    const buffer = this.audioContext.createBuffer(1, data.length, sampleRate);
    buffer.copyToChannel(data, 0);
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
    console.log(`🎵 Created audio blob: ${url.substring(0, 50)}... (${blob.size} bytes)`);
    
    // Additional validation for reverse audio
    if (blob.size === 0) {
      throw new Error('Generated audio blob is empty');
    }
    
    return url;
  }

  // Reverse audio
  async reverseAudio(file: File): Promise<AudioProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔄 Starting audio reversal...');
      
      const buffer = await this.loadAudioFile(file);
      const channelData = buffer.getChannelData(0);
      
      // Create reversed data
      const reversedData = new Float32Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        reversedData[i] = channelData[channelData.length - 1 - i];
      }
      
      // Convert back to buffer and create URL
      const reversedBuffer = this.float32ArrayToBuffer(reversedData, buffer.sampleRate);
      const processedAudioUrl = await this.bufferToBlobUrl(reversedBuffer);
      
      console.log('✅ Audio reversed successfully');
      
      return {
        success: true,
        processedAudioUrl,
        processedData: reversedData,
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

  // Change speed (and pitch)
  async changeSpeed(file: File, speedFactor: number): Promise<AudioProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🎛️ Changing audio speed by ${speedFactor}x...`);
      
      const buffer = await this.loadAudioFile(file);
      const channelData = buffer.getChannelData(0);
      
      // Simple speed change by resampling
      const newLength = Math.floor(channelData.length / speedFactor);
      const processedData = new Float32Array(newLength);
      
      for (let i = 0; i < newLength; i++) {
        const sourceIndex = Math.floor(i * speedFactor);
        if (sourceIndex < channelData.length) {
          processedData[i] = channelData[sourceIndex];
        }
      }
      
      const processedBuffer = this.float32ArrayToBuffer(processedData, buffer.sampleRate);
      const processedAudioUrl = await this.bufferToBlobUrl(processedBuffer);
      
      console.log('✅ Audio speed changed successfully');
      
      return {
        success: true,
        processedAudioUrl,
        processedData,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('❌ Audio speed change failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  // Apply fade in/out
  async applyFade(file: File, fadeInDuration: number = 0, fadeOutDuration: number = 0): Promise<AudioProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🎚️ Applying fade: ${fadeInDuration}s in, ${fadeOutDuration}s out...`);
      
      const buffer = await this.loadAudioFile(file);
      const channelData = buffer.getChannelData(0);
      const sampleRate = buffer.sampleRate;
      
      const processedData = new Float32Array(channelData);
      
      // Apply fade in
      if (fadeInDuration > 0) {
        const fadeInSamples = Math.floor(fadeInDuration * sampleRate);
        for (let i = 0; i < Math.min(fadeInSamples, processedData.length); i++) {
          const fadeMultiplier = i / fadeInSamples;
          processedData[i] *= fadeMultiplier;
        }
      }
      
      // Apply fade out
      if (fadeOutDuration > 0) {
        const fadeOutSamples = Math.floor(fadeOutDuration * sampleRate);
        const startFadeOut = processedData.length - fadeOutSamples;
        for (let i = startFadeOut; i < processedData.length; i++) {
          const fadeMultiplier = (processedData.length - i) / fadeOutSamples;
          processedData[i] *= fadeMultiplier;
        }
      }
      
      const processedBuffer = this.float32ArrayToBuffer(processedData, sampleRate);
      const processedAudioUrl = await this.bufferToBlobUrl(processedBuffer);
      
      console.log('✅ Fade applied successfully');
      
      return {
        success: true,
        processedAudioUrl,
        processedData,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('❌ Fade application failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  // Normalize audio
  async normalizeAudio(file: File): Promise<AudioProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log('📈 Normalizing audio...');
      
      const buffer = await this.loadAudioFile(file);
      const channelData = buffer.getChannelData(0);
      
      // Find peak
      let peak = 0;
      for (let i = 0; i < channelData.length; i++) {
        const abs = Math.abs(channelData[i]);
        if (abs > peak) peak = abs;
      }
      
      // Normalize to 90% to prevent clipping
      const normalizationFactor = peak > 0 ? 0.9 / peak : 1;
      const processedData = new Float32Array(channelData.length);
      
      for (let i = 0; i < channelData.length; i++) {
        processedData[i] = channelData[i] * normalizationFactor;
      }
      
      const processedBuffer = this.float32ArrayToBuffer(processedData, buffer.sampleRate);
      const processedAudioUrl = await this.bufferToBlobUrl(processedBuffer);
      
      console.log('✅ Audio normalized successfully');
      
      return {
        success: true,
        processedAudioUrl,
        processedData,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('❌ Audio normalization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  // Add simple distortion/overdrive
  async addDistortion(file: File, amount: number = 0.5): Promise<AudioProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🎸 Adding distortion (${amount * 100}%)...`);
      
      const buffer = await this.loadAudioFile(file);
      const channelData = buffer.getChannelData(0);
      const processedData = new Float32Array(channelData.length);
      
      for (let i = 0; i < channelData.length; i++) {
        let sample = channelData[i];
        // Simple waveshaping distortion
        sample = Math.tanh(sample * (1 + amount * 10)) * 0.8;
        processedData[i] = sample;
      }
      
      const processedBuffer = this.float32ArrayToBuffer(processedData, buffer.sampleRate);
      const processedAudioUrl = await this.bufferToBlobUrl(processedBuffer);
      
      console.log('✅ Distortion applied successfully');
      
      return {
        success: true,
        processedAudioUrl,
        processedData,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('❌ Distortion application failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }
}
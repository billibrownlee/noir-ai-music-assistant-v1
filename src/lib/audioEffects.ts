export class AudioEffectsProcessor {
  private audioContext: AudioContext | null = null;
  private isProcessing: boolean = false;

  constructor() {
    // Don't create AudioContext immediately - wait for user interaction
  }

  // Initialize AudioContext safely (required for user interaction)
  private async initAudioContext(): Promise<AudioContext> {
    try {
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error('Web Audio API not supported in this browser');
        }
        this.audioContext = new AudioContextClass();
      }
      
      // Resume context if suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      return this.audioContext;
    } catch (error) {
      console.error('Error initializing AudioContext:', error);
      throw new Error(`Failed to initialize audio context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Reverse audio effect - SAFE VERSION with proper error handling
  async reverseAudio(audioUrl: string): Promise<{ audioUrl: string; audioBlob: Blob }> {
    try {
      // Validate input
      if (!audioUrl || audioUrl.trim() === '') {
        throw new Error('No audio URL provided');
      }

      // Validate URL format
      try {
        new URL(audioUrl);
      } catch (urlError) {
        throw new Error('Invalid audio URL format');
      }

      // Prevent concurrent processing
      if (this.isProcessing) {
        throw new Error('Audio processing already in progress. Please wait for the current operation to complete.');
      }

      this.isProcessing = true;
      
      // Initialize AudioContext (required for user interaction)
      const audioContext = await this.initAudioContext();
      
      // Fetch the audio file with error handling
      let response: Response;
      try {
        response = await fetch(audioUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
        }
      } catch (fetchError) {
        throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Failed to fetch audio file'}`);
      }

      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = await response.arrayBuffer();
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          throw new Error('Audio file is empty');
        }
      } catch (bufferError) {
        throw new Error(`Failed to read audio data: ${bufferError instanceof Error ? bufferError.message : 'Unknown error'}`);
      }
      
      // Decode audio data with error handling
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        if (!audioBuffer) {
          throw new Error('Failed to decode audio file');
        }
      } catch (decodeError) {
        if (decodeError instanceof DOMException && decodeError.name === 'EncodingError') {
          throw new Error('Unsupported audio format. Please use WAV, MP3, or OGG format.');
        }
        throw new Error(`Failed to decode audio: ${decodeError instanceof Error ? decodeError.message : 'Unknown decoding error'}`);
      }
      
      // Create new buffer for reversed audio
      let reversedBuffer: AudioBuffer;
      try {
        reversedBuffer = audioContext.createBuffer(
          audioBuffer.numberOfChannels,
          audioBuffer.length,
          audioBuffer.sampleRate
        );
      } catch (bufferError) {
        throw new Error(`Failed to create audio buffer: ${bufferError instanceof Error ? bufferError.message : 'Unknown error'}`);
      }
      
      // Reverse each channel with progress tracking for large files
      try {
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          const originalData = audioBuffer.getChannelData(channel);
          const reversedData = reversedBuffer.getChannelData(channel);
          
          // Copy data in reverse order
          // For very large files, this might take a moment
          for (let i = 0; i < originalData.length; i++) {
            reversedData[i] = originalData[originalData.length - 1 - i];
          }
        }
      } catch (processingError) {
        throw new Error(`Failed to reverse audio data: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`);
      }
      
      
      // Convert back to audio blob with error handling
      let wavBlob: Blob;
      let reversedUrl: string;
      try {
        wavBlob = await this.audioBufferToWav(reversedBuffer);
        if (!wavBlob || wavBlob.size === 0) {
          throw new Error('Generated audio blob is empty');
        }
        reversedUrl = URL.createObjectURL(wavBlob);
      } catch (blobError) {
        throw new Error(`Failed to create audio file: ${blobError instanceof Error ? blobError.message : 'Unknown error'}`);
      }
      
      this.isProcessing = false;
      return { audioUrl: reversedUrl, audioBlob: wavBlob };
      
    } catch (error) {
      this.isProcessing = false;
      console.error('❌ Error reversing audio:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to reverse audio: ${errorMessage}`);
    }
  }

  // Speed up/slow down audio
  async changeSpeed(audioUrl: string, speedFactor: number): Promise<{ audioUrl: string; audioBlob: Blob }> {
    if (this.isProcessing) {
      throw new Error('Audio processing already in progress. Please wait for the current operation to complete.');
    }
    this.isProcessing = true;
    try {
      // Clamp speed factor to a safe range to prevent memory exhaustion or empty buffers
      const safeFactor = Math.max(0.1, Math.min(10, speedFactor));

      // Initialize AudioContext
      const audioContext = await this.initAudioContext();

      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Calculate new buffer length
      const newLength = Math.max(1, Math.floor(audioBuffer.length / safeFactor));
      const newBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        newLength,
        audioBuffer.sampleRate
      );
      
      // Resample each channel
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const originalData = audioBuffer.getChannelData(channel);
        const newData = newBuffer.getChannelData(channel);
        
        for (let i = 0; i < newLength; i++) {
          const sourceIndex = Math.floor(i * safeFactor);
          if (sourceIndex < originalData.length) {
            newData[i] = originalData[sourceIndex];
          }
        }
      }
      
      const wavBlob = await this.audioBufferToWav(newBuffer);
      const newUrl = URL.createObjectURL(wavBlob);
      
      return { audioUrl: newUrl, audioBlob: wavBlob };
      
    } catch (error) {
      console.error('❌ Error changing speed:', error);
      throw new Error(`Failed to change speed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.isProcessing = false;
    }
  }

  // Add echo effect
  async addEcho(audioUrl: string, delay: number = 0.3, feedback: number = 0.3): Promise<{ audioUrl: string; audioBlob: Blob }> {
    try {
      
      // Initialize AudioContext
      const audioContext = await this.initAudioContext();
      
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const delayInSamples = Math.floor(delay * audioBuffer.sampleRate);
      const newLength = audioBuffer.length + delayInSamples;
      
      const newBuffer = audioContext.createBuffer(
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
      
      return { audioUrl: newUrl, audioBlob: wavBlob };
      
    } catch (error) {
      console.error('❌ Error adding echo:', error);
      throw new Error(`Failed to add echo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Pitch shift (simple implementation)
  async changePitch(audioUrl: string, pitchFactor: number): Promise<{ audioUrl: string; audioBlob: Blob }> {
    try {
      
      // Initialize AudioContext
      const audioContext = await this.initAudioContext();
      
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Simple pitch shifting by resampling (affects speed too)
      const newSampleRate = Math.floor(audioBuffer.sampleRate * pitchFactor);
      const newBuffer = audioContext.createBuffer(
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
      
      return { audioUrl: newUrl, audioBlob: wavBlob };
      
    } catch (error) {
      console.error('❌ Error changing pitch:', error);
      throw new Error(`Failed to change pitch: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
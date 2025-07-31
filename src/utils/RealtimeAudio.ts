import { supabase } from '@/integrations/supabase/client';

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      console.log('🎤 Starting high-quality audio recording...');
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioContext = new AudioContext({
        sampleRate: 24000,
      });
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        this.onAudioData(new Float32Array(inputData));
      };
      
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      console.log('✅ Audio recording started successfully');
    } catch (error) {
      console.error('❌ Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    console.log('🛑 Stopping audio recording...');
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export interface RealtimeMessage {
  type: string;
  content?: string;
  audio?: string;
  timestamp: Date;
  role: 'user' | 'assistant';
}

export class RealtimeChat {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audioEl: HTMLAudioElement;
  private recorder: AudioRecorder | null = null;
  private isConnected = false;

  constructor(
    private onMessage: (message: RealtimeMessage) => void,
    private onStatusChange: (status: 'connecting' | 'connected' | 'disconnected') => void,
    private onSpeaking: (speaking: boolean) => void
  ) {
    this.audioEl = document.createElement("audio");
    this.audioEl.autoplay = true;
  }

  async init(voice: string = 'nova', instructions?: string) {
    try {
      this.onStatusChange('connecting');
      console.log('🚀 Initializing high-quality realtime chat...');

      // Get ephemeral token from our Supabase Edge Function
      const { data: tokenData, error } = await supabase.functions.invoke("realtime-token", {
        body: { voice, instructions }
      });

      if (error) {
        console.error('❌ Token error:', error);
        throw error;
      }

      if (!tokenData?.client_secret?.value) {
        throw new Error("Failed to get ephemeral token");
      }

      const EPHEMERAL_KEY = tokenData.client_secret.value;
      console.log('✅ Ephemeral token obtained');

      // Create peer connection with optimized settings
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Set up remote audio with high quality
      this.pc.ontrack = e => {
        console.log('🎵 Received remote audio track');
        this.audioEl.srcObject = e.streams[0];
      };

      // Add local audio track with high quality constraints
      const ms = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.pc.addTrack(ms.getTracks()[0]);

      // Set up data channel for events
      this.dc = this.pc.createDataChannel("oai-events");
      this.dc.addEventListener("message", (e) => {
        const event = JSON.parse(e.data);
        this.handleRealtimeEvent(event);
      });

      this.dc.addEventListener("open", () => {
        console.log('📡 Data channel opened');
        this.isConnected = true;
        this.onStatusChange('connected');
      });

      this.dc.addEventListener("close", () => {
        console.log('📡 Data channel closed');
        this.isConnected = false;
        this.onStatusChange('disconnected');
      });

      // Create and set local description
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // Connect to OpenAI's Realtime API
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp"
        },
      });

      if (!sdpResponse.ok) {
        throw new Error(`Failed to connect to OpenAI: ${sdpResponse.status}`);
      }

      const answer = {
        type: "answer" as RTCSdpType,
        sdp: await sdpResponse.text(),
      };
      
      await this.pc.setRemoteDescription(answer);
      console.log('✅ WebRTC connection established with OpenAI Realtime API');

      // Start recording after connection is established
      this.recorder = new AudioRecorder((audioData) => {
        if (this.dc?.readyState === 'open') {
          this.dc.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: this.encodeAudioData(audioData)
          }));
        }
      });
      await this.recorder.start();

    } catch (error) {
      console.error("❌ Error initializing realtime chat:", error);
      this.onStatusChange('disconnected');
      throw error;
    }
  }

  private handleRealtimeEvent(event: any) {
    console.log("📨 Received realtime event:", event.type);

    switch (event.type) {
      case 'response.audio_transcript.delta':
        this.onMessage({
          type: 'transcript',
          content: event.delta,
          timestamp: new Date(),
          role: 'assistant'
        });
        break;

      case 'response.audio.delta':
        this.onSpeaking(true);
        break;

      case 'response.audio.done':
        this.onSpeaking(false);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        this.onMessage({
          type: 'user_transcript',
          content: event.transcript,
          timestamp: new Date(),
          role: 'user'
        });
        break;

      case 'response.function_call_arguments.done':
        console.log('🔧 Function call:', event.name, event.arguments);
        // Handle function calls for music production tools
        this.handleFunctionCall(event.name, JSON.parse(event.arguments));
        break;

      case 'error':
        console.error('❌ Realtime API error:', event);
        break;

      default:
        console.log('📝 Unhandled event type:', event.type);
    }
  }

  private handleFunctionCall(name: string, args: any) {
    const message: RealtimeMessage = {
      type: 'function_call',
      content: `🔧 ${name}: ${JSON.stringify(args, null, 2)}`,
      timestamp: new Date(),
      role: 'assistant'
    };
    this.onMessage(message);
  }

  private encodeAudioData(float32Array: Float32Array): string {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }

  async sendMessage(text: string) {
    if (!this.dc || this.dc.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    console.log('📤 Sending text message:', text);

    const event = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text
          }
        ]
      }
    };

    this.dc.send(JSON.stringify(event));
    this.dc.send(JSON.stringify({type: 'response.create'}));

    // Add user message to chat
    this.onMessage({
      type: 'text',
      content: text,
      timestamp: new Date(),
      role: 'user'
    });
  }

  disconnect() {
    console.log('🛑 Disconnecting realtime chat...');
    this.recorder?.stop();
    this.dc?.close();
    this.pc?.close();
    this.isConnected = false;
    this.onStatusChange('disconnected');
  }

  get connected() {
    return this.isConnected;
  }
}
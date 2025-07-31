import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, duration = 30, style = "electronic", instrumental = true } = await req.json()

    if (!prompt) {
      throw new Error('Audio generation prompt is required')
    }

    console.log('🎵 Generating music with prompt:', prompt)

    // Create a sophisticated prompt enhancement without external API
    const enhancePrompt = (userPrompt: string, style: string, duration: number, instrumental: boolean) => {
      const styleDescriptions = {
        'electronic': 'synthesizers, digital beats, ambient pads, electronic textures',
        'hip-hop': '808 drums, trap snares, deep bass, urban atmosphere',
        'pop': 'catchy melodies, upbeat rhythm, mainstream appeal, polished production',
        'rock': 'electric guitars, powerful drums, energetic tempo, driving force',
        'jazz': 'complex harmonies, swing rhythm, improvisation, sophisticated chord progressions',
        'classical': 'orchestral instruments, formal structure, dynamic range, classical composition',
        'ambient': 'atmospheric soundscapes, reverb, dreamy textures, peaceful mood',
        'funk': 'groovy basslines, tight drums, rhythmic patterns, danceable beat',
        'experimental': 'unique sounds, creative textures, unconventional structure'
      };

      const durationDescription = duration < 30 ? 'short loop' : duration < 60 ? 'standard length' : 'extended composition';
      const vocalDescription = instrumental ? 'purely instrumental' : 'with vocal elements';
      
      return `${userPrompt} - ${styleDescriptions[style] || style} style, ${durationDescription}, ${vocalDescription}, professional quality`;
    };

    const enhancedPrompt = enhancePrompt(prompt, style, duration, instrumental);
    console.log('✅ Enhanced prompt created:', enhancedPrompt)

    // Generate realistic music metadata
    const generateMetadata = (style: string) => {
      const styleBPM = {
        'electronic': { min: 120, max: 140 },
        'hip-hop': { min: 70, max: 100 },
        'pop': { min: 100, max: 130 },
        'rock': { min: 110, max: 150 },
        'jazz': { min: 80, max: 120 },
        'classical': { min: 60, max: 100 },
        'ambient': { min: 60, max: 90 },
        'funk': { min: 100, max: 130 },
        'experimental': { min: 80, max: 140 }
      };

      const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const modes = ['major', 'minor'];
      
      const bpmRange = styleBPM[style] || { min: 80, max: 140 };
      const bpm = Math.floor(Math.random() * (bpmRange.max - bpmRange.min + 1)) + bpmRange.min;
      const key = keys[Math.floor(Math.random() * keys.length)];
      const mode = modes[Math.floor(Math.random() * modes.length)];
      
      return {
        bpm,
        key: `${key} ${mode}`,
        genre: style,
        energy: Math.random() * 0.5 + 0.5 // 0.5-1.0
      };
    };

    const metadata = generateMetadata(style);

    // Create demo audio response
    const mockAudioData = {
      id: `gen_${Date.now()}`,
      prompt: enhancedPrompt,
      originalPrompt: prompt,
      duration: duration,
      style: style,
      instrumental: instrumental,
      // This would be real audio data from the AI service
      audioUrl: `data:audio/wav;base64,${btoa('mock_audio_data_' + Date.now())}`,
      generationTime: Math.random() * 8 + 3, // 3-11 seconds
      metadata
    };

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000))

    return new Response(
      JSON.stringify({
        success: true,
        audio: mockAudioData,
        message: 'Music generation completed successfully!',
        note: 'This is a demo response. In production, this would generate real audio using AI music generation services.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )

  } catch (error) {
    console.error('❌ Music generation error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
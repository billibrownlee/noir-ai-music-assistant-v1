import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, voice = 'nova', model = 'tts-1-hd', speed = 1.0 } = await req.json()

    if (!text) {
      throw new Error('Text is required')
    }

    console.log('🎤 Generating high-quality audio:', { text: text.substring(0, 50) + '...', voice, model, speed })

    // Generate speech with maximum quality settings
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model, // tts-1-hd for highest quality
        input: text,
        voice: voice, // nova, alloy, echo, fable, onyx, shimmer
        response_format: 'mp3', // High quality MP3
        speed: speed, // 0.25 to 4.0
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ OpenAI TTS API error:', errorText)
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    // Get audio as array buffer
    const arrayBuffer = await response.arrayBuffer()
    console.log('✅ Audio generated successfully, size:', arrayBuffer.byteLength, 'bytes')

    // Convert to base64 for easy transmission
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    )

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        format: 'mp3',
        voice: voice,
        model: model,
        size: arrayBuffer.byteLength
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('❌ Audio generation error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
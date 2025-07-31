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

    // Use OpenAI to create a detailed music prompt for better generation
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `You are an expert music prompt engineer. Transform user requests into detailed music generation prompts that include:
            - Musical style and genre
            - Tempo/BPM suggestions
            - Instrumentation details
            - Mood and energy level
            - Musical structure
            
            Keep prompts under 200 characters and focus on concrete musical elements.`
          },
          {
            role: 'user',
            content: `Create a detailed music generation prompt for: "${prompt}". Style: ${style}. Duration: ${duration}s. ${instrumental ? 'Instrumental only.' : 'May include vocals.'}`
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      }),
    })

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`)
    }

    const openaiData = await openaiResponse.json()
    const enhancedPrompt = openaiData.choices[0].message.content

    console.log('✅ Enhanced prompt created:', enhancedPrompt)

    // For now, create a mock response that represents what would come from a music AI
    // In a real implementation, this would call Suno AI, ElevenLabs Music, or similar
    const mockAudioData = {
      id: `gen_${Date.now()}`,
      prompt: enhancedPrompt,
      originalPrompt: prompt,
      duration: duration,
      style: style,
      instrumental: instrumental,
      // This would be real audio data from the AI service
      audioUrl: `data:audio/wav;base64,${btoa('mock_audio_data_' + Date.now())}`,
      generationTime: Math.random() * 10 + 5, // 5-15 seconds
      metadata: {
        bpm: Math.floor(Math.random() * 60) + 80, // 80-140 BPM
        key: ['C', 'D', 'E', 'F', 'G', 'A', 'B'][Math.floor(Math.random() * 7)],
        genre: style,
        energy: Math.random() * 0.5 + 0.5 // 0.5-1.0
      }
    }

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
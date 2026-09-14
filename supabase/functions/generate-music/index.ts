import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE = 'https://api.replicate.com'

async function getModelVersion(apiKey: string): Promise<string> {
  const res = await fetch(`${BASE}/v1/models/meta/musicgen`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Could not look up MusicGen version (${res.status})`)
  const data = await res.json()
  const version: string | undefined = data?.latest_version?.id
  if (!version) throw new Error('MusicGen model info did not contain a version ID')
  return version
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY')
    if (!REPLICATE_API_KEY) {
      throw new Error('REPLICATE_API_KEY is not configured in Edge Function environment')
    }

    const { prompt, duration = 30, style = '', referenceAudioUrl } = await req.json()
    if (!prompt) throw new Error('prompt is required')

    // Enrich prompt with style context (skipped when style is empty — caller pre-enriched)
    const styleMap: Record<string, string> = {
      'hip-hop': 'hip hop, trap, 808 drums, urban',
      'rnb': 'R&B, soul, smooth, soulful',
      'pop': 'pop, catchy, mainstream, radio-ready',
      'electronic': 'electronic, synthesizers, digital beats',
      'rock': 'rock, electric guitar, powerful drums',
      'jazz': 'jazz, complex harmonies, swing',
      'classical': 'classical, orchestral, formal',
      'ambient': 'ambient, atmospheric, chill',
      'funk': 'funk, groovy basslines, rhythmic',
    }
    const styleTag = style ? (styleMap[style] ?? style) : null
    const enrichedPrompt = styleTag
      ? `${prompt}. ${styleTag} style, professional quality, high fidelity.`
      : prompt

    const safeDuration = Math.min(Math.max(Math.round(duration), 5), 30)
    const usesMelody = typeof referenceAudioUrl === 'string' &&
      referenceAudioUrl.startsWith('http') // only support public URLs server-side

    // Look up the latest MusicGen version
    const version = await getModelVersion(REPLICATE_API_KEY)

    const input: Record<string, unknown> = {
      prompt: enrichedPrompt,
      model_version: usesMelody ? 'melody-large' : 'large',
      duration: safeDuration,
      normalization_strategy: 'peak',
      top_k: 250,
      temperature: 1.0,
      output_format: 'wav',
    }

    if (usesMelody && referenceAudioUrl) {
      input.melody = referenceAudioUrl
    }

    // Create prediction with synchronous wait (up to 60s)
    const createRes = await fetch(`${BASE}/v1/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({ version, input }),
    })

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as Record<string, unknown>
      const msg = (typeof err.detail === 'string' ? err.detail : '') ||
        (typeof err.error === 'string' ? err.error : '') ||
        `Replicate ${createRes.status}`
      throw new Error(msg)
    }

    let prediction = await createRes.json() as {
      status: string; output?: unknown; error?: unknown;
      urls: { get: string; cancel: string }
    }

    // Poll for completion (max 120s, 2s interval = 60 attempts)
    let attempts = 0
    while (
      prediction.status !== 'succeeded' &&
      prediction.status !== 'failed' &&
      prediction.status !== 'canceled' &&
      attempts < 60
    ) {
      await new Promise(r => setTimeout(r, 2000))
      attempts++
      const pollRes = await fetch(prediction.urls.get, {
        headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
      })
      if (pollRes.ok) prediction = await pollRes.json()
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(
        typeof prediction.error === 'string' ? prediction.error : 'Generation failed on Replicate'
      )
    }
    if (prediction.status !== 'succeeded') {
      throw new Error('Generation timed out after 2 minutes. Try a shorter duration.')
    }

    const raw = prediction.output
    const audioUrl = Array.isArray(raw) ? (raw as string[])[0] : (raw as string)
    if (!audioUrl) throw new Error('No audio URL in Replicate response')

    return new Response(
      JSON.stringify({ audioUrl, enrichedPrompt, duration: safeDuration, usedReference: usesMelody }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (error) {
    console.error('generate-music error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

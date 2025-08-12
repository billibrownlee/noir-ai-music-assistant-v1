import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const { voice = 'alloy', instructions } = await req.json();

    console.log('🎤 Creating high-quality realtime session with voice:', voice);

    // Request an ephemeral token from OpenAI Realtime API
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: voice,
        instructions: instructions || "You are a helpful AI music production assistant. You can help with music creation, audio editing, mixing, mastering, and general music production advice. Be conversational and supportive.",
        modalities: ["text", "audio"],
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1"
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        },
        tools: [
          {
            type: "function",
            name: "analyze_audio_file",
            description: "Analyze an audio file for BPM, key, and other musical characteristics",
            parameters: {
              type: "object",
              properties: {
                filename: { type: "string" },
                analysis_type: { type: "string", enum: ["basic", "detailed", "professional"] }
              },
              required: ["filename"]
            }
          },
          {
            type: "function", 
            name: "suggest_chord_progression",
            description: "Suggest chord progressions for a given key and genre",
            parameters: {
              type: "object",
              properties: {
                key: { type: "string" },
                genre: { type: "string" },
                complexity: { type: "string", enum: ["simple", "intermediate", "advanced"] }
              },
              required: ["key", "genre"]
            }
          },
          {
            type: "function",
            name: "mixing_advice",
            description: "Provide mixing advice for specific instruments or overall mix",
            parameters: {
              type: "object",
              properties: {
                instrument: { type: "string" },
                issue: { type: "string" },
                genre: { type: "string" }
              },
              required: ["issue"]
            }
          }
        ],
        tool_choice: "auto",
        temperature: 0.8,
        max_response_output_tokens: "inf"
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI Realtime API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("✅ Realtime session created successfully:", data.id);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("❌ Error creating realtime session:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
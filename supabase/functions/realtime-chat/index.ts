import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // No app screen uses this function today, and every session is paid for with the project's OpenAI key.
  // It stays switched off until REALTIME_CHAT_ENABLED=true is set as an Edge Function secret.
  if (Deno.env.get('REALTIME_CHAT_ENABLED') !== 'true') {
    return new Response('AI voice chat is switched off', { status: 503, headers: corsHeaders });
  }

  // Verify JWT authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (authError || !user) {
    console.error('Authentication failed:', authError);
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }



  // At most 5 sessions per person per 10 minutes.
  const rl = await handleRateLimit(req, 'realtime-chat', 5, 10 * 60 * 1000);
  if (!rl.allowed && rl.response) return rl.response;

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400, headers: corsHeaders });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set');
    return new Response("Server configuration error", { status: 500, headers: corsHeaders });
  }

  let openAISocket: WebSocket | null = null;
  let sessionCreated = false;

  // A session ends after 10 minutes, and the client may only send audio and chat messages: it cannot change the
  // model settings (instructions, tools, voice) with its own session.update.
  const MAX_SESSION_MS = 10 * 60 * 1000;
  const MAX_CLIENT_MESSAGE_BYTES = 256 * 1024;
  const ALLOWED_CLIENT_TYPES = new Set([
    'input_audio_buffer.append', 'input_audio_buffer.commit', 'input_audio_buffer.clear',
    'conversation.item.create', 'conversation.item.truncate', 'response.create', 'response.cancel',
  ]);
  const sessionTimer = setTimeout(() => { try { socket.close(); } catch { /* already closed */ } }, MAX_SESSION_MS);

  socket.onopen = () => {

    
    // Connect to OpenAI Realtime API
    openAISocket = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17", [
      "realtime",
      `openai-insecure-api-key.${OPENAI_API_KEY}`,
      "openai-beta.realtime-v1"
    ]);

    openAISocket.onopen = () => {

    };

    openAISocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);


        if (data.type === 'session.created' && !sessionCreated) {
          sessionCreated = true;
          const sessionUpdate = {
            type: 'session.update',
            session: {
              modalities: ["text", "audio"],
              instructions: "You are a helpful AI assistant for CineSphere, a film industry platform. You help users with film industry questions, networking, and creative discussions. Be friendly, knowledgeable about cinema, and supportive of their creative endeavors.",
              voice: "alloy",
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
                  name: "search_films",
                  description: "Search for films and get information about them",
                  parameters: {
                    type: "object",
                    properties: {
                      query: { type: "string" }
                    },
                    required: ["query"]
                  }
                },
                {
                  type: "function", 
                  name: "get_industry_insights",
                  description: "Get insights about film industry trends and opportunities",
                  parameters: {
                    type: "object",
                    properties: {
                      category: { type: "string" }
                    },
                    required: ["category"]
                  }
                }
              ],
              tool_choice: "auto",
              temperature: 0.8,
              max_response_output_tokens: 1024
            }
          };
          
          openAISocket?.send(JSON.stringify(sessionUpdate));

        }

        // Forward all messages to client
        socket.send(event.data);
      } catch (error) {
        console.error('Error processing OpenAI message:', error);
      }
    };

    openAISocket.onerror = (error) => {
      console.error('OpenAI socket error:', error);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Connection to AI service failed'
      }));
    };

    openAISocket.onclose = () => {

      socket.close();
    };
  };

  socket.onmessage = (event) => {
    try {
      if (typeof event.data !== 'string' || event.data.length > MAX_CLIENT_MESSAGE_BYTES) return;
      const message = JSON.parse(event.data);
      if (!message || !ALLOWED_CLIENT_TYPES.has(message.type)) return;

      
      if (message.type === 'conversation.item.create') {

      }
      
      openAISocket?.send(event.data);
    } catch (error) {
      console.error('Error processing client message:', error);
    }
  };

  socket.onclose = () => {
    clearTimeout(sessionTimer);
    openAISocket?.close();
  };

  socket.onerror = (error) => {
    console.error('Client socket error:', error);
    openAISocket?.close();
  };

  return response;
});

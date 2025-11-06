import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify JWT authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (authError || !user) {
    console.error('Authentication failed:', authError);
    return new Response("Unauthorized", { status: 401 });
  }

  console.log('Authenticated user:', user.id);

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set');
    return new Response("Server configuration error", { status: 500 });
  }

  let openAISocket: WebSocket | null = null;
  let sessionCreated = false;

  socket.onopen = () => {
    console.log('Client connected to chat relay');
    
    // Connect to OpenAI Realtime API
    openAISocket = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17", {
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    });

    openAISocket.onopen = () => {
      console.log('Connected to OpenAI Realtime API');
    };

    openAISocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('OpenAI message:', data.type);

        if (data.type === 'session.created' && !sessionCreated) {
          sessionCreated = true;
          // Send session configuration after session.created
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
              max_response_output_tokens: "inf"
            }
          };
          
          openAISocket?.send(JSON.stringify(sessionUpdate));
          console.log('Session update sent');
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
      console.log('OpenAI socket closed');
      socket.close();
    };
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('Client message:', message.type);
      
      // Handle function calls
      if (message.type === 'conversation.item.create') {
        console.log('Forwarding message to OpenAI');
      }
      
      // Forward message to OpenAI
      openAISocket?.send(event.data);
    } catch (error) {
      console.error('Error processing client message:', error);
    }
  };

  socket.onclose = () => {
    console.log('Client disconnected');
    openAISocket?.close();
  };

  socket.onerror = (error) => {
    console.error('Client socket error:', error);
    openAISocket?.close();
  };

  return response;
});
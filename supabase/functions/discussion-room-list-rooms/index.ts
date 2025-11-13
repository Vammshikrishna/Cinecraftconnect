import { serve } from "jsr:@std/http";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle pre-flight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");

    if (!auth) {
      return new Response(
        JSON.stringify({ error: "Authorization header is missing" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: auth,
          },
        },
      },
    );

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const per_page = parseInt(url.searchParams.get("per_page") || "20", 10);
    const rangeStart = (page - 1) * per_page;
    const rangeEnd = page * per_page - 1;

    const { data: rooms, error, count } = await supabase
      .from("discussion_rooms")
      .select("*, profiles(*)", { count: 'exact' })
      .order("created_at", { ascending: false })
      .range(rangeStart, rangeEnd);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    return new Response(
      JSON.stringify({
        data: rooms,
        meta: {
          page,
          per_page,
          total_pages: Math.ceil((count || 0) / per_page),
          total_entries: count || 0,
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
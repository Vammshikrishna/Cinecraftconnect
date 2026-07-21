import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  user_id: string;
  trigger_user_id?: string;
  type: 'new_message' | 'new_follower' | 'project_invite' | 'system_announcement' | 'generic';
  title: string;
  message: string;
  action_url?: string;
  priority?: 'high' | 'medium' | 'low';
}

// Helper to generate Google OAuth2 Access Token for Firebase FCM v1 API in native Deno
async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKey
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedClaim = btoa(JSON.stringify(claim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signData = encoder.encode(`${encodedHeader}.${encodedClaim}`);
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signData
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${encodedHeader}.${encodedClaim}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`OAuth token exchange failed: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const rawPayload: any = await req.json();
    let payload: NotificationPayload;
    let isDatabaseWebhook = false;

    // Detect if this is triggered via a Supabase Database Webhook
    if (rawPayload.record && rawPayload.table) {
      isDatabaseWebhook = true;
      const record = rawPayload.record;
      const table = rawPayload.table;

      if (table === 'notifications') {
        payload = {
          user_id: record.user_id,
          trigger_user_id: record.trigger_user_id,
          type: record.type,
          title: record.title,
          message: record.message,
          action_url: record.action_url,
          priority: record.priority
        };
      } else {
        return new Response(JSON.stringify({ skipped: `Unsupported table webhook event: ${table}` }), {
          status: 200,
          headers: corsHeaders
        });
      }
    } else {
      payload = rawPayload;
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const actionUrl = payload.action_url || constructActionUrl(payload) || '/';

    const notificationToInsert = {
      user_id: payload.user_id,
      trigger_user_id: payload.trigger_user_id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      action_url: actionUrl,
      priority: payload.priority || 'medium',
    };

    // 1. Only insert notification row if this request is NOT coming from the database trigger itself
    // (This avoids infinite feedback loops!)
    if (!isDatabaseWebhook) {
      const { error: insertError } = await supabase.from('notifications').insert(notificationToInsert);

      if (insertError) {
        console.error('Error inserting notification:', insertError);
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 2. Fetch the recipient's FCM Device push_token
    const { data: recipientProfile, error: profileError } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', payload.user_id)
      .single();

    const pushToken = recipientProfile?.push_token;

    // 3. If recipient has a registered push token, send Firebase Push Notification
    if (pushToken && !profileError) {
      const firebaseProjectId = Deno.env.get('FIREBASE_PROJECT_ID');
      const firebaseClientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
      const firebasePrivateKey = Deno.env.get('FIREBASE_PRIVATE_KEY');

      if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
        try {
          const accessToken = await getAccessToken(
            firebaseClientEmail,
            firebasePrivateKey.replace(/\\n/g, '\n')
          );

          // Generate a unique collapse/grouping tag for Android and iOS based on action URL
          let notificationTag: string | undefined = undefined;
          if (actionUrl) {
            if (actionUrl.startsWith('/messages/')) {
              // Direct message from a specific user
              const senderId = actionUrl.replace('/messages/', '');
              notificationTag = `dm_${senderId}`;
            } else if (actionUrl.startsWith('/discussion-rooms/')) {
              // Message in a specific discussion room
              const roomId = actionUrl.replace('/discussion-rooms/', '');
              notificationTag = `room_${roomId}`;
            } else if (actionUrl.startsWith('/projects/') && actionUrl.includes('/space')) {
              // Message in a specific project space
              const projectId = actionUrl.replace('/projects/', '').split('/')[0];
              notificationTag = `project_${projectId}`;
            }
          }

          // Determine Android Channel ID based on type
          let channelId = 'default';
          const notificationType = payload.type || 'generic';
          if (notificationType === 'new_message' || notificationType === 'message' || notificationType === 'chat') {
            channelId = 'msg-high-priority-v2';
          } else if (notificationType === 'new_follower' || notificationType === 'mention' || notificationType === 'like' || notificationType === 'comment') {
            channelId = 'social-high-priority-v2';
          } else if (notificationType === 'project_invite' || notificationType === 'room_invite') {
            channelId = 'call-high-priority-v2';
          } else if (notificationType === 'system_announcement' || notificationType === 'critical_alert') {
            channelId = 'alarm-high-priority-v2';
          } else {
            channelId = 'msg-high-priority-v2';
          }

          const displayMessage = getDisplayMessage(payload.message);

          const fcmPayload: any = {
            message: {
              token: pushToken,
              notification: {
                title: payload.title,
                body: displayMessage,
              },
              data: {
                actionUrl: actionUrl,
              },
              android: {
                priority: "high",
                notification: {
                  sound: "default",
                  icon: "ic_stat_icon_default",
                  color: "#FF4B33",
                  notification_priority: "PRIORITY_MAX",
                  channel_id: channelId
                }
              },
              apns: {
                headers: {
                  'apns-priority': '10',
                  'apns-push-type': 'alert'
                },
                payload: {
                  aps: {
                    alert: {
                      title: payload.title,
                      body: displayMessage,
                    },
                    sound: 'default',
                    badge: 1,
                    'interruption-level': 'active'
                  },
                  actionUrl: actionUrl
                }
              }
            }
          };

          // If grouping tag is identified, collapse subsequent notifications on Android/iOS/FCM
          if (notificationTag) {
            fcmPayload.message.android.collapse_key = notificationTag;
            fcmPayload.message.android.notification.tag = notificationTag;
            fcmPayload.message.apns.headers['apns-collapse-id'] = notificationTag;
          }

          const fcmResponse = await fetch(
            `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(fcmPayload),
            }
          );

          const fcmResult = await fcmResponse.json();
          console.log('Firebase Push Notification result:', fcmResult);
        } catch (fcmError) {
          console.error('Error sending Firebase Push Notification:', fcmError);
        }
      } else {
        console.warn('Firebase secrets not fully configured in Supabase environment vault. Skipping push notification.');
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Notification processed.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error in send-notification:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function constructActionUrl(payload: NotificationPayload): string | undefined {
  if (payload.action_url) {
    return payload.action_url;
  }
  switch (payload.type) {
    case 'new_message':
      return `/messages/${payload.trigger_user_id}`;
    case 'new_follower':
      return `/profile/${payload.trigger_user_id}`;
    case 'project_invite':
      return '/projects';
    case 'system_announcement':
      return '/announcements';
    default:
      return '/';
  }
}


function getDisplayMessage(content: string): string {
  if (!content) return '';
  
  if (content.includes('_SHARE::')) {
    const type = content.split('_SHARE::')[0].toLowerCase();
    
    const labels: Record<string, string> = {
      'post': 'Shared a post',
      'marketplace': 'Shared a marketplace listing',
      'announcement': 'Shared an announcement',
      'vendor': 'Shared a vendor profile',
      'project': 'Shared a project',
      'discussion': 'Shared a discussion room',
      'job': 'Shared a job',
      'craft': 'Shared a craft',
      'profile': 'Shared a profile'
    };

    return labels[type] || `Shared a ${type}`;
  }

  const lowerContent = content.toLowerCase();
  
  if (lowerContent.startsWith('![') && lowerContent.includes('](')) {
    return '📷 Photo';
  }

  if (lowerContent.match(/\.(jpg|jpeg|png|gif|webp|svg|heic)(\?.*)?$/)) {
    return '📷 Photo';
  }
  
  if (lowerContent.match(/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/)) {
    return '🎥 Video';
  }

  return content;
}

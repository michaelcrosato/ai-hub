// turn — ICE servers for a session's peer-to-peer mesh.
//
// Signed-in players (guests included; Supabase checks the JWT before this
// runs) get short-lived Cloudflare TURN credentials, so two browsers that
// cannot reach each other directly still connect through a relay. Without the
// two secrets below it answers with STUN only: direct connections still work.
//
// Secrets: CF_TURN_KEY_ID, CF_TURN_API_TOKEN (Cloudflare Realtime → TURN keys).

const STUN = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
const ALLOWED = [/^https:\/\/crosato-arcade\.vercel\.app$/, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/];
const TTL_SECONDS = 4 * 60 * 60;

function cors(origin: string | null) {
  const allow = origin && ALLOWED.some((re) => re.test(origin)) ? origin : 'https://crosato-arcade.vercel.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

Deno.serve(async (req: Request) => {
  const headers = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { headers });

  const keyId = Deno.env.get('CF_TURN_KEY_ID');
  const token = Deno.env.get('CF_TURN_API_TOKEN');
  if (!keyId || !token) {
    return new Response(JSON.stringify({ iceServers: STUN, relay: false }), { headers });
  }
  try {
    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: TTL_SECONDS }),
    });
    if (!res.ok) throw new Error(`Cloudflare answered ${res.status}`);
    const { iceServers } = await res.json();
    return new Response(JSON.stringify({ iceServers: [...STUN, ...[].concat(iceServers)], relay: true }), { headers });
  } catch (error) {
    console.error('turn:', error);
    return new Response(JSON.stringify({ iceServers: STUN, relay: false }), { headers });
  }
});

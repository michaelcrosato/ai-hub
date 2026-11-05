// turn — ICE servers for a session's peer-to-peer mesh.
//
// Players seated in an open session (guests included) get short-lived
// Cloudflare TURN credentials, so two browsers that cannot reach each other
// directly still connect through a relay. Relayed traffic past the free
// allowance is billed, so anyone else gets STUN only, as does every caller
// without the two secrets below: direct connections still work. Whether the
// caller is seated is the database's answer to the caller's own token
// (has_live_seat, migration 0012); the page asks only once its player holds a
// seat (assets/js/session/app.js, joinOnline).
//
// Secrets: CF_TURN_KEY_ID, CF_TURN_API_TOKEN (Cloudflare Realtime → TURN keys).

const STUN = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
const SITE = 'https://crosato-arcade.michael-crosato.workers.dev';
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
const TTL_SECONDS = 4 * 60 * 60;

function cors(origin: string | null) {
  const allow = origin && (origin === SITE || LOCAL.test(origin)) ? origin : SITE;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

/** Whether the caller holds a seat in an open session, asked with the caller's own token. Any failure is a no. */
async function hasLiveSeat(req: Request): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL');
  const authorization = req.headers.get('authorization');
  const apikey = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !authorization || !apikey) return false;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/has_live_seat`, {
      method: 'POST',
      headers: { apikey, Authorization: authorization, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) {
      console.warn('turn: the seat check answered', res.status);
      return false;
    }
    return (await res.json()) === true;
  } catch (error) {
    console.error('turn: the seat check failed', error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const headers = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  const stunOnly = () => new Response(JSON.stringify({ iceServers: STUN, relay: false }), { headers });

  const keyId = Deno.env.get('CF_TURN_KEY_ID');
  const token = Deno.env.get('CF_TURN_API_TOKEN');
  if (!keyId || !token || !(await hasLiveSeat(req))) return stunOnly();
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
    return stunOnly();
  }
});

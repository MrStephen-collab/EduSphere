import { http1Fetch } from "./http1";

// The HTTP/1.1 transport in ./http1 exists because this machine's network kills
// pooled HTTP/2 sessions (OpenSSL alert 47 / ERR_HTTP2_INVALID_SESSION), so it
// opens a fresh TLS connection for every query. That handshake costs ~500ms a
// call, which is why page loads here sat at 1.4-2.7s.
//
// That constraint belongs to this network, not to Vercel, where the platform
// fetch pools connections normally and pays no per-query handshake. So the
// transport is chosen per environment: dev keeps the workaround, production
// uses the platform fetch.
//
// SUPABASE_TRANSPORT=http1 forces the old transport anywhere, and
// SUPABASE_TRANSPORT=platform forces the platform fetch, in case this machine's
// network is ever used to host something.
const forced = process.env.SUPABASE_TRANSPORT;

export const supabaseFetch: (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response> =
  forced === "http1"
    ? http1Fetch
    : forced === "platform"
      ? fetch
      : process.env.NODE_ENV === "production"
        ? fetch
        : http1Fetch;
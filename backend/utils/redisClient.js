// backend/utils/redisClient.js
// optional Redis with full backward compatibility.
// - If Redis is unavailable or disabled (REDIS_DISABLE=1), we expose a no-op client
//   that still has .get/.set/.del to avoid crashes.
// - Also expose helper functions + flags on the same export.

const Redis = require('ioredis');

const isDisabled =
  process.env.REDIS_DISABLE === '1' ||
  (!process.env.REDIS_URL &&
    !process.env.REDIS_HOST &&
    // In dev with no explicit Redis config: default to disabled
    process.env.NODE_ENV !== 'production');

let client = null;
let enabled = false;

if (!isDisabled) {
  try {
    const common = {
      lazyConnect: true,
      maxRetriesPerRequest: 1, // fail fast
      enableOfflineQueue: false,
      retryStrategy(times) {
        // small backoff; stop quickly
        return times > 3 ? null : Math.min(200 * times, 1000);
      },
    };

    client = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, common)
      : new Redis({
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: Number(process.env.REDIS_PORT || 6379),
          password: process.env.REDIS_PASSWORD || undefined,
          ...common,
        });

    client.on('error', e => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[redis] disabled (connect error):', e?.message || e);
      }
    });

    client.connect().then(
      () => {
        enabled = true;
        if (process.env.NODE_ENV !== 'test') console.log('[redis] connected');
      },
      () => {
        enabled = false;
        if (process.env.NODE_ENV !== 'test')
          console.warn('[redis] not connected; using no-op cache');
      }
    );
  } catch (e) {
    enabled = false;
    client = null;
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[redis] init failed; using no-op cache:', e?.message || e);
    }
  }
} else {
  if (process.env.NODE_ENV !== 'test') console.log('[redis] disabled by config; using no-op cache');
}

// ---- Helper API (no-ops when disabled) ----
const TTL_SECONDS = 60 * 60 * 48; // 48h

async function cacheSetSession(sessionId, snapshot) {
  if (!enabled || !client) return;
  try {
    await client.set(`gs:${sessionId}`, JSON.stringify(snapshot), 'EX', TTL_SECONDS);
  } catch {
    // ignore cache errors
  }
}

async function cacheGetSession(sessionId) {
  if (!enabled || !client) return null;
  try {
    const raw = await client.get(`gs:${sessionId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function cacheDelSession(sessionId) {
  if (!enabled || !client) return;
  try {
    await client.del(`gs:${sessionId}`);
  } catch {
    // ignore
  }
}

// ---- Backward-compat default export ----
// Some code may do: const redis = require('./redisClient'); redis.get(...)
// Provide a no-op client with get/set/del when Redis is off.
const noopClient = {
  async get() {
    return null;
  },
  async set() {
    return 'OK';
  },
  async del() {
    return 0;
  },
};

module.exports = {
  client: client || noopClient, // always an object, never a function/class instance
  enabled,
  TTL_SECONDS,
  cacheSetSession,
  cacheGetSession,
  cacheDelSession,
};

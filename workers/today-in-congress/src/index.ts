type ChamberSnapshot = {
  name: 'House' | 'Senate';
  status: string;
  number: number;
  startDate: string;
  startDayOfWeek: string;
  statusSince?: string;
  nextScheduledSession?: string;
  totalSessionDays?: number;
  totalCalendarDays?: number;
  calendarDays: number;
};

type SourcePayload = {
  house: {
    number: number;
    status: string;
    currentLegislativeDay: {
      number: number;
      startDate: string;
      startDayOfWeek: string;
    };
    statusSince?: string;
    nextScheduledSession?: string;
    totalSessionDays?: number;
    totalCalendarDays?: number;
  };
  senate: {
    number: number;
    status: string;
    currentLegislativeDay: {
      number: number;
      startDate: string;
      startDayOfWeek: string;
    };
    statusSince?: string;
    nextScheduledSession?: string;
    totalSessionDays?: number;
    totalCalendarDays?: number;
  };
  lastUpdated?: string;
  dataSource?: string;
  [key: string]: unknown;
};

type TodaySnapshot = {
  headline: string;
  summary: string;
  chambers: {
    house: ChamberSnapshot;
    senate: ChamberSnapshot;
  };
  satiricalPoints: string[];
  source: {
    sourceUrl: string;
    sourceUpdatedAt: string;
    dataSource: string;
    generatedAt: string;
    generatedBy: 'ai' | 'fallback';
  };
};

type CachedPayload = {
  payload: TodaySnapshot;
};

const API_PATHS = [
  '/api/today',
  '/api/today-in-congress',
  '/votechain/api/today',
  '/votechain/api/today-in-congress',
];

type Env = {
  AI?: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
  TODAY_CACHE: KVNamespace;
  SOURCE_URL?: string;
  CACHE_KEY?: string;
  AI_MODEL?: string;
  ALLOWED_ORIGINS?: string;
};

const DEFAULT_SOURCE_URL =
  'https://raw.githubusercontent.com/AbsurdityIndex/votechain/main/src/data/session-status.json';
const CACHE_KEY_FALLBACK = 'today-in-congress:v1';
const MAX_CACHE_TTL_SECONDS = 26 * 60 * 60; // 26h
const STALE_AFTER_SECONDS = 25 * 60 * 60;
const REFRESH_LOCK_SECONDS = 10 * 60; // 10m
const CACHE_CONTROL = 'public, max-age=900, stale-while-revalidate=3600';

function getCacheKey(env: Env): string {
  return env.CACHE_KEY || CACHE_KEY_FALLBACK;
}

function isApiPath(pathname: string): boolean {
  return API_PATHS.includes(pathname);
}

function parseDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function daysBetween(startDate: string, endDate = new Date()): number {
  const start = parseDate(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function normalizeChamber(chamberName: 'House' | 'Senate', raw: SourcePayload['house']): ChamberSnapshot {
  return {
    name: chamberName,
    status: raw.status,
    number: raw.currentLegislativeDay.number,
    startDate: raw.currentLegislativeDay.startDate,
    startDayOfWeek: raw.currentLegislativeDay.startDayOfWeek,
    statusSince: raw.statusSince,
    nextScheduledSession: raw.nextScheduledSession,
    totalSessionDays: raw.totalSessionDays,
    totalCalendarDays: raw.totalCalendarDays,
    calendarDays: daysBetween(raw.currentLegislativeDay.startDate),
  };
}

function asText(value: string, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function sanitizeSatiricalPoints(points: string[], fallback: string[]): string[] {
  const clean = points
    .map((point) => point.trim())
    .filter((point) => point.length > 0)
    .map((point) => point.replace(/\s+/g, ' '));

  if (clean.length >= 4) return clean.slice(0, 5);

  const combined = [...clean, ...fallback];
  const deduped = [...new Set(combined)].filter((point) => point.length > 0);
  return deduped.slice(0, 5);
}

function buildFallbackPayload(source: SourcePayload): TodaySnapshot {
  const sourceUpdatedAt = asText(source.lastUpdated || new Date().toISOString(), new Date().toISOString());
  const chambers = {
    house: normalizeChamber('House', source.house),
    senate: normalizeChamber('Senate', source.senate),
  };

  const longerHouse = chambers.house.calendarDays >= chambers.senate.calendarDays ? chambers.house : chambers.senate;

  const fallbackPoints = [
    `${chambers.house.name} keeps ${chambers.house.status} on a ${chambers.house.startDayOfWeek}-to-${chambers.house.startDayOfWeek} rhythm.`,
    `${chambers.senate.name} says it's still ${chambers.senate.startDayOfWeek}, which in legislative terms means "time is a social construct."`,
    `Between the two chambers, ${longerHouse.name} is currently running the longest legislative day at ${longerHouse.calendarDays} days.`,
    `Both chambers' calendars are tracking different realities, while the public calendar keeps moving on.`,
    `If this were a movie, the plot would be “Same day, three acts.”`,
  ];

  return {
    headline: 'Today in Congress (Manual fallback snapshot)',
    summary: `House is currently ${chambers.house.status} on ${chambers.house.startDayOfWeek} (${chambers.house.startDate}) while Senate is ${chambers.senate.status}.`,
    chambers,
    satiricalPoints: sanitizeSatiricalPoints([], fallbackPoints),
    source: {
      sourceUrl: DEFAULT_SOURCE_URL,
      sourceUpdatedAt,
      dataSource: asText(source.dataSource, 'Manual tracking source'),
      generatedAt: new Date().toISOString(),
      generatedBy: 'fallback',
    },
  };
}

function clampPoints(points: string[]): string[] {
  return points.slice(0, 5);
}

function extractJson(raw: string): string | null {
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    // no-op
  }

  const fenced = raw.match(/```json\n([\s\S]*?)\n```/i);
  if (fenced?.[1]) {
    try {
      JSON.parse(fenced[1]);
      return fenced[1];
    } catch {
      // no-op
    }
  }

  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    const candidate = raw.slice(first, last + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      return null;
    }
  }

  return null;
}

async function fetchSource(sourceUrl: string): Promise<SourcePayload | null> {
  try {
    const response = await fetch(sourceUrl, { method: 'GET' });
    if (!response.ok) return null;

    const payload = (await response.json()) as SourcePayload;

    if (!payload?.house || !payload?.senate) return null;
    if (!payload.house.currentLegislativeDay || !payload.senate.currentLegislativeDay) return null;

    return payload;
  } catch (_error) {
    return null;
  }
}

async function generateSatiricalPoints(env: Env, source: SourcePayload): Promise<{ headline: string; summary: string; points: string[] } | null> {
  if (!env.AI?.run) return null;

  const model = env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct';
  const prompt = `You are a satirical civic-news copywriter. Given this JSON data about House and Senate session status, generate exactly 3-5 witty, concise satirical points and one headline and one 1-2 sentence summary.
Return JSON only in this format:
{
  "headline": "...",
  "summary": "...",
  "satiricalPoints": ["..."]
}

Data:
${JSON.stringify(source)}`;

  try {
    const aiResult = await env.AI.run(model, {
      prompt,
      max_tokens: 500,
      temperature: 0.8,
    });

    const raw =
      typeof (aiResult as { response?: unknown }).response === 'string'
        ? ((aiResult as { response?: string }).response || '')
        : JSON.stringify(aiResult);

    const jsonText = extractJson(raw);
    if (!jsonText) return null;

    const parsed = JSON.parse(jsonText) as {
      headline?: unknown;
      summary?: unknown;
      satiricalPoints?: unknown;
    };

    const headline = asText(typeof parsed.headline === 'string' ? parsed.headline : '', 'AI summary ready');
    const summary = asText(typeof parsed.summary === 'string' ? parsed.summary : '', 'A satirical look at congressional calendar drift.');
    const satiricalPoints =
      Array.isArray(parsed.satiricalPoints) && parsed.satiricalPoints.every((value) => typeof value === 'string')
        ? parsed.satiricalPoints.map((value) => String(value))
        : [];

    if (headline && summary && satiricalPoints.length > 0) {
      return {
        headline,
        summary,
        points: sanitizeSatiricalPoints(satiricalPoints, []),
      };
    }
  } catch (_err) {
    // no-op
  }

  return null;
}

async function buildPayload(env: Env): Promise<TodaySnapshot> {
  const sourceUrl = asText(env.SOURCE_URL || DEFAULT_SOURCE_URL, DEFAULT_SOURCE_URL);
  const source = (await fetchSource(sourceUrl)) || (await fetchSource(DEFAULT_SOURCE_URL));

  if (!source) {
    // If we cannot reach source, degrade gracefully to the last known static dataset.
    const fallbackSource = {
      house: {
        number: 8,
        status: 'recess',
        currentLegislativeDay: {
          number: 8,
          startDate: new Date().toISOString().slice(0, 10),
          startDayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        },
      },
      senate: {
        number: 6,
        status: 'recess',
        currentLegislativeDay: {
          number: 6,
          startDate: new Date().toISOString().slice(0, 10),
          startDayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        },
      },
      lastUpdated: new Date().toISOString(),
      dataSource: 'Fallback emergency snapshot (source unavailable)',
    } satisfies SourcePayload;

    return buildFallbackPayload(fallbackSource);
  }

  const chambers = {
    house: normalizeChamber('House', source.house),
    senate: normalizeChamber('Senate', source.senate),
  };

  const sourceBasedFallback = buildFallbackPayload(source);
  const ai = await generateSatiricalPoints(env, source);

  const headline = ai?.headline ?? sourceBasedFallback.headline;
  const summary = ai?.summary ?? sourceBasedFallback.summary;
  const points = ai ? clampPoints(ai.points) : sourceBasedFallback.satiricalPoints;

  return {
    headline,
    summary,
    chambers,
    satiricalPoints: points,
    source: {
      sourceUrl,
      sourceUpdatedAt: asText(source.lastUpdated, new Date().toISOString()),
      dataSource: asText(source.dataSource, 'Manual tracking source'),
      generatedAt: new Date().toISOString(),
      generatedBy: ai ? 'ai' : 'fallback',
    },
  };
}

function isFresh(payload: TodaySnapshot): boolean {
  const generated = parseDate(payload.source.generatedAt);
  const now = Date.now();
  return now - generated.getTime() < STALE_AFTER_SECONDS * 1000;
}

function jsonHeaders(request: Request, env: Env): Headers {
  const requestOrigin = request.headers.get('Origin');
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': CACHE_CONTROL,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  });

  if (requestOrigin && isOriginAllowed(requestOrigin, env.ALLOWED_ORIGINS)) {
    headers.set('Access-Control-Allow-Origin', requestOrigin);
    headers.set('Access-Control-Allow-Credentials', 'false');
  }

  return headers;
}

function isOriginAllowed(origin: string, allowedOrigins = ''): boolean {
  if (!allowedOrigins) return false;
  const allowed = allowedOrigins
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes('*') || allowed.includes(origin);
}

async function getCachedPayload(cache: KVNamespace, cacheKey: string): Promise<TodaySnapshot | null> {
  const raw = await cache.get<CachedPayload>(cacheKey, { type: 'json' });
  return raw?.payload ?? null;
}

async function acquireRefreshLock(cache: KVNamespace, cacheKey: string): Promise<boolean> {
  const lockKey = `${cacheKey}:refresh`;
  const existing = await cache.get(lockKey);
  if (existing) return false;

  await cache.put(lockKey, '1', { expirationTtl: REFRESH_LOCK_SECONDS });
  return true;
}

async function refreshCache(env: Env): Promise<TodaySnapshot> {
  const payload = await buildPayload(env);
  await env.TODAY_CACHE.put(getCacheKey(env), JSON.stringify({ payload }), {
    expirationTtl: MAX_CACHE_TTL_SECONDS,
  });
  return payload;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const requestPath = url.pathname.endsWith('/') && url.pathname.length > 1 ? url.pathname.slice(0, -1) : url.pathname;

    if (!isApiPath(requestPath)) {
      return new Response('Not found', { status: 404, headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }) });
    }

    if (request.method === 'OPTIONS') {
      const optionsHeaders = jsonHeaders(request, env);
      return new Response(null, {
        status: 204,
        headers: optionsHeaders,
      });
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 405,
        headers: jsonHeaders(request, env),
      });
    }

    const cacheKey = getCacheKey(env);
    let cached = await getCachedPayload(env.TODAY_CACHE, cacheKey);

    if (!cached) {
      cached = await refreshCache(env);
    } else if (!isFresh(cached)) {
      // Serve stale data and schedule a limited frequency refresh.
      const lockAcquired = await acquireRefreshLock(env.TODAY_CACHE, cacheKey);
      if (lockAcquired) {
        ctx.waitUntil(
          refreshCache(env).finally(() => env.TODAY_CACHE.delete(`${cacheKey}:refresh`).catch(() => {})),
        );
      }
    }

    const payload = cached ? cached : await buildPayload(env);
    return new Response(
      JSON.stringify({
        ok: true,
        cacheKey,
        payload,
        isFresh: isFresh(payload),
      }),
      { status: 200, headers: jsonHeaders(request, env) },
    );
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await refreshCache(env);
  },
} satisfies ExportedHandler<Env>;

/**
 * BharatClap Event Bus — Redis Streams
 *
 * Lightweight event bus for async inter-service communication.
 * Covers: consumer groups, acks, pending recovery, retries,
 * idempotent consumers, dead-letter, schema versioning,
 * observability, graceful shutdown.
 *
 * Usage:
 *   Publisher:  eventBus.init(redis); eventBus.emit('BookingCreated', { bookingId });
 *   Consumer:   eventBus.init(redis); eventBus.subscribe('BookingCreated', handler, { group, consumer });
 */

// ponytail: this is the entire event bus — no framework, just ioredis XADD/XREADGROUP

export interface EventEnvelope {
  id: string;          // Redis stream message ID
  type: string;        // Event type (e.g. 'BookingCreated')
  version: number;     // Schema version
  payload: string;     // JSON-stringified payload
  timestamp: string;   // ISO timestamp
  source: string;      // Originating service
  traceId: string;     // Correlation/trace ID
}

export interface SubscribeOptions {
  group: string;       // Consumer group name
  consumer: string;    // Consumer name (unique per instance)
  maxRetries?: number; // Max retries before dead-letter (default 5)
  blockMs?: number;    // XREADGROUP block timeout (default 2000)
  batchSize?: number;  // Messages per read (default 10)
}

type EventHandler = (payload: any, envelope: EventEnvelope) => Promise<void>;

const STREAM_PREFIX = 'bharatclap:events:';
const DLQ_STREAM = 'bharatclap:events:__dead_letter';

let redis: any = null;
let shutdownRequested = false;
const activePollers: AbortController[] = [];

// Metrics (observable via getMetrics())
const metrics = {
  published: 0,
  consumed: 0,
  acked: 0,
  retried: 0,
  deadLettered: 0,
  errors: 0,
};

function streamKey(eventType: string): string {
  return `${STREAM_PREFIX}${eventType}`;
}

/**
 * Initialize the event bus with an existing ioredis instance.
 * Must be called before emit() or subscribe().
 */
function init(redisClient: any): void {
  redis = redisClient;
}

/**
 * Publish an event to a Redis Stream.
 */
async function emit(
  eventType: string,
  payload: Record<string, any>,
  options?: { source?: string; traceId?: string; version?: number }
): Promise<string | null> {
  if (!redis) {
    console.error('[EVENT-BUS] Not initialized — call eventBus.init(redis) first');
    return null;
  }

  try {
    const envelope = {
      type: eventType,
      version: String(options?.version ?? 1),
      payload: JSON.stringify(payload),
      timestamp: new Date().toISOString(),
      source: options?.source || process.env.SERVICE_NAME || 'unknown',
      traceId: options?.traceId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };

    const id = await redis.xadd(
      streamKey(eventType),
      'MAXLEN', '~', '10000', // ponytail: cap at ~10k messages to bound memory; upgrade to exact + archival if needed
      '*',
      'type', envelope.type,
      'version', envelope.version,
      'payload', envelope.payload,
      'timestamp', envelope.timestamp,
      'source', envelope.source,
      'traceId', envelope.traceId
    );

    metrics.published++;
    return id;
  } catch (err: any) {
    metrics.errors++;
    console.error(`[EVENT-BUS] emit(${eventType}) failed:`, err.message);
    return null;
  }
}

/**
 * Subscribe to an event stream with consumer group semantics.
 * Handles: group creation, message reading, ack, retry, dead-letter.
 */
async function subscribe(
  eventType: string,
  handler: EventHandler,
  options: SubscribeOptions
): Promise<void> {
  if (!redis) {
    console.error('[EVENT-BUS] Not initialized');
    return;
  }

  const stream = streamKey(eventType);
  const { group, consumer, maxRetries = 5, blockMs = 2000, batchSize = 10 } = options;

  // Ensure consumer group exists (MKSTREAM creates the stream if needed)
  try {
    await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM');
  } catch (err: any) {
    if (!err.message?.includes('BUSYGROUP')) throw err;
    // Group already exists — fine
  }

  const controller = new AbortController();
  activePollers.push(controller);

  // 1. First pass: recover any pending (unacked) messages from previous crashes
  await recoverPending(stream, group, consumer, handler, maxRetries);

  // 2. Main poll loop: read new messages
  const poll = async () => {
    while (!shutdownRequested && !controller.signal.aborted) {
      try {
        const results = await redis.xreadgroup(
          'GROUP', group, consumer,
          'COUNT', batchSize,
          'BLOCK', blockMs,
          'STREAMS', stream, '>'
        );

        if (!results) continue;

        for (const [, messages] of results) {
          for (const [id, fields] of messages) {
            const envelope = parseEnvelope(id, fields);
            metrics.consumed++;

            try {
              await handler(JSON.parse(envelope.payload), envelope);
              await redis.xack(stream, group, id);
              metrics.acked++;
            } catch (err: any) {
              metrics.errors++;
              console.error(`[EVENT-BUS] Handler error for ${eventType}:${id}:`, err.message);
              // Message stays pending — will be recovered on next restart or pending scan
            }
          }
        }
      } catch (err: any) {
        if (shutdownRequested || controller.signal.aborted) break;
        metrics.errors++;
        console.error(`[EVENT-BUS] Poll error for ${eventType}:`, err.message);
        await sleep(1000); // back off on error
      }
    }
  };

  // Run poll in background (non-blocking)
  poll().catch(err => console.error(`[EVENT-BUS] Poll fatal for ${eventType}:`, err.message));
}

/**
 * Recover pending messages that were consumed but not acked (e.g. crash recovery).
 * Messages exceeding maxRetries go to dead-letter stream.
 */
async function recoverPending(
  stream: string,
  group: string,
  consumer: string,
  handler: EventHandler,
  maxRetries: number
): Promise<void> {
  try {
    // XPENDING with detail: get pending messages for this consumer
    const pending = await redis.xpending(stream, group, '-', '+', 100);
    if (!Array.isArray(pending) || pending.length === 0) return;

    for (const entry of pending) {
      const [id, , , deliveryCount] = entry;

      if (deliveryCount >= maxRetries) {
        // Dead-letter: move to DLQ stream
        const messages = await redis.xrange(stream, id, id);
        if (messages?.length) {
          const [, fields] = messages[0];
          await redis.xadd(
            DLQ_STREAM, '*',
            'original_stream', stream,
            'original_id', id,
            'original_group', group,
            'delivery_count', String(deliveryCount),
            ...fields
          );
          metrics.deadLettered++;
        }
        await redis.xack(stream, group, id);
        console.warn(`[EVENT-BUS] Dead-lettered ${stream}:${id} after ${deliveryCount} deliveries`);
        continue;
      }

      // Claim and retry
      try {
        const claimed = await redis.xclaim(stream, group, consumer, 0, id);
        if (claimed?.length) {
          const [claimedId, fields] = claimed[0];
          const envelope = parseEnvelope(claimedId, fields);
          metrics.retried++;
          await handler(JSON.parse(envelope.payload), envelope);
          await redis.xack(stream, group, claimedId);
          metrics.acked++;
        }
      } catch (err: any) {
        console.error(`[EVENT-BUS] Recovery retry failed for ${stream}:${id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error(`[EVENT-BUS] recoverPending failed for ${stream}:`, err.message);
  }
}

function parseEnvelope(id: string, fields: string[]): EventEnvelope {
  const map: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    map[fields[i]] = fields[i + 1];
  }
  return {
    id,
    type: map.type || '',
    version: parseInt(map.version || '1', 10),
    payload: map.payload || '{}',
    timestamp: map.timestamp || '',
    source: map.source || '',
    traceId: map.traceId || '',
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Graceful shutdown: stop all poll loops and wait for in-flight processing.
 */
async function shutdown(): Promise<void> {
  shutdownRequested = true;
  for (const c of activePollers) c.abort();
  // Give in-flight handlers a moment to finish
  await sleep(500);
}

/**
 * Get observable metrics for monitoring/health endpoints.
 */
function getMetrics() {
  return { ...metrics };
}

export const eventBus = {
  init,
  emit,
  subscribe,
  shutdown,
  getMetrics,
};

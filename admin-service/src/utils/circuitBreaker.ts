import axios, { AxiosRequestConfig } from 'axios';
import { Logger } from '../logger/logger';

export interface CircuitBreakerOptions {
  timeoutMs?: number;
  maxRetries?: number;
  fallbackValue?: any;
}

export class CircuitBreaker {
  private static failuresCount = new Map<string, number>();
  private static circuitOpenUntil = new Map<string, number>();

  static async execute<T>(serviceName: string, requestFn: () => Promise<T>, options: CircuitBreakerOptions = {}): Promise<T> {
    const { timeoutMs = 3000, maxRetries = 2, fallbackValue = null } = options;
    const now = Date.now();

    // Check if circuit is currently OPEN
    const openUntil = this.circuitOpenUntil.get(serviceName) || 0;
    if (now < openUntil) {
      Logger.warn(`[CIRCUIT-BREAKER] Circuit OPEN for ${serviceName}, returning fallback`);
      return fallbackValue;
    }

    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const result = await Promise.race([
          requestFn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout of ${timeoutMs}ms exceeded`)), timeoutMs)
          )
        ]);

        // Success: Reset failure counters
        this.failuresCount.set(serviceName, 0);
        return result;
      } catch (err: any) {
        attempt++;
        const currentFailures = (this.failuresCount.get(serviceName) || 0) + 1;
        this.failuresCount.set(serviceName, currentFailures);

        Logger.warn(`[CIRCUIT-BREAKER] Attempt ${attempt} failed for ${serviceName}: ${err?.message}`);

        // Open circuit after 3 consecutive failures for 15 seconds
        if (currentFailures >= 3) {
          this.circuitOpenUntil.set(serviceName, Date.now() + 15000);
          Logger.error(`[CIRCUIT-BREAKER] Tripped circuit OPEN for ${serviceName} for 15 seconds`);
          return fallbackValue;
        }

        if (attempt <= maxRetries) {
          // Exponential backoff: 200ms, 400ms...
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
        }
      }
    }

    return fallbackValue;
  }
}

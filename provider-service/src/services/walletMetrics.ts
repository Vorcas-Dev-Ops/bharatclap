/**
 * OpenTelemetry / Prometheus Wallet Metrics Telemetry Engine
 * Exposes structured Counters and Gauges for financial operations monitoring.
 */

class WalletMetricsRegistry {
  private metrics = {
    wallet_transactions_total: 0,
    wallet_reconciliation_total: 0,
    wallet_drift_total: 0,
    wallet_negative_balance_attempts: 0,
    wallet_adjustments_total: 0,
    wallet_event_failures: 0,
    wallet_idempotency_hits: 0,
    wallet_total_latency_ms: 0,
    wallet_latency_count: 0
  };

  public incTransactionsTotal(type: string) {
    this.metrics.wallet_transactions_total++;
    if (type === 'adjustment' || type === 'ADMIN_RESET') {
      this.metrics.wallet_adjustments_total++;
    }
  }

  public incReconciliationTotal() {
    this.metrics.wallet_reconciliation_total++;
  }

  public incDriftTotal() {
    this.metrics.wallet_drift_total++;
  }

  public incNegativeBalanceAttempts() {
    this.metrics.wallet_negative_balance_attempts++;
  }

  public incEventFailures() {
    this.metrics.wallet_event_failures++;
  }

  public incIdempotencyHits() {
    this.metrics.wallet_idempotency_hits++;
  }

  public recordLatency(durationMs: number) {
    this.metrics.wallet_total_latency_ms += durationMs;
    this.metrics.wallet_latency_count++;
  }

  public getMetricsSummary() {
    const avgLatency = this.metrics.wallet_latency_count > 0 
      ? (this.metrics.wallet_total_latency_ms / this.metrics.wallet_latency_count).toFixed(2)
      : 0;

    return {
      ...this.metrics,
      wallet_average_latency_ms: Number(avgLatency)
    };
  }
}

export const walletMetrics = new WalletMetricsRegistry();

import { Pool, PoolClient } from 'pg';
import { getDb } from '../config/db';
import { withTransaction, computeWalletHash } from '@bharatclap/shared';

export interface WalletEntity {
  id: string;
  provider_id: string;
  balance: number;
  currency: string;
  fencing_token: number;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface WalletTransactionEntity {
  id: string;
  provider_id: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  currency: string;
  reference_type: string;
  reference_id: string;
  description: string;
  status: string;
  previous_hash: string;
  current_hash: string;
  fencing_token: number;
  trace_id?: string;
  correlation_id?: string;
  created_at: Date;
}

export class WalletRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async getWallet(providerId: string, client?: PoolClient): Promise<WalletEntity | null> {
    const q = client || this.pool;
    const res = await q.query(
      `SELECT * FROM provider.wallets
       WHERE (provider_id::text = $1 OR legacy_mongo_id = $1)
       LIMIT 1`,
      [providerId]
    );
    if (res.rows[0]) {
      return {
        id: res.rows[0].id,
        provider_id: res.rows[0].provider_id,
        balance: Number(res.rows[0].balance),
        currency: res.rows[0].currency,
        fencing_token: Number(res.rows[0].fencing_token),
        version: Number(res.rows[0].version),
        created_at: new Date(res.rows[0].created_at),
        updated_at: new Date(res.rows[0].updated_at)
      };
    }
    return null;
  }

  static async getOrCreateWallet(providerId: string, client?: PoolClient): Promise<WalletEntity> {
    const q = client || this.pool;
    const existing = await this.getWallet(providerId, client);
    if (existing) return existing;

    const res = await q.query(
      `INSERT INTO provider.wallets (
         provider_id, balance, fencing_token, version
       ) VALUES (
         (SELECT id FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         0, 0, 1
       )
       ON CONFLICT (provider_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [providerId]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      provider_id: row.provider_id,
      balance: Number(row.balance),
      currency: row.currency,
      fencing_token: Number(row.fencing_token),
      version: Number(row.version),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }

  /**
   * Enterprise wallet mutation with ACID transaction, cryptographic hash chaining,
   * monotonic fencing token increment, and audit logging.
   */
  static async recordTransaction(options: {
    providerId: string;
    amount: number;
    type: 'recharge' | 'refund' | 'credit' | 'initial_credit' | 'release' | 'deduction' | 'debit' | 'hold' | 'penalty' | 'adjustment';
    referenceType: string;
    referenceId: string;
    description: string;
    action?: string;
    actorType?: string;
    actorId?: string;
    correlationId?: string;
    traceId?: string;
    metadata?: any;
  }): Promise<{ transaction: WalletTransactionEntity; newBalance: number; fencingToken: number }> {
    return withTransaction(this.pool, async (client: PoolClient) => {
      // 1. Lock and fetch wallet
      await this.getOrCreateWallet(options.providerId, client);

      const walletRes = await client.query(
        `SELECT * FROM provider.wallets
         WHERE (provider_id::text = $1 OR legacy_mongo_id = $1)
         FOR UPDATE`,
        [options.providerId]
      );
      const wallet = walletRes.rows[0];
      const balanceBefore = Number(wallet.balance);

      const isCredit = ['recharge', 'refund', 'credit', 'initial_credit', 'release'].includes(options.type);
      const isDebit = ['deduction', 'debit', 'hold', 'penalty', 'adjustment'].includes(options.type);

      let delta = 0;
      if (isCredit) {
        delta = Math.abs(options.amount);
      } else if (isDebit) {
        delta = -Math.abs(options.amount);
      }

      const balanceAfter = Number((balanceBefore + delta).toFixed(2));
      if (balanceAfter < 0) {
        throw new Error(`Insufficient wallet balance. Current: ₹${balanceBefore}, attempted debit: ₹${Math.abs(options.amount)}`);
      }

      // 2. Increment fencing token
      const nextFencingToken = Number(wallet.fencing_token) + 1;

      // 3. Update wallet
      await client.query(
        `UPDATE provider.wallets
         SET balance = $1,
             fencing_token = $2,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $3`,
        [balanceAfter, nextFencingToken, wallet.id]
      );

      // 4. Update provider material balance & token
      await client.query(
        `UPDATE provider.providers
         SET wallet_balance = $1,
             fencing_token = $2,
             updated_at = NOW()
         WHERE (id::text = $3 OR legacy_mongo_id = $3)`,
        [balanceAfter, nextFencingToken, options.providerId]
      );

      // 5. Get previous hash in chain
      const lastTxRes = await client.query(
        `SELECT current_hash FROM provider.wallet_transactions
         WHERE provider_id = $1
         ORDER BY fencing_token DESC
         LIMIT 1`,
        [wallet.provider_id]
      );
      const previousHash = lastTxRes.rows[0]?.current_hash || 'GENESIS_HASH';

      // 6. Compute current cryptographic hash
      const now = new Date();
      const currentHash = computeWalletHash({
        previousHash,
        providerId: String(wallet.provider_id),
        type: options.type,
        amount: Math.abs(options.amount),
        balanceAfter,
        referenceId: options.referenceId,
        timestampIso: now.toISOString(),
      });

      // 7. Insert immutable transaction
      const txRes = await client.query(
        `INSERT INTO provider.wallet_transactions (
           provider_id, type, amount, balance_before, balance_after,
           currency, reference_type, reference_id, description, status,
           previous_hash, current_hash, fencing_token, trace_id, correlation_id
         ) VALUES (
           $1, $2, $3, $4, $5, 'INR', $6, $7, $8, 'success',
           $9, $10, $11, $12, $13
         )
         RETURNING *`,
        [
          wallet.provider_id,
          options.type,
          Math.abs(options.amount),
          balanceBefore,
          balanceAfter,
          options.referenceType,
          options.referenceId,
          options.description,
          previousHash,
          currentHash,
          nextFencingToken,
          options.traceId || null,
          options.correlationId || null
        ]
      );

      // 8. Insert audit log
      await client.query(
        `INSERT INTO provider.wallet_audit_logs (
           provider_id, action, actor_type, actor_id,
           balance_before, balance_after, metadata
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7
         )`,
        [
          wallet.provider_id,
          options.action || options.type.toUpperCase(),
          options.actorType || 'system',
          options.actorId ? (options.actorId.length === 36 ? options.actorId : null) : null,
          balanceBefore,
          balanceAfter,
          JSON.stringify(options.metadata || {})
        ]
      );

      // 9. Insert wallet outbox event
      await client.query(
        `INSERT INTO provider.wallet_outbox (
           event_type, provider_id, payload
         ) VALUES (
           'WALLET_TRANSACTION_RECORDED', $1, $2
         )`,
        [
          wallet.provider_id,
          JSON.stringify({
            transactionId: txRes.rows[0].id,
            amount: Math.abs(options.amount),
            type: options.type,
            balanceAfter,
            fencingToken: nextFencingToken,
            referenceId: options.referenceId
          })
        ]
      );

      const txRow = txRes.rows[0];
      const transaction: WalletTransactionEntity = {
        id: txRow.id,
        provider_id: txRow.provider_id,
        type: txRow.type,
        amount: Number(txRow.amount),
        balance_before: Number(txRow.balance_before),
        balance_after: Number(txRow.balance_after),
        currency: txRow.currency,
        reference_type: txRow.reference_type,
        reference_id: txRow.reference_id,
        description: txRow.description,
        status: txRow.status,
        previous_hash: txRow.previous_hash,
        current_hash: txRow.current_hash,
        fencing_token: Number(txRow.fencing_token),
        trace_id: txRow.trace_id,
        correlation_id: txRow.correlation_id,
        created_at: new Date(txRow.created_at)
      };

      return {
        transaction,
        newBalance: balanceAfter,
        fencingToken: nextFencingToken
      };
    });
  }

  static async getTransactions(providerId: string, limit: number = 20, offset: number = 0): Promise<{ transactions: WalletTransactionEntity[]; total: number }> {
    const [txRes, countRes] = await Promise.all([
      this.pool.query(
        `SELECT * FROM provider.wallet_transactions
         WHERE (provider_id::text = $1 OR legacy_mongo_id = $1)
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [providerId, limit, offset]
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS total FROM provider.wallet_transactions
         WHERE (provider_id::text = $1 OR legacy_mongo_id = $1)`,
        [providerId]
      )
    ]);

    const transactions = txRes.rows.map(r => ({
      id: r.id,
      provider_id: r.provider_id,
      type: r.type,
      amount: Number(r.amount),
      balance_before: Number(r.balance_before),
      balance_after: Number(r.balance_after),
      currency: r.currency,
      reference_type: r.reference_type,
      reference_id: r.reference_id,
      description: r.description,
      status: r.status,
      previous_hash: r.previous_hash,
      current_hash: r.current_hash,
      fencing_token: Number(r.fencing_token),
      trace_id: r.trace_id,
      correlation_id: r.correlation_id,
      created_at: new Date(r.created_at)
    }));

    return { transactions, total: countRes.rows[0]?.total || 0 };
  }

  static async releaseHold(providerId: string, amount: number, referenceId: string, description?: string) {
    return this.recordTransaction({
      providerId,
      amount,
      type: 'release',
      action: 'RELEASE_HOLD',
      referenceType: 'booking',
      referenceId,
      description: description || `Release hold #${referenceId}`
    });
  }
}

import { authFetch } from '@/utils/authFetch';
import { API_URL } from '@/config/api';

export interface RefundStats {
  totalRefundsToday: number;
  amountRefundedToday: number;
  pendingApproval: number;
  processing: number;
  failed: number;
  walletRefunds: number;
  gatewayRefunds: number;
}

export interface RefundPolicyRule {
  _id?: string;
  category: string;
  earlyCancellationHours: number;
  refundPercentage: number;
  providerCompensation: number;
  platformFee: number;
  walletRefundEnabled: boolean;
  gatewayRefundEnabled: boolean;
  autoApprovalLimit: number;
}

export interface PendingRefundItem {
  id: string;
  bookingId: string;
  customer: string;
  provider: string;
  amount: number;
  reason: string;
  slaMinutesLeft: number;
  requestedAt: string;
  status: string;
}

export interface AuditLogEntry {
  timestamp: string;
  user: string;
  action: string;
  ip: string;
}

class RefundService {
  async getStats(): Promise<RefundStats> {
    try {
      const res = await authFetch(`${API_URL}/refunds/stats`);
      if (res && res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[RefundService] Could not fetch stats from backend, returning defaults:', err);
    }
    return {
      totalRefundsToday: 0,
      amountRefundedToday: 0,
      pendingApproval: 0,
      processing: 0,
      failed: 0,
      walletRefunds: 0,
      gatewayRefunds: 0,
    };
  }

  async getPending(): Promise<PendingRefundItem[]> {
    try {
      const res = await authFetch(`${API_URL}/refunds/pending`);
      if (res && res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[RefundService] Could not fetch pending refunds:', err);
    }
    return [];
  }

  async getPolicies(): Promise<RefundPolicyRule[]> {
    try {
      const res = await authFetch(`${API_URL}/refunds/policies`);
      if (res && res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[RefundService] Could not fetch policies:', err);
    }
    return [
      { category: 'AC Repair', earlyCancellationHours: 2, refundPercentage: 100, providerCompensation: 200, platformFee: 0, walletRefundEnabled: true, gatewayRefundEnabled: true, autoApprovalLimit: 5000 },
      { category: 'Cleaning', earlyCancellationHours: 2, refundPercentage: 100, providerCompensation: 100, platformFee: 0, walletRefundEnabled: true, gatewayRefundEnabled: true, autoApprovalLimit: 5000 },
      { category: 'Plumbing', earlyCancellationHours: 2, refundPercentage: 100, providerCompensation: 150, platformFee: 0, walletRefundEnabled: true, gatewayRefundEnabled: true, autoApprovalLimit: 5000 },
    ];
  }

  async updatePolicy(policy: RefundPolicyRule): Promise<boolean> {
    try {
      const res = await authFetch(`${API_URL}/refunds/policies`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      return res ? res.ok : false;
    } catch (err) {
      console.warn('[RefundService] Failed to update policy:', err);
      return false;
    }
  }

  async processAction(refundId: string, action: 'approve' | 'reject', note?: string): Promise<boolean> {
    try {
      const res = await authFetch(`${API_URL}/refunds/${refundId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      return res ? res.ok : false;
    } catch (err) {
      console.warn('[RefundService] Failed to process action:', err);
      return false;
    }
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    try {
      const res = await authFetch(`${API_URL}/refunds/audit`);
      if (res && res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[RefundService] Could not fetch audit logs:', err);
    }
    return [];
  }
}

export const refundService = new RefundService();

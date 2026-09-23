// ponytail: COD Financial Accounting Helper — Platform Due vs Cash Holding
import { Money } from './money';

export interface CodBreakdown {
  cashHolding: number;      // Total cash physically collected from customer (e.g. ₹5,000)
  commission: number;       // Platform commission fee (e.g. ₹1,000)
  gst: number;              // GST on commission (e.g. ₹180)
  platformDue: number;      // Amount Provider owes Platform (e.g. ₹1,180)
  providerEarnings: number; // Provider net share (e.g. ₹3,820)
}

export function calculateCodBreakdown(
  totalCash: number,
  commissionAmount: number,
  gstRate: number = 0.18
): CodBreakdown {
  const commMoney = Money.from(commissionAmount);
  const gst = commMoney.mul(gstRate);
  const platformDue = commMoney.add(gst);
  const cashMoney = Money.from(totalCash);
  const earnings = cashMoney.sub(platformDue);

  return {
    cashHolding: totalCash,
    commission: commissionAmount,
    gst: gst.toNumber(),
    platformDue: platformDue.toNumber(),
    providerEarnings: earnings.isNegative() ? 0 : earnings.toNumber(),
  };
}

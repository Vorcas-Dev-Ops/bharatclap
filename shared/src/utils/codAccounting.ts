// ponytail: COD Financial Accounting Helper — Platform Due vs Cash Holding
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
  const gst = Math.round(commissionAmount * gstRate * 100) / 100;
  const platformDue = Math.round((commissionAmount + gst) * 100) / 100;
  const providerEarnings = Math.max(0, Math.round((totalCash - platformDue) * 100) / 100);

  return {
    cashHolding: totalCash,
    commission: commissionAmount,
    gst,
    platformDue,
    providerEarnings,
  };
}

/**
 * Utility for RazorpayX Bank Details & IFSC Auto-Lookup
 * ponytail: uses Razorpay's public IFSC endpoint (https://ifsc.razorpay.com) for O(1) stdlib lookup
 */

export interface RazorpayIfscResponse {
  bankName: string;
  branch: string;
  city: string;
  state: string;
  address: string;
}

export async function lookupRazorpayIfsc(ifscCode: string): Promise<RazorpayIfscResponse | null> {
  const cleanIfsc = ifscCode.trim().toUpperCase();
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

  if (!ifscRegex.test(cleanIfsc)) {
    return null;
  }

  try {
    const res = await fetch(`https://ifsc.razorpay.com/${cleanIfsc}`);
    if (!res.ok) return null;
    const data = await res.json();

    return {
      bankName: data.BANK || '',
      branch: data.BRANCH || '',
      city: data.CITY || '',
      state: data.STATE || '',
      address: data.ADDRESS || '',
    };
  } catch (err) {
    console.warn('[RazorpayX IFSC] Failed to lookup IFSC code:', err);
    return null;
  }
}

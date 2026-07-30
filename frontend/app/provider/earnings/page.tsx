"use client";

import React, { useState, useEffect } from "react";
import { API_URL } from "@/config/api";
import { authFetch } from "@/utils/authFetch";
import { 
  Wallet as WalletIcon, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Download, 
  Calendar, 
  TrendingUp,
  CreditCard,
  Banknote,
  Loader2,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Building
} from "lucide-react";
import { message, Modal } from "antd";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function EarningsPage() {
  const [data, setData] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [remitting, setRemitting] = useState(false);
  const [recharging, setRecharging] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(500);

  // Bank Form State
  const [bankForm, setBankForm] = useState({
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: ""
  });
  const [updatingBank, setUpdatingBank] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [earningsRes, walletRes] = await Promise.all([
        authFetch(`${API_URL}/providers/earnings-payouts`),
        authFetch(`${API_URL}/providers/wallet/balance`)
      ]);
      
      if (earningsRes.ok && walletRes.ok) {
        const earningsData = await earningsRes.json();
        const walletData = await walletRes.json();
        setData(earningsData);
        setWallet(walletData);

        // Prepopulate bank form
        if (earningsData.bankStatus !== 'not_configured' && earningsData.settlementHistory?.[0]?.provider_id?.bankDetails) {
          const bank = earningsData.settlementHistory[0].provider_id.bankDetails;
          setBankForm({
            accountHolderName: bank.accountHolderName || "",
            accountNumber: bank.accountNumber || "",
            ifscCode: bank.ifscCode || "",
            bankName: bank.bankName || ""
          });
        }
      }
    } catch (error) {
      console.error("Error fetching earnings data:", error);
      message.error("Failed to load earnings data");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUpdatingBank(true);
      const res = await authFetch(`${API_URL}/providers/bank-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bankForm)
      });
      if (res.ok) {
        message.success("Bank details updated successfully!");
        setShowBankModal(false);
        fetchData();
      } else {
        const errData = await res.json();
        message.error(errData.message || "Failed to update bank details");
      }
    } catch (err) {
      message.error("An error occurred");
    } finally {
      setUpdatingBank(false);
    }
  };

  const handleRemitCOD = async () => {
    if (!data || data.codDues <= 0) return;
    try {
      setRemitting(true);
      const res = await authFetch(`${API_URL}/providers/wallet/remit-cod`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: data.codDues })
      });
      if (res.ok) {
        message.success("COD dues paid successfully using wallet credit!");
        fetchData();
      } else {
        const errData = await res.json();
        message.error(errData.message || "Failed to remit COD dues");
      }
    } catch (err) {
      message.error("Failed to process COD remittance");
    } finally {
      setRemitting(false);
    }
  };

  const handleRecharge = async () => {
    if (rechargeAmount < 500) {
      message.warning("Minimum recharge amount is ₹500");
      return;
    }

    try {
      setRecharging(true);
      const orderRes = await authFetch(`${API_URL}/providers/wallet/recharge/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: rechargeAmount })
      });

      if (!orderRes.ok) {
        throw new Error(await orderRes.text());
      }

      const orderData = await orderRes.json();

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_mock',
        amount: orderData.amount,
        currency: 'INR',
        name: 'BharatClap Wallet',
        description: 'Wallet Balance Recharge',
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            const verifyRes = await authFetch(`${API_URL}/providers/wallet/recharge/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            if (verifyRes.ok) {
              message.success('Wallet recharged successfully!');
              fetchData();
            } else {
              message.error('Payment verification failed.');
            }
          } catch (err) {
            message.error('Error verifying payment.');
          }
        },
        prefill: {
          name: 'Partner',
          email: 'partner@bharatclap.com'
        },
        theme: {
          color: '#1D2B83'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      message.error(err.message || 'Failed to initiate recharge');
    } finally {
      setRecharging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-bold text-sm">Loading earnings & payout details...</p>
      </div>
    );
  }

  // Credit Card properties
  const balance = wallet?.walletBalance || 0;
  const reserved = wallet?.reservedBalance || 0;
  const limit = wallet?.creditLimit || 0;
  const availableCredit = balance - reserved + limit;

  // Credit status check
  let status: 'Healthy' | 'Warning' | 'Critical' | 'Blocked' = 'Healthy';
  if (availableCredit < 0) {
    status = 'Blocked';
  } else if (availableCredit < limit * 0.4) {
    status = 'Critical';
  } else if (availableCredit < limit) {
    status = 'Warning';
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Earnings & Settlements</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Monitor your lead wallet credit, job settlements, and payout batches.</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm">
          <Download className="h-4 w-4" />
          Export Statement
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Wallet Credit Card Widget */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gradient-to-br from-[#1D2B83] to-indigo-950 rounded-[32px] p-8 text-white shadow-xl shadow-blue-900/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-105 transition-all">
              <WalletIcon className="h-64 w-64" />
            </div>
            
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-200/70 bg-white/10 px-3 py-1 rounded-full">
                    Lead Wallet Credit Card
                  </span>
                  <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                    status === 'Healthy' ? 'bg-emerald-500/20 text-emerald-300' :
                    status === 'Warning' ? 'bg-amber-500/20 text-amber-300' :
                    status === 'Critical' ? 'bg-orange-500/20 text-orange-300' :
                    'bg-rose-500/20 text-rose-300 animate-pulse'
                  }`}>
                    {status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div>
                    <span className="block text-[10px] font-bold text-blue-200/60 uppercase tracking-wider">Current Balance</span>
                    <span className="text-3xl font-black">₹{balance}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-blue-200/60 uppercase tracking-wider">Available Credit</span>
                    <span className="text-3xl font-black">₹{availableCredit} / ₹{limit}</span>
                  </div>
                </div>
              </div>

              {status !== 'Healthy' && (
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl mb-6 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-100 font-medium">
                    {status === 'Blocked' 
                      ? 'Dues exceeded credit limit. Recharges needed immediately to resume receiving dispatches.'
                      : 'You have utilized part of your credit limit. Please recharge soon.'}
                  </p>
                </div>
              )}

              <div className="flex gap-4 items-center">
                <input
                  type="number"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(Number(e.target.value))}
                  placeholder="Recharge amount"
                  className="w-32 px-3 py-3 bg-white/10 border border-white/20 rounded-xl text-sm font-bold text-white placeholder-blue-200/50 focus:outline-none focus:bg-white/20 focus:border-white transition-all"
                />
                <button
                  onClick={handleRecharge}
                  disabled={recharging}
                  className="flex-1 py-3 bg-white text-indigo-950 hover:bg-slate-50 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {recharging ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Recharge Wallet'}
                </button>
              </div>
            </div>
          </div>

          {/* Settlement Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Available Earnings</span>
              <span className="text-2xl font-black text-slate-900 mt-2 block">₹{data?.availableEarnings || 0}</span>
              <span className="text-[10px] text-emerald-600 font-bold block mt-1">Ready for transfer</span>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Settlement</span>
              <span className="text-2xl font-black text-slate-900 mt-2 block">₹{data?.pendingSettlement || 0}</span>
              <span className="text-[10px] text-amber-500 font-bold block mt-1">3-day escrow hold</span>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Next Payout Date</span>
              <span className="text-sm font-black text-slate-700 mt-3 block">
                {data?.nextPayoutDate ? new Date(data.nextPayoutDate).toLocaleDateString() : 'No pending payouts'}
              </span>
              <span className="text-[10px] text-slate-400 font-bold block mt-1.5">Direct bank transfer</span>
            </div>
          </div>
        </div>

        {/* Sidebar Widgets (Bank Link + COD Dues) */}
        <div className="space-y-6">
          {/* Linked Bank Card */}
          <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-black text-slate-900">Linked Bank Account</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                  data?.bankStatus === 'verified' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-200'
                }`}>
                  {data?.bankStatus || 'Unconfigured'}
                </span>
              </div>

              {data?.bankStatus === 'verified' ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Building size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800">{bankForm.bankName}</p>
                    <p className="text-[10px] font-bold text-slate-400">Acc: •••• {bankForm.accountNumber.slice(-4)}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl">
                  <p className="text-xs font-bold text-slate-400">Configure bank account to collect payouts</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowBankModal(true)}
              className="w-full mt-6 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-slate-700"
            >
              Update Bank Details
            </button>
          </div>

          {/* COD Outstanding widget */}
          <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-black text-slate-950">COD Outstanding Dues</span>
              <span className="text-lg font-black text-rose-600">₹{data?.codDues || 0}</span>
            </div>
            
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              remit your outstanding COD cash commission to BharatClap from your wallet credit balance.
            </p>

            <button
              onClick={handleRemitCOD}
              disabled={remitting || !data || data.codDues <= 0}
              className="w-full py-3.5 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center"
            >
              {remitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Remit COD Owed Dues'}
            </button>
          </div>
        </div>

      </div>

      {/* History table */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50">
          <h2 className="text-lg font-black text-slate-900">Settlement Ledger & History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Booking ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Commission + GST</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Payout</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hold Ends At / Due By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data?.settlementHistory?.length > 0 ? (
                data.settlementHistory.map((s: any) => (
                  <tr key={s._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5 text-xs font-black text-slate-900">{s.booking_display_id}</td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-600 uppercase">{s.payment_type}</td>
                    <td className="px-6 py-5 text-xs font-black text-slate-800">₹{s.gross_amount}</td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-500">₹{s.commission_amount + s.gst_on_commission}</td>
                    <td className="px-6 py-5 text-xs font-black text-slate-800">
                      {s.payment_type === 'online' ? `₹${s.net_payable_amount}` : '-'}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        s.status === 'paid' || s.status === 'cod_settled' ? 'bg-emerald-50 text-emerald-600' :
                        s.status === 'pending_hold' || s.status === 'cod_pending' ? 'bg-amber-50 text-amber-600' :
                        s.status === 'failed' ? 'bg-rose-50 text-rose-600' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-xs font-medium text-slate-500">
                      {s.hold_ends_at ? new Date(s.hold_ends_at).toLocaleDateString() : 
                       s.cod_due_by ? new Date(s.cod_due_by).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400 font-bold text-xs">
                    No settlement records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bank Details Modal */}
      <Modal
        title={<span className="text-base font-black text-slate-900">Update Bank Account Details</span>}
        open={showBankModal}
        onCancel={() => setShowBankModal(false)}
        footer={null}
        className="rounded-3xl overflow-hidden"
      >
        <form onSubmit={handleUpdateBank} className="space-y-4 mt-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Account Holder Name</label>
            <input
              type="text"
              required
              value={bankForm.accountHolderName}
              onChange={(e) => setBankForm({ ...bankForm, accountHolderName: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Account Number</label>
            <input
              type="text"
              required
              value={bankForm.accountNumber}
              onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">IFSC Code</label>
              <input
                type="text"
                required
                value={bankForm.ifscCode}
                onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Bank Name</label>
              <input
                type="text"
                required
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={updatingBank}
            className="w-full mt-6 py-3.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center"
          >
            {updatingBank ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Save Bank Details'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

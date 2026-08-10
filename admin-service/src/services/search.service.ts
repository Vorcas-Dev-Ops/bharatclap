export class SearchService {
  static async globalSearch(query: string) {
    const q = query.trim().toLowerCase();
    return {
      query,
      timestamp: new Date().toISOString(),
      results: {
        customers: q ? [{ id: 'cust_101', name: 'Priya Sundaram', phone: '+91 91234 56789', email: 'priya.sundaram@gmail.com' }] : [],
        providers: q ? [{ id: 'prov_402', name: 'Ramesh Kumar', category: 'AC Service & Repair', phone: '+91 98765 43210' }] : [],
        bookings: q ? [{ id: 'bkg_98123', service: 'Split AC Deep Service', amount: 1499, status: 'completed' }] : [],
        transactions: q ? [{ id: 'txn_8812', amount: 1499, method: 'Razorpay UPI' }] : [],
      }
    };
  }
}

export class AuditService {
  static async getAuditLogs() {
    return [
      { id: 'AUD-8820', admin: 'Sumanth Admin', action: 'VIEW_CUSTOMER_360', resource: 'CUST-849192', ip: '103.145.72.14', browser: 'Chrome 127.0', timestamp: new Date().toISOString() },
      { id: 'AUD-8819', admin: 'Finance Admin', action: 'RELEASE_SETTLEMENT', resource: 'SETTL-91820 (₹1,130)', ip: '49.207.214.90', browser: 'Firefox 128.0', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { id: 'AUD-8818', admin: 'Sumanth Admin', action: 'TOGGLE_FEATURE_FLAG', resource: 'Flag: referral_system', ip: '103.145.72.14', browser: 'Chrome 127.0', timestamp: new Date(Date.now() - 7200000).toISOString() },
    ];
  }
}

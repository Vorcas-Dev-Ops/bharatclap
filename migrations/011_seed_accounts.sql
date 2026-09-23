-- 011_seed_accounts.sql
-- BharatClap PostgreSQL Migration — Chart of Accounts seed data
-- These accounts are referenced by all journal entries.
-- Run after accounting schema creation (005b).

INSERT INTO accounting.chart_of_accounts (code, name, account_type, currency) VALUES
    -- ponytail: ON CONFLICT DO NOTHING is intentional here — fixed seed data, not migration data
    -- Assets
    ('CUSTOMER_RECEIVABLE',     'Customer Receivable',          'asset',     'INR'),
    ('PLATFORM_ESCROW',         'Platform Escrow Account',      'asset',     'INR'),
    ('HUB_CASH_ACCOUNT',        'Hub Cash Account',             'asset',     'INR'),
    ('PROVIDER_WALLET',         'Provider Wallet Balance',       'asset',     'INR'),
    ('RAZORPAY_SETTLEMENT',     'Razorpay Settlement Account',  'asset',     'INR'),
    ('RAZORPAY_REFUND_HOLD',    'Razorpay Refund Hold',         'asset',     'INR'),
    ('LEAD_CREDIT_ASSET',       'Lead Credit Asset',            'asset',     'INR'),

    -- Liabilities
    ('GST_PAYABLE',             'GST Payable',                  'liability', 'INR'),
    ('TDS_PAYABLE',             'TDS Payable',                  'liability', 'INR'),
    ('TCS_PAYABLE',             'TCS Payable',                  'liability', 'INR'),
    ('PROVIDER_PAYABLE',        'Provider Payable',             'liability', 'INR'),
    ('PROVIDER_COD_LIABILITY',  'Provider COD Liability',       'liability', 'INR'),
    ('CUSTOMER_WALLET',         'Customer Wallet Liability',    'liability', 'INR'),
    ('REFUND_PAYABLE',          'Refund Payable',               'liability', 'INR'),
    ('CUSTOMER_ADVANCE',        'Customer Advance (Prepaid)',   'liability', 'INR'),

    -- Revenue
    ('PLATFORM_COMMISSION',     'Platform Commission Revenue',  'revenue',   'INR'),
    ('LEAD_FEE_REVENUE',        'Lead Fee Revenue',             'revenue',   'INR'),
    ('SUBSCRIPTION_REVENUE',    'Subscription Revenue',         'revenue',   'INR'),
    ('CANCELLATION_FEE_REVENUE','Cancellation Fee Revenue',     'revenue',   'INR'),
    ('CONVENIENCE_FEE_REVENUE', 'Convenience Fee Revenue',      'revenue',   'INR'),

    -- Expense
    ('RAZORPAY_FEE_EXPENSE',    'Razorpay Gateway Fee',         'expense',   'INR'),
    ('PROMO_EXPENSE',           'Promotional/Cashback Expense', 'expense',   'INR'),
    ('REFERRAL_EXPENSE',        'Referral Reward Expense',      'expense',   'INR'),
    ('REFUND_EXPENSE',          'Refund Expense',               'expense',   'INR'),
    ('PENALTY_EXPENSE',         'Provider Penalty Expense',     'expense',   'INR'),
    ('WAIVER_EXPENSE',          'Waiver Expense',               'expense',   'INR')
ON CONFLICT (code) DO NOTHING;

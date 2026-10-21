-- 036_provider_bank_account_encrypted.sql
-- Store encrypted bank account number to support RazorpayX fund account creation.

ALTER TABLE provider.provider_bank_details
  ADD COLUMN IF NOT EXISTS account_number_encrypted TEXT;

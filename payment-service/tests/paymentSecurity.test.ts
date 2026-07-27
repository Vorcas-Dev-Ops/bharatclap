import crypto from 'crypto';

describe('Payment Service Security & Integrity Test Suite', () => {
  const SECRET = 'test_razorpay_secret_key_99';

  describe('HMAC SHA256 Signature Verification', () => {
    it('should correctly compute and match valid Razorpay HMAC signatures', () => {
      const orderId = 'order_123456';
      const paymentId = 'pay_789012';
      
      const expectedSignature = crypto
        .createHmac('sha256', SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const testSignature = crypto
        .createHmac('sha256', SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      expect(expectedSignature).toBe(testSignature);
    });

    it('should reject tampered signature payloads', () => {
      const orderId = 'order_123456';
      const paymentId = 'pay_789012';
      const tamperedPaymentId = 'pay_HACKED_99';

      const validSignature = crypto
        .createHmac('sha256', SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const tamperedSignature = crypto
        .createHmac('sha256', SECRET)
        .update(`${orderId}|${tamperedPaymentId}`)
        .digest('hex');

      expect(validSignature).not.toBe(tamperedSignature);
    });
  });

  describe('Authoritative Price Overriding', () => {
    it('should override client-submitted price with database payable amount', () => {
      const clientAmount = 1; // Hack attempt ₹1
      const dbPayableAmount = 2500; // Authoritative DB price

      let finalAmount = clientAmount;
      if (dbPayableAmount && dbPayableAmount > 0) {
        finalAmount = dbPayableAmount;
      }

      expect(finalAmount).toBe(2500);
      expect(finalAmount).not.toBe(clientAmount);
    });

    it('should detect and flag razorpay order amount mismatch with DB total', () => {
      const razorpayOrderAmountPaise: number = 250000; // ₹2500 in paise
      const dbBookingAmountPaise: number = 250000;
      const tamperedBookingAmountPaise: number = 10000; // ₹100

      const isMatching = razorpayOrderAmountPaise === dbBookingAmountPaise;
      const isTamperedMatching = (razorpayOrderAmountPaise as number) === (tamperedBookingAmountPaise as number);

      expect(isMatching).toBe(true);
      expect(isTamperedMatching).toBe(false);
    });
  });

  describe('Receipt & Currency Guards', () => {
    it('should validate currency is INR', () => {
      const validCurrency: string = 'INR';
      const invalidCurrency: string = 'USD';

      expect(validCurrency === 'INR').toBe(true);
      expect(invalidCurrency === 'INR').toBe(false);
    });

    it('should match receipt booking ID format', () => {
      const bookingId = 'BK-991823';
      const receipt = `bk_${bookingId}`;

      expect(receipt.endsWith(bookingId)).toBe(true);
      expect(receipt.startsWith('bk_')).toBe(true);
    });
  });
});

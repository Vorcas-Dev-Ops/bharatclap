import { test, expect } from '@playwright/test';

test.describe('End-to-End Customer Booking & Provider Workflow', () => {
  const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

  test('Complete Customer Flow: Signup -> Search -> Book Service -> Complete', async ({ page }) => {
    // 1. Customer Signup / Login
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveTitle(/BharatClap|Service/i);

    // Fill login form
    await page.fill('input[type="text"], input[type="email"]', 'customer@example.com');
    await page.fill('input[type="password"]', 'Password@123');
    await page.click('button[type="submit"]');

    // 2. Search Service
    await page.waitForURL(`${BASE_URL}/`);
    await page.click('text=Cleaning');
    
    // Select Subservice
    await page.click('text=Deep Home Cleaning');
    
    // 3. Create Booking
    await page.click('button:has-text("Book Now"), button:has-text("Add to Cart")');
    await page.click('button:has-text("Checkout"), button:has-text("Proceed")');
    
    // Select Address & Slot
    await page.click('input[name="addressId"], div:has-text("Home")');
    await page.click('button:has-text("Confirm Booking")');

    // Verify Booking Success Screen
    await expect(page.locator('text=Booking Confirmed')).toBeVisible({ timeout: 10000 });
  });

  test('Admin Dashboard Access Guard', async ({ page }) => {
    // Attempt unauthorized navigation to /admin/dashboard without admin token
    await page.goto(`${BASE_URL}/admin/dashboard`);
    
    // Expect server-side redirect via middleware.ts to /login
    await page.waitForURL('**/login**');
    expect(page.url()).toContain('/login');
  });
});

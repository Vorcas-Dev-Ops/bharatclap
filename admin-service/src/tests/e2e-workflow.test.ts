import assert from 'assert';
import { Customer360Service } from '../services/customer360.service';
import { Provider360Service } from '../services/provider360.service';
import { DashboardService } from '../services/dashboard.service';
import { NocService } from '../services/noc.service';
import { FinanceService } from '../services/finance.service';
import { FeatureFlagsService } from '../services/featureFlags.service';
import { SettingsService } from '../services/settings.service';

/**
 * BharatClap Enterprise E2E Self-Check Test Suite
 * ponytail: Runnable zero-dependency assert test verifying core DTO contracts
 */
export async function runE2ETestSuite() {
  console.log('--- STARTING BHARATCLAP E2E CONTRACT TEST SUITE ---');

  // 1. Verify Customer 360 DTO
  const cust360 = await Customer360Service.getCustomer360('user_test_101');
  assert.ok(cust360._id, 'Customer ID should exist');
  assert.ok(cust360.stats.totalBookings >= 0, 'Customer total bookings should be >= 0');
  console.log('✓ Customer 360 DTO Contract Validated');

  // 2. Verify Provider 360 DTO
  const prov360 = await Provider360Service.getProvider360('prov_test_402');
  assert.ok(prov360._id, 'Provider ID should exist');
  assert.ok(prov360.rating >= 0, 'Provider rating should be >= 0');
  console.log('✓ Provider 360 DTO Contract Validated');

  // 3. Verify Dashboard Metrics
  const dash: any = await DashboardService.getDashboardMetrics();
  assert.ok(dash.totalCustomers >= 0, 'Dashboard customers count should be valid');
  assert.ok(dash.totalRevenueToday >= 0, 'Dashboard revenue should be valid');
  console.log('✓ Executive Dashboard DTO Contract Validated');

  // 4. Verify NOC Telemetry
  const noc: any = await NocService.getNocTelemetry();
  assert.ok(noc.services.length === 10, 'NOC telemetry should report 10 microservices');
  console.log('✓ Operations Center (NOC) DTO Contract Validated');

  // 5. Verify Finance Metrics
  const fin: any = await FinanceService.getFinanceMetrics();
  assert.ok(fin.platformCommission >= 0, 'Finance platform commission should be valid');
  console.log('✓ Finance Dashboard DTO Contract Validated');

  // 6. Verify Feature Flags
  const flags: any = await FeatureFlagsService.getFeatureFlags();
  assert.ok(flags.length > 0, 'Feature flags list should not be empty');
  console.log('✓ Feature Flags System Contract Validated');

  // 7. Verify Settings
  const settings: any = await SettingsService.getPlatformSettings();
  assert.ok(settings.platformName, 'Platform name in settings should exist');
  console.log('✓ Platform Settings System Contract Validated');

  console.log('--- ALL E2E CONTRACT TESTS PASSED SUCCESSFULLY (7/7) ---');
}

if (require.main === module) {
  runE2ETestSuite().catch((err) => {
    console.error('❌ E2E Contract Test Failed:', err);
    process.exit(1);
  });
}

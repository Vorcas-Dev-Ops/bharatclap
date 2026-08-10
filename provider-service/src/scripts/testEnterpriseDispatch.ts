import assert from 'assert';
import { travelTimeService } from '../services/travel/TravelTimeService';
import { scheduleEngine } from '../services/schedule/ScheduleEngine';
import { dispatchScoringEngine } from '../services/dispatch/DispatchScoringEngine';

async function runEnterpriseDispatchTests() {
  console.log('--- STARTING ENTERPRISE DISPATCH SUITE VERIFICATION ---');

  // Test 1: TravelTimeService Calculation & 5-min Grid Caching
  console.log('\n[TEST 1] TravelTimeService Grid Cache & Estimate...');
  const origin = { lng: 77.5946, lat: 12.9716 }; // Bangalore Majestic
  const dest = { lng: 77.6412, lat: 12.9784 };   // Indiranagar (~5.5 km)

  const est1 = await travelTimeService.getTravelEstimate(origin, dest);
  console.log(`✓ Estimate 1: ${est1.distanceMeters}m, ${est1.durationMinutes} min, engine: ${est1.providerName}`);
  assert.ok(est1.durationMinutes > 0, 'Duration should be positive');
  assert.strictEqual(est1.confidenceScore, 85, 'Default Haversine confidence score should be 85');

  const est2 = await travelTimeService.getTravelEstimate(origin, dest);
  console.log(`✓ Estimate 2: ${est2.distanceMeters}m, ${est2.durationMinutes} min, engine: ${est2.providerName}`);
  assert.ok(est2.providerName.includes('cached'), 'Second call within 5m must return cached result');

  // Test 2: Required Availability Formula & Schedule Fitting
  console.log('\n[TEST 2] Enterprise Dispatch Formula & Required Availability...');
  // Scenario: Booking at 5:00 PM (17:00), Travel 25 min, Safety Buffer 10 min
  const bookingStart = new Date('2026-08-03T17:00:00Z');
  const travelMinutes = 25;
  const buffers = { safetyBufferMinutes: 10, cleanupBufferMinutes: 15, maxAcceptableLatenessMinutes: 5 };

  // Formula: Required Availability = 17:00 - (25 + 10) min = 16:25 (4:25 PM)
  const fitCheck = await scheduleEngine.canBookingFit(
    '65b000000000000000000001',
    bookingStart,
    60, // 1 hour duration
    travelMinutes,
    buffers
  );

  const reqTimeStr = fitCheck.requiredAvailabilityTime.toISOString();
  console.log(`✓ Required Availability Time for 5:00 PM booking (25m travel + 10m buffer): ${reqTimeStr}`);
  assert.strictEqual(fitCheck.candidateTravelStart.toISOString(), '2026-08-03T16:25:00.000Z');

  // Test 3: Arrival Confidence & Multi-Factor Dispatch Scoring
  console.log('\n[TEST 3] Dispatch Scoring with Arrival Confidence...');
  const providerA = dispatchScoringEngine.calculateScore({
    distanceMeters: 4000,
    overallRating: 4.8,
    isPriorityPackage: true,
    jobsToday: 2,
    arrivalConfidenceScore: 98
  }, {
    distanceWeight: 35,
    ratingWeight: 20,
    priorityPackageWeight: 15,
    loadBalancingWeight: 10,
    recencyWeight: 10,
    arrivalConfidenceWeight: 10
  });

  const providerB = dispatchScoringEngine.calculateScore({
    distanceMeters: 3000,
    overallRating: 4.5,
    isPriorityPackage: false,
    jobsToday: 4,
    arrivalConfidenceScore: 61
  }, {
    distanceWeight: 35,
    ratingWeight: 20,
    priorityPackageWeight: 15,
    loadBalancingWeight: 10,
    recencyWeight: 10,
    arrivalConfidenceWeight: 10
  });

  console.log(`✓ Provider A Score (ETA 17m @ 98% confidence): ${providerA.toFixed(2)}`);
  console.log(`✓ Provider B Score (ETA 14m @ 61% confidence): ${providerB.toFixed(2)}`);
  assert.ok(providerA > providerB, 'High confidence & rating provider should rank higher');

  console.log('\n✅ ALL ENTERPRISE DISPATCH SELF-CHECKS PASSED!');
}

runEnterpriseDispatchTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

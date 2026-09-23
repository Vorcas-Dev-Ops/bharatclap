#!/usr/bin/env pwsh
# test_true_concurrency.ps1
# Launches two SEPARATE psql connections that race for the same slot.
# Proves FOR UPDATE serialization works across real concurrent connections.

$env:PGPASSWORD = "postgres"
$db = "bharatclap_migration_test"
$testDir = $PSScriptRoot

Write-Host "`n=== TRUE TWO-CONNECTION CONCURRENCY TEST ===" -ForegroundColor Cyan

# Reset slot to 0/1
Write-Host "Resetting slot capacity to 0/1..."
psql -U postgres -h localhost -d $db -c "UPDATE booking.slot_capacities SET booked_count = 0 WHERE provider_id = 'b0000000-0000-0000-0000-000000000001' AND slot_date = '2099-12-31' AND slot = '10:00';" 2>$null

# Launch Connection A and B in parallel
Write-Host "Launching Connection A and B simultaneously..."

$jobA = Start-Job -ScriptBlock {
    $env:PGPASSWORD = "postgres"
    psql -U postgres -h localhost -d $args[0] -f $args[1] 2>&1
} -ArgumentList $db, "$testDir\conn_a_book.sql"

$jobB = Start-Job -ScriptBlock {
    $env:PGPASSWORD = "postgres"
    psql -U postgres -h localhost -d $args[0] -f $args[1] 2>&1
} -ArgumentList $db, "$testDir\conn_b_book.sql"

# Wait for both to complete (A holds lock for 2s, B waits)
Write-Host "Waiting for both connections (A holds lock ~2s, B blocks until A commits)..."
$resultA = Receive-Job -Job $jobA -Wait
$resultB = Receive-Job -Job $jobB -Wait

Write-Host "`n--- Connection A output ---" -ForegroundColor Yellow
Write-Host ($resultA -join "`n")

Write-Host "`n--- Connection B output ---" -ForegroundColor Yellow
Write-Host ($resultB -join "`n")

# Verify final state
Write-Host "`n--- Final State ---" -ForegroundColor Cyan
$final = psql -U postgres -h localhost -d $db -t -c "SELECT booked_count FROM booking.slot_capacities WHERE provider_id = 'b0000000-0000-0000-0000-000000000001' AND slot_date = '2099-12-31' AND slot = '10:00';"
$booked = ($final -replace '\s','')

if ($booked -eq "1") {
    Write-Host "PASSED: booked_count = $booked (exactly 1 booking for 1 slot)" -ForegroundColor Green
} else {
    Write-Host "FAILED: booked_count = $booked (expected 1)" -ForegroundColor Red
}

# Cleanup jobs
Remove-Job $jobA, $jobB -Force

Write-Host "`n=== TEST COMPLETE ===" -ForegroundColor Cyan

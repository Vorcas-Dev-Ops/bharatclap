const fs = require('fs');
const path = require('path');

const schemaPath = 'C:/Users/HP/.gemini/config/skills/security-audit/report-schema.json';
const runDirArg = process.argv[2] || 'run-1';
const findingsPath = path.resolve(__dirname, `../docs/security-audit/${runDirArg}/findings.json`);
const ledgerPath = path.resolve(__dirname, `../docs/security-audit/${runDirArg}/coverage-ledger.json`);

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const findings = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));

console.log(`[${runDirArg}] Loaded ${findings.length} findings and ${ledger.length} ledger units.`);

// 1. Validate findings fingerprints and required fields
const FINGERPRINT_REGEX = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/;
const validVerdicts = new Set(['confirmed', 'needs_validation', 'rejected']);

let errors = [];

findings.forEach((f, idx) => {
  if (!validVerdicts.has(f.verdict)) {
    errors.push(`Finding ${idx}: Invalid verdict '${f.verdict}'`);
  }
  if (!FINGERPRINT_REGEX.test(f.fingerprint)) {
    errors.push(`Finding ${idx}: Invalid fingerprint format '${f.fingerprint}'`);
  }
  if (!f.title || f.title.trim() === '') {
    errors.push(`Finding ${idx}: Missing title`);
  }
  if (!f.description || f.description.trim() === '') {
    errors.push(`Finding ${idx}: Missing description`);
  }
  if (f.verdict === 'confirmed') {
    if (!f.root_cause) errors.push(`Finding ${f.fingerprint}: Missing root_cause`);
    if (!f.intended_behavior) errors.push(`Finding ${f.fingerprint}: Missing intended_behavior`);
    if (!f.trace || !Array.isArray(f.trace) || f.trace.length === 0) errors.push(`Finding ${f.fingerprint}: Missing trace`);
    if (!f.evidence || !Array.isArray(f.evidence) || f.evidence.length === 0) errors.push(`Finding ${f.fingerprint}: Missing evidence`);
    if (!f.conditions || !Array.isArray(f.conditions)) errors.push(`Finding ${f.fingerprint}: Missing conditions`);
    if (!f.execution) errors.push(`Finding ${f.fingerprint}: Missing execution`);
    if (!f.remediation) errors.push(`Finding ${f.fingerprint}: Missing remediation`);
    if (!f.severity || !f.severity.overall_severity) errors.push(`Finding ${f.fingerprint}: Missing severity`);
    if (!f.confidence || !f.confidence.score) errors.push(`Finding ${f.fingerprint}: Missing confidence`);
  } else if (f.verdict === 'needs_validation') {
    if (!f.claimed_root_cause) errors.push(`Finding ${f.fingerprint}: Missing claimed_root_cause`);
    if (!f.blockers || f.blockers.length === 0) errors.push(`Finding ${f.fingerprint}: Missing blockers`);
    if (!f.validation_plan) errors.push(`Finding ${f.fingerprint}: Missing validation_plan`);
  } else if (f.verdict === 'rejected') {
    if (!f.claimed_root_cause) errors.push(`Finding ${f.fingerprint}: Missing claimed_root_cause`);
    if (!f.reason) errors.push(`Finding ${f.fingerprint}: Missing reason`);
    if (!f.trace || !Array.isArray(f.trace) || f.trace.length === 0) errors.push(`Finding ${f.fingerprint}: Missing trace`);
    if (!f.evidence || !Array.isArray(f.evidence) || f.evidence.length === 0) errors.push(`Finding ${f.fingerprint}: Missing evidence`);
  }
});

// 2. Validate ledger structure and coverage_id
const seenIds = new Set();
ledger.forEach((u, idx) => {
  if (seenIds.has(u.coverage_id)) {
    errors.push(`Duplicate coverage_id: ${u.coverage_id}`);
  }
  seenIds.add(u.coverage_id);
  if (!u.canonical_refs) errors.push(`Unit ${idx}: Missing canonical_refs`);
  if (!u.status) errors.push(`Unit ${idx}: Missing status`);
});

if (errors.length > 0) {
  console.error('Validation Errors Found:');
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
} else {
  console.log('All findings.json and coverage-ledger.json structures successfully validated!');
}

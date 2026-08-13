# Data Breach & Cyber Incident Response Runbook
## CERT-In 6-Hour + DPDP Notification Requirements

**Organization:** BharatClap Home Services Platform  
**Statutory Frameworks:** 
1. **CERT-In Directions (Section 70B Information Technology Act 2000):** Mandatory **6-hour** reporting window for covered cyber incidents, data leaks, and system compromises *(where applicable)*.
2. **MeitY DPDP Rules 2025 / DPDP Act 2023 (Section 8(6)):** Data Fiduciary statutory notification requirements to Data Protection Board of India and affected Data Principals.

---

## 1. Incident Classification & Decision Flowchart

```
                          [INCIDENT DETECTED]
                                   │
                    ┌──────────────┴──────────────┐
                    │ Contain & Preserve Evidence │
                    └──────────────┬──────────────┘
                                   │
                       [Classify Incident Type]
                                   │
                  Is CERT-In Reporting Applicable?
                   ┌───────────────┴───────────────┐
                 YES                              NO
                   │                               │
    ┌──────────────┴──────────────┐                │
    │ CERT-In Notice (≤ 6 Hours)  │                │
    └──────────────┬──────────────┘                │
                   └───────────────┬───────────────┘
                                   │
                      [DPDP Breach Assessment]
                                   │
                   ┌───────────────┴───────────────┐
                   │ Applicable Board Notification │
                   └───────────────┬───────────────┘
                                   │
               [Affected Data Principal Notice (Where Required)]
                                   │
                ┌──────────────────┴──────────────────┐
                │ Investigation & Root Cause Remediation │
                └──────────────────┬──────────────────┘
                                   │
                       [Audit Record & Evidence Log]
```

---

## 2. Severity Classification Matrix

| Severity Level | Threshold / Impact | Internal Escalation SLA | CERT-In Reporting Window | DPDP Board & User Notice |
| :--- | :--- | :--- | :--- | :--- |
| **P1 - CRITICAL** | Exfiltration of PII (Passwords, KYC, Financials, Aadhaar/PAN) or DB compromise > 1,000 users | **Immediate (< 15 mins)** | **Mandatory ≤ 6 Hours** *(Where Applicable)* | Promptly following initial containment |
| **P2 - MAJOR** | Unauthorized access to user contact data / session tokens without mass exfiltration | **< 1 hour** | **Mandatory ≤ 6 Hours** *(Where Applicable)* | Following risk assessment |
| **P3 - MINOR** | Isolated single-user credential compromise / failed intrusion attempt | **< 4 hours** | Log internally; report if systemic | Standard incident ledger |

---

## 3. Mandatory Statutory Incident Report Templates

### A. CERT-In Cyber Incident Report Template *(Where Applicable — 6-Hour Clock)*
*Email to `incident@cert-in.org.in` within **6 hours** of detecting covered incidents.*

```text
CYBER INCIDENT REPORT — CERT-IN MANDATORY NOTICE (WHERE APPLICABLE)
To: Indian Computer Emergency Response Team (CERT-In)
Email: incident@cert-in.org.in
Date: [YYYY-MM-DD]
Incident Ref: BHARATCLAP-CERT-[YYYYMMDD]-[NUMBER]

1. INCIDENT OVERVIEW:
   - Reporting Entity: BharatClap Home Services Platform (Data Fiduciary)
   - Date & Time Incident Noticed: [YYYY-MM-DD HH:MM IST]
   - Type of Incident: [Data Leak / Unauthorized Access / System Breach]
   - Suspected Threat Vector: [API vulnerability / Unauthorized exfiltration]

2. SYSTEM & DATA AFFECTED:
   - Impacted Infrastructure: [Microservice name / Database cluster / API Gateway]
   - Affected IP Addresses / Domain URLs: [api.bharatclap.com / gateway IPs]
   - Estimated Record Volume Affected: [Approximate user/provider record count]
   - Data Categories Potentially Exposed: [Name, Phone, Address, KYC metadata]

3. INITIAL CONTAINMENT & REMEDIATION (TAKEN WITHIN 2 HOURS):
   - Affected API endpoints isolated and firewalled.
   - Active JWT sessions and authentication tokens revoked.
   - Forensic log collection preserved for CERT-In analysis.

4. DESIGNATED INCIDENT COMMANDER CONTACT:
   - Name / Title: Chief Information Security Officer / DPO
   - 24x7 Emergency Contact Phone: +91-80-XXXX-XXXX
   - Official Email: dpo@bharatclap.com / security@bharatclap.com
```

---

### B. Data Protection Board of India Notice Template (DPDP Rules Framework)

```text
DPDP DATA FIDUCIARY BREACH INTIMATION
To: The Data Protection Board of India
Date: [YYYY-MM-DD]
Ref: DPDP-BOARD-[YYYY]-[NUMBER]

1. FIDUCIARY DETAILS:
   - Entity: BharatClap Home Services Platform
   - Contact Person: Data Protection Officer (dpo@bharatclap.com)

2. BREACH SUMMARY:
   - Detection Timestamp: [YYYY-MM-DD HH:MM IST]
   - Nature of Personal Data Impacted: [User Contact Info / Address / Provider Verification Records]
   - Number of Impacted Data Principals: [Count]

3. MITIGATION & SAFEGUARDS ENFORCED:
   - Vulnerability patched; fail-closed encryption verified.
   - CERT-In notification transmitted at [Timestamp] (if applicable).
   - Individual user notifications dispatched.
```

---

### C. Affected Data Principal Notice Template (User Breach Notice)

```text
SUBJECT: Security Notice Regarding Your BharatClap Account

Dear [User Name],

We are writing to inform you of a data security incident that may have involved personal information linked to your BharatClap account.

WHAT HAPPENED?
On [Date], our security systems detected an unauthorized access attempt targeting a platform subsystem. Our engineering team immediately isolated the system, patched the vulnerability, and notified statutory authorities including CERT-In (where applicable).

WHAT INFORMATION WAS INVOLVED?
- Information potentially impacted: [e.g., Name, Phone Number, Saved Delivery Address]
- NOT IMPACTED: Password hashes remain encrypted, and NO raw payment card or UPI PIN data was exposed.

ACTIONS WE ARE TAKING:
- All active login sessions have been invalidated.
- Fail-closed cryptographic checks and additional rate-limiting controls have been activated.

ACTIONS YOU SHOULD TAKE:
1. Re-authenticate your BharatClap account with a fresh OTP/password.
2. Remain vigilant against phishing calls or SMS. BharatClap team members will NEVER ask for your OTP.

FOR INQUIRIES:
Contact our Data Protection Officer at dpo@bharatclap.com referencing Incident ID: [BHARATCLAP-CERT-2026-XXXX].

Data Protection Officer
BharatClap Home Services Platform
```

---

## 4. Post-Incident Forensic Ledger & Root Cause Protocol
- **Forensic Preservation:** Logs retained for 180 days per CERT-In guidelines.
- **Root Cause Analysis (RCA):** Post-mortem report published to Executive Committee within 14 calendar days.

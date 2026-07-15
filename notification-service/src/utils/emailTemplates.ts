const PLATFORM_NAME = process.env.PLATFORM_NAME || 'BharatClap';
const PLATFORM_COLOR = '#1D2B83';
const PLATFORM_ACCENT = '#F4A924';

// ─── Provider Welcome / Onboarding Email ──────────────────────────────────────

export const providerWelcomeEmail = (providerName: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to ${PLATFORM_NAME} – Provider Registration</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${PLATFORM_COLOR} 0%,#2d3eb5 100%);padding:40px 48px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
                ${PLATFORM_NAME}
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Home Services Marketplace</p>
            </td>
          </tr>

          <!-- Welcome Banner -->
          <tr>
            <td style="background:${PLATFORM_ACCENT};padding:16px 48px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:15px;font-weight:600;">🎉 Registration Successful — Welcome Aboard!</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px;">
              <p style="margin:0 0 16px;color:#333;font-size:16px;">Dear <strong>${providerName}</strong>,</p>

              <p style="margin:0 0 20px;color:#555;font-size:15px;line-height:1.7;">
                Thank you for registering as a service provider with <strong>${PLATFORM_NAME}</strong>.
                We have successfully received your registration and truly appreciate your interest in joining our platform.
              </p>

              <!-- What happens next section -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fc;border-radius:12px;padding:0;margin-bottom:28px;">
                <tr>
                  <td style="padding:28px 32px;">
                    <p style="margin:0 0 20px;color:${PLATFORM_COLOR};font-size:16px;font-weight:700;border-bottom:2px solid #e8eaf6;padding-bottom:12px;">
                      📋 What Happens Next?
                    </p>

                    <!-- Step 1 -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                      <tr>
                        <td width="44" valign="top">
                          <div style="width:36px;height:36px;background:${PLATFORM_COLOR};border-radius:50%;text-align:center;line-height:36px;color:#fff;font-size:16px;">📄</div>
                        </td>
                        <td style="padding-left:12px;vertical-align:top;">
                          <p style="margin:0 0 4px;color:#1a1a1a;font-size:15px;font-weight:600;">Document Verification</p>
                          <p style="margin:0;color:#666;font-size:14px;line-height:1.6;">
                            Our team will verify the documents you submitted. The verification process will be completed during your in-person meeting with our onboarding team.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Step 2 -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                      <tr>
                        <td width="44" valign="top">
                          <div style="width:36px;height:36px;background:${PLATFORM_COLOR};border-radius:50%;text-align:center;line-height:36px;color:#fff;font-size:16px;">🎓</div>
                        </td>
                        <td style="padding-left:12px;vertical-align:top;">
                          <p style="margin:0 0 4px;color:#1a1a1a;font-size:15px;font-weight:600;">Training Session</p>
                          <p style="margin:0;color:#666;font-size:14px;line-height:1.6;">
                            Before you begin offering services, you will receive a training session covering our service standards, platform workflow, customer expectations, and operational guidelines.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Step 3 -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="44" valign="top">
                          <div style="width:36px;height:36px;background:${PLATFORM_COLOR};border-radius:50%;text-align:center;line-height:36px;color:#fff;font-size:16px;">📞</div>
                        </td>
                        <td style="padding-left:12px;vertical-align:top;">
                          <p style="margin:0 0 4px;color:#1a1a1a;font-size:15px;font-weight:600;">Further Communication</p>
                          <p style="margin:0;color:#666;font-size:14px;line-height:1.6;">
                            Our team will contact you through your <strong>registered phone number</strong> and <strong>registered email address</strong> to share:
                          </p>
                          <ul style="margin:10px 0 0 0;padding-left:20px;color:#666;font-size:14px;line-height:1.8;">
                            <li>Training schedule and venue / details</li>
                            <li>Document verification appointment</li>
                            <li>Onboarding instructions</li>
                            <li>Any additional information required to complete your registration</li>
                          </ul>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Important note -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border-left:4px solid ${PLATFORM_ACCENT};border-radius:0 8px 8px 0;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;color:#7a5800;font-size:14px;line-height:1.6;">
                      ⚠️ <strong>Important:</strong> Please ensure that your registered phone number and email address remain <strong>active</strong> so you don't miss any important updates. If any additional documents or information are required, our team will notify you during the onboarding process.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#555;font-size:15px;line-height:1.7;">
                Thank you for choosing to partner with <strong>${PLATFORM_NAME}</strong>. We look forward to welcoming you to our provider community.
              </p>
              <p style="margin:0;color:#555;font-size:15px;">Kind regards,</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fc;border-top:1px solid #e8eaf6;padding:28px 48px;text-align:center;">
              <p style="margin:0 0 4px;color:${PLATFORM_COLOR};font-size:15px;font-weight:700;">The ${PLATFORM_NAME} Team</p>
              <p style="margin:0;color:#999;font-size:12px;">This is an automated email. Please do not reply directly to this message.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

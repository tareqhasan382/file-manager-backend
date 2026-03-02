const baseTemplate = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>FileVault</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">📁 FileVault</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Secure File Management</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} FileVault. All rights reserved.</p>
              <p style="margin:6px 0 0;color:#9ca3af;font-size:12px;">
                If you have questions, contact us at 
                <a href="mailto:support@filevault.com" style="color:#6366f1;text-decoration:none;">support@filevault.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ─── Button Component ─────────────────────────────────────────────────────────
const button = (text: string, url: string, color = "#6366f1") => `
  <div style="text-align:center;margin:28px 0;">
    <a href="${url}" style="display:inline-block;background:${color};color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.3px;">
      ${text}
    </a>
  </div>
`;

// ─── Info Box Component ───────────────────────────────────────────────────────
const infoBox = (items: { label: string; value: string }[]) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;border-radius:8px;padding:20px;margin:24px 0;border:1px solid #e5e7eb;">
    ${items
      .map(
        (item) => `
      <tr>
        <td style="padding:6px 0;color:#6b7280;font-size:14px;width:40%;">${item.label}</td>
        <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${item.value}</td>
      </tr>`
      )
      .join("")}
  </table>
`;

// ─── 1. Subscription Activated ────────────────────────────────────────────────
export const subscriptionActivatedEmail = ({
  name,
  plan,
  dashboardUrl = "https://app.filevault.com/dashboard",
}: {
  name: string;
  plan: string;
  dashboardUrl?: string;
}) => ({
  subject: `🎉 Your ${plan} Plan is Now Active!`,
  html: baseTemplate(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">Welcome to ${plan}! 🚀</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
      Hi <strong>${name}</strong>, your subscription has been activated successfully. 
      You now have access to all <strong>${plan}</strong> plan features.
    </p>
    ${infoBox([
      { label: "Plan", value: plan },
      { label: "Status", value: "✅ Active" },
      { label: "Activated On", value: new Date().toDateString() },
    ])}
    <p style="margin:0 0 4px;color:#6b7280;font-size:14px;">You can now enjoy:</p>
    <ul style="color:#374151;font-size:14px;line-height:2;padding-left:20px;">
      <li>Expanded file & folder storage</li>
      <li>Increased storage limit</li>
      <li>Priority support</li>
    </ul>
    ${button("Go to Dashboard", dashboardUrl)}
  `),
});

// ─── 2. Payment Failed ────────────────────────────────────────────────────────
export const paymentFailedEmail = ({
  name,
  plan,
  billingUrl = "https://app.filevault.com/billing",
}: {
  name: string;
  plan: string;
  billingUrl?: string;
}) => ({
  subject: `⚠️ Payment Failed – Action Required`,
  html: baseTemplate(`
    <h2 style="margin:0 0 8px;color:#dc2626;font-size:22px;font-weight:700;">Payment Failed</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
      Hi <strong>${name}</strong>, we were unable to process your payment for the 
      <strong>${plan}</strong> plan. Please update your payment method to avoid service interruption.
    </p>
    ${infoBox([
      { label: "Plan", value: plan },
      { label: "Status", value: "⚠️ Past Due" },
      { label: "Date", value: new Date().toDateString() },
    ])}
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0;color:#dc2626;font-size:14px;line-height:1.6;">
        ⚠️ <strong>Important:</strong> If payment is not resolved within 3 days, 
        your account will be downgraded to the FREE plan.
      </p>
    </div>
    ${button("Update Payment Method", billingUrl, "#dc2626")}
  `),
});

// ─── 3. Subscription Canceled ────────────────────────────────────────────────
export const subscriptionCanceledEmail = ({
  name,
  plan,
  upgradeUrl = "https://app.filevault.com/billing",
}: {
  name: string;
  plan: string;
  upgradeUrl?: string;
}) => ({
  subject: `❌ Your ${plan} Subscription Has Been Canceled`,
  html: baseTemplate(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">Subscription Canceled</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
      Hi <strong>${name}</strong>, your <strong>${plan}</strong> subscription has been canceled. 
      Your account has been downgraded to the <strong>FREE</strong> plan.
    </p>
    ${infoBox([
      { label: "Previous Plan", value: plan },
      { label: "Current Plan", value: "FREE" },
      { label: "Canceled On", value: new Date().toDateString() },
    ])}
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0;color:#92400e;font-size:14px;line-height:1.6;">
        📌 <strong>Note:</strong> You may lose access to files and folders that exceed FREE plan limits.
        Upgrade anytime to restore full access.
      </p>
    </div>
    ${button("Upgrade Plan", upgradeUrl, "#6366f1")}
  `),
});

// ─── 4. Subscription Renewed ─────────────────────────────────────────────────
export const subscriptionRenewedEmail = ({
  name,
  plan,
  dashboardUrl = "https://app.filevault.com/dashboard",
}: {
  name: string;
  plan: string;
  dashboardUrl?: string;
}) => ({
  subject: `✅ Subscription Renewed – ${plan} Plan`,
  html: baseTemplate(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">Subscription Renewed 🎉</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
      Hi <strong>${name}</strong>, your <strong>${plan}</strong> plan has been successfully renewed. 
      Thank you for staying with us!
    </p>
    ${infoBox([
      { label: "Plan", value: plan },
      { label: "Status", value: "✅ Active" },
      { label: "Renewed On", value: new Date().toDateString() },
    ])}
    ${button("Go to Dashboard", dashboardUrl)}
  `),
});

// ─── 5. Welcome Email (after register) ───────────────────────────────────────
export const welcomeEmail = ({
  name,
  dashboardUrl = "https://app.filevault.com/dashboard",
}: {
  name: string;
  dashboardUrl?: string;
}) => ({
  subject: `👋 Welcome to FileVault, ${name}!`,
  html: baseTemplate(`
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">Welcome aboard, ${name}! 👋</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
      Your account has been created successfully. You're currently on the 
      <strong>FREE plan</strong> — upgrade anytime to unlock more features.
    </p>
    ${infoBox([
      { label: "Plan", value: "FREE" },
      { label: "Status", value: "✅ Active" },
      { label: "Joined On", value: new Date().toDateString() },
    ])}
    ${button("Get Started", dashboardUrl)}
  `),
});
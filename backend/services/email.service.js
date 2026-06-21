import { getEmailTransporter, emailFrom } from "../config/email.config.js";

const FRONTEND_URL = () => process.env.FRONTEND_URL || "http://localhost:3000";

export async function sendVerificationEmail(to, fullName, rawToken) {
  const verifyUrl = `${FRONTEND_URL()}/verify-email?token=${rawToken}`;

  await getEmailTransporter().sendMail({
    from: emailFrom(),
    to,
    subject: "Verify your Beepr account",
    text: `Hi ${fullName},\n\nPlease verify your email by clicking the link below:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't create a Beepr account, ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#1a1a1a">Verify your Beepr account</h2>
        <p>Hi ${fullName},</p>
        <p>Click the button below to verify your email address and activate your account.</p>
        <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
          Verify Email
        </a>
        <p style="margin-top:20px;color:#666;font-size:13px">
          This link expires in <strong>24 hours</strong>.<br>
          If you didn't sign up for Beepr, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to, fullName, rawToken) {
  const resetUrl = `${FRONTEND_URL()}/reset-password?token=${rawToken}`;

  await getEmailTransporter().sendMail({
    from: emailFrom(),
    to,
    subject: "Reset your Beepr password",
    text: `Hi ${fullName},\n\nYou requested a password reset. Click the link below:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#1a1a1a">Reset your Beepr password</h2>
        <p>Hi ${fullName},</p>
        <p>We received a request to reset the password for your account.</p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
          Reset Password
        </a>
        <p style="margin-top:20px;color:#666;font-size:13px">
          This link expires in <strong>1 hour</strong>.<br>
          If you didn't request a password reset, ignore this email — your password has not changed.
        </p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(to, fullName) {
  await getEmailTransporter().sendMail({
    from: emailFrom(),
    to,
    subject: "Welcome to Beepr!",
    text: `Hi ${fullName},\n\nYour email is verified and your Beepr account is active. Let's get started!\n\nHead to ${FRONTEND_URL()}/dashboard to set up your AI calling agent.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#1a1a1a">Welcome to Beepr, ${fullName}!</h2>
        <p>Your email has been verified and your account is now active.</p>
        <a href="${FRONTEND_URL()}/dashboard" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
          Go to Dashboard
        </a>
      </div>
    `,
  });
}

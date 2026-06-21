import nodemailer from "nodemailer";

let transporter = null;

export function getEmailTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

export const emailFrom = () =>
  `"${process.env.FROM_NAME || "Beepr"}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`;

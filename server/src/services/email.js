import nodemailer from "nodemailer";
export const mailEnabled = () => !!process.env.SMTP_HOST;
let tx = null;
export async function sendEmail(to, subject, body) {
  const port = +(process.env.SMTP_PORT || 587);
  tx ||= nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  const info = await tx.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text: body });
  return info.messageId;
}
export const mailLink = (email, subject, body) => `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

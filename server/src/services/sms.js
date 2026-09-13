// SMS via MSG91 (India) or Twilio. Set one of them in .env.
export const smsEnabled = () => !!(process.env.MSG91_AUTHKEY && process.env.MSG91_SENDER) || !!(process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_FROM);
const digits = (p) => { const d = (p || "").replace(/\D/g, ""); return d.length === 10 ? "91" + d : d; };
export async function sendSms(phone, body) {
  if (process.env.MSG91_AUTHKEY) {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", { method: "POST", headers: { authkey: process.env.MSG91_AUTHKEY, "Content-Type": "application/json" }, body: JSON.stringify({ sender: process.env.MSG91_SENDER, route: "4", country: "91", sms: [{ message: body, to: [digits(phone)] }] }) });
    const d = await res.json(); if (!res.ok || d.type === "error") throw new Error(d.message || "MSG91 failed"); return d.request_id || "msg91";
  }
  const auth = Buffer.from(`${process.env.TWILIO_SID}:${process.env.TWILIO_TOKEN}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_SID}/Messages.json`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ To: "+" + digits(phone), From: process.env.TWILIO_FROM, Body: body }) });
  const d = await res.json(); if (!res.ok) throw new Error(d.message || "Twilio failed"); return d.sid;
}

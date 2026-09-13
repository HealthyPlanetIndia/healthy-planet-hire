const API = "https://graph.facebook.com/v20.0";
export const waEnabled = () => !!(process.env.WA_TOKEN && process.env.WA_PHONE_NUMBER_ID);
export const digits = (p) => (p || "").replace(/\D/g, "");
export const waLink = (phone, text) => `https://wa.me/${digits(phone)}?text=${encodeURIComponent(text)}`;

export async function sendWhatsApp(phone, body) {
  const res = await fetch(`${API}/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: digits(phone), type: "text", text: { body, preview_url: true } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "WhatsApp send failed");
  return data.messages?.[0]?.id;
}

export function parseInbound(payload) {
  const out = [];
  for (const e of payload.entry || []) for (const ch of e.changes || []) for (const m of ch.value?.messages || []) {
    out.push({ from: m.from, text: m.type === "text" ? m.text.body : `[${m.type} message]`, id: m.id });
  }
  return out;
}

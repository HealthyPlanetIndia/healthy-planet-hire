const token = () => localStorage.getItem("hph_token");
export const me = () => { try { return JSON.parse(localStorage.getItem("hph_user")); } catch { return null; } };
export function signOut() { localStorage.removeItem("hph_token"); localStorage.removeItem("hph_user"); location.href = "/login"; }

export async function api(path, { method = "GET", body, form } = {}) {
  const headers = {}; if (token()) headers.Authorization = `Bearer ${token()}`;
  if (body && !form) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api${path}`, { method, headers, body: form ? form : body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/auth") && !path.startsWith("/public")) signOut();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
export const daysSince = (iso) => Math.floor((Date.now() - new Date(iso.replace(" ", "T") + (iso.endsWith("Z") || iso.includes("+") ? "" : "Z")).getTime()) / 86400000);
export const STAGES = ["Applied", "Screened", "AI interview", "Screening call", "Shortlist", "Leadership interview", "Subject assessment", "Demo lesson", "Written assessment", "Final review", "HR discussion", "Offer", "Joined", "Talent pool", "Not now"];
export const BOARD = STAGES.slice(0, 13);
export const ROUNDS = ["Leadership interview", "Subject assessment", "Demo lesson"];
export const isManager = () => me()?.role === "manager";
export const isAdmin = () => me()?.role === "admin";
export const fmtDT = (iso) => new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

// Recruiter-side language. Candidate pages have their own strings.
const HI = { Home: "होम", Pipeline: "पाइपलाइन", Roles: "भूमिकाएँ", "Follow-ups": "फ़ॉलो-अप", "Talent pool": "टैलेंट पूल", Analytics: "विश्लेषण", Automation: "स्वचालन", Settings: "सेटिंग्स", "Sign out": "साइन आउट", "Add candidate": "उम्मीदवार जोड़ें", "Bulk import": "एक साथ जोड़ें", "All roles": "सभी भूमिकाएँ", candidates: "उम्मीदवार", "Nothing here yet": "अभी यहाँ कुछ नहीं", "Screen resume": "रिज़्यूमे जाँचें", "Re-screen": "फिर जाँचें", "Send AI interview": "AI साक्षात्कार भेजें", Report: "रिपोर्ट", Message: "संदेश", "Resume & notes": "रिज़्यूमे और नोट्स", History: "इतिहास", Checks: "दस्तावेज़ और जाँच", Offer: "ऑफ़र", Close: "बंद करें", Save: "सहेजें", "New role": "नई भूमिका", Applied: "आवेदन", Screened: "जाँचे गए", "AI interview": "AI साक्षात्कार", Shortlist: "शॉर्टलिस्ट", "Screening call": "स्क्रीनिंग कॉल", "Leadership interview": "नेतृत्व साक्षात्कार", "Subject assessment": "विषय मूल्यांकन", "Demo lesson": "डेमो पाठ", "Written assessment": "लिखित परीक्षा", "Final review": "अंतिम समीक्षा", "HR discussion": "HR चर्चा", Joined: "शामिल हुए", "Not now": "अभी नहीं", "Send on WhatsApp": "WhatsApp पर भेजें", "Send by email": "ईमेल से भेजें", Copy: "कॉपी", "Waiting": "प्रतीक्षा में", days: "दिन" };
export const lang = () => localStorage.getItem("hph_lang") || "en";
export const setLang = (l) => { localStorage.setItem("hph_lang", l); location.reload(); };
export const t = (s) => (lang() === "hi" && HI[s]) || s;

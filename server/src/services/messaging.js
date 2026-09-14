import { db, logEvent } from "../db.js";
import { waEnabled, sendWhatsApp, waLink } from "./whatsapp.js";
import { mailEnabled, sendEmail, mailLink } from "./email.js";
import { smsEnabled, sendSms } from "./sms.js";

export const DEFAULT_TEMPLATES = {
  Screened: "Hello {name}, thank you for applying for the {role} position at Healthy Planet School. We have reviewed your profile and would like to move you to the next step: a short structured interview you can complete on your phone. We will send the link shortly.",
  "AI interview": "Hello {name}, thank you for applying for {role} at Healthy Planet School. The first round is a recorded video interview with Maya, our AI interviewer: about 6 questions with follow-ups and a short role play, roughly 15 to 20 minutes. Please complete it before {deadline}.\n\nTo do it justice:\n1. Use a laptop or desktop if you can (a phone works if placed on a stable surface at eye level).\n2. A quiet, private, well-lit room, with the light in front of you.\n3. 20 uninterrupted minutes; no notes, no help.\n4. You get 10 seconds to think before each answer, you can ask Maya to repeat a question, and you may re-record one answer.\n\nYour link: {link}\n\nAll the best. Reply here if you have any difficulty.",
  Shortlist: "Hello {name}, good news. You have been shortlisted for {role} at Healthy Planet School and we would like to meet you at the campus. Which of these slots works for you? {slots}",
  "School interview": "Hello {name}, a reminder about your interview for {role} at Healthy Planet School on {slots}. Please bring your original certificates. Reply here if anything changes.",
  Offer: "Hello {name}, we are delighted to offer you the {role} position at Healthy Planet School. The formal offer letter follows by email. Please confirm your joining date so we can begin onboarding.",
  Joined: "Welcome to Healthy Planet School, {name}! Your first day is {join_date}. Please report to the front office at the {campus} campus at 8:15 am; the HR team will meet you there. Please carry: original ID proof, address proof, educational certificates, previous employment documents and 4 passport-size photographs.",
  "Talent pool": "Hello {name}, thank you for your interest in {role} at Healthy Planet School. We cannot proceed right now, but we would like to keep your profile for upcoming openings and will reach out when a suitable role comes up.",
  "Not now": "Hello {name}, thank you for taking the time to apply for {role} at Healthy Planet School. After careful consideration we will not be moving forward at this stage. We wish you the very best.",
  followup: "Hello {name}, just following up on my earlier message about {role} at Healthy Planet School. Do let me know if you are still interested and when we could speak.",
  followup_2: "Hello {name}, checking in once more about the {role} position at Healthy Planet School. If the timing is not right, no problem at all, just let us know and we will keep your profile for later.",
  followup_3: "Hello {name}, this is our last note about {role} at Healthy Planet School. We will keep your profile in our talent pool and reach out for future openings. Wishing you the very best.",
  needs_human: "Thanks {name}, one of our team will get back to you personally shortly.",
  "Written assessment": "Hello {name}, the next step for {role} at Healthy Planet School is a short written task (about 30 minutes) you can complete on any device: {link}\nPlease finish it before {deadline}.",
  "Screening call": "Hello {name}, congratulations on completing the first interview for {role} at Healthy Planet School. Our HR team would like a 10 to 15 minute call with you. Please reply with a good time this week.",
  appointment_letter: "Healthy Planet School\n{campus}\n\nRef: {ref_no}\n{date}\n\nDear {name},\n\nFurther to your acceptance of our offer, we are pleased to appoint you as {role} in the {department} team at Healthy Planet School, {campus}, with effect from {join_date}. You will report to {reporting_manager}.\n\nYour remuneration will be {salary}. Your appointment is governed by the school's HR Manual, code of conduct and child-safeguarding policy, copies of which you will receive at induction.\n\nWe look forward to welcoming you.\n\nWarm regards,\n\nExecutive Head\nHealthy Planet School",
  demo_lesson: "Hello {name}, we would like to invite you to teach a short demo lesson at Healthy Planet School for the {role} role. {slots}. Please plan a 20-minute lesson for the class you will be told about on arrival, and bring any materials you need.",
  offer_letter: "Healthy Planet School\n{campus}\n\nRef: {ref_no}\n{date}\n\nDear {name},\n\nWe are pleased to offer you the position of {role} in our {department} team at Healthy Planet School, {campus}, starting on {join_date}, reporting to {reporting_manager}.\n\nYour remuneration will be {salary}, as discussed. This offer is subject to verification of your original certificates, satisfactory references, police verification and your signed child-safeguarding declaration.\n\nWe were impressed by your thinking about children and classrooms, and we look forward to the difference you will make here. Please confirm your acceptance by replying to this email within seven days.\n\nWarm regards,\n\nDr. Arunabh Singh\nDirector, Healthy Planet School",
  interview_reminder: "Hello {name}, a gentle reminder that your first-round interview for {role} at Healthy Planet School is waiting for you: {link}",
};

export function getTemplates() {
  const t = { ...DEFAULT_TEMPLATES };
  for (const r of db.prepare("SELECT key, body FROM templates").all()) if (!r.key.startsWith("tts_")) t[r.key] = r.body;
  return t;
}
export function fill(tpl, cand, role, extra = {}) {
  const vars = { name: (cand.name || "").split(" ")[0], role: role?.title || "the role", campus: role?.campus || "Noida", link: "{link}", slots: "{slots}", deadline: "{deadline}", join_date: cand.join_date || "{join_date}", reporting_manager: role?.reporting_manager || "{reporting_manager}", ...extra };
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

// Sends through the API when configured; otherwise returns a link the recruiter opens manually.
export async function deliver(cand, channel, body, subject = "Healthy Planet School") {
  let status = "sent", external_id = null, link = null;
  if (channel === "whatsapp") {
    if (!cand.phone) throw new Error("Candidate has no phone number");
    if (waEnabled()) external_id = await sendWhatsApp(cand.phone, body); else { status = "manual"; link = waLink(cand.phone, body); }
  } else if (channel === "sms") {
    if (!cand.phone) throw new Error("Candidate has no phone number");
    if (smsEnabled()) external_id = await sendSms(cand.phone, body); else { status = "manual"; link = `sms:${cand.phone.replace(/\s/g, "")}?body=${encodeURIComponent(body)}`; }
  } else {
    if (!cand.email) throw new Error("Candidate has no email");
    if (mailEnabled()) external_id = await sendEmail(cand.email, subject, body); else { status = "manual"; link = mailLink(cand.email, subject, body); }
  }
  const r = db.prepare("INSERT INTO messages (candidate_id, direction, channel, body, status, external_id) VALUES (?,?,?,?,?,?)").run(cand.id, "out", channel, body, status, external_id);
  db.prepare("UPDATE candidates SET last_contact_at = datetime('now') WHERE id = ?").run(cand.id);
  logEvent(cand.id, "message_out", `${channel}: ${body.slice(0, 80)}`);
  return { id: r.lastInsertRowid, status, link };
}

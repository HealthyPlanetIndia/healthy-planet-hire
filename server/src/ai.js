import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";
let client = null;
export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;
function c() { if (!aiEnabled()) throw new Error("AI is not configured: set ANTHROPIC_API_KEY in server/.env"); return (client ||= new Anthropic()); }
const text = (r) => r.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
const parse = (t) => JSON.parse(t.replace(/```json|```/g, "").trim());

const SCHOOL = "Healthy Planet School, a K-12 school in Noida, India, which believes environments and relationships teach as much as curriculum.";

export async function screenResume(role, candidate) {
  const system = `You screen job applicants for ${SCHOOL} Judge only from the resume text given. Quote the resume exactly for evidence; if nothing supports a criterion, leave evidence empty. Be fair, concise and specific. Never infer protected characteristics. Respond with JSON only, no prose, no markdown:
{"overall": 0-100, "summary": "2 sentences", "recommendation": "shortlist | interview | hold | decline", "criteria": [{"id": "", "verdict": "meets | partial | does not meet", "evidence": "exact quote or empty", "note": "one line"}], "questions_to_probe": ["up to 3 short interview questions targeting gaps"], "flags": ["any inconsistencies or gaps in dates, or empty"]}`;
  const user = `Role: ${role.title} (${role.department || ""}, ${role.campus} campus)\nCriteria:\n${role.criteria.map((k) => `- id=${k.id} ${k.must ? "[must-have]" : "[nice-to-have]"} ${k.text}`).join("\n")}\n\nResume:\n${candidate.resume_text.slice(0, 20000)}`;
  const r = await c().messages.create({ model: MODEL, max_tokens: 1500, system, messages: [{ role: "user", content: user }] });
  return { ...parse(text(r)), at: new Date().toISOString() };
}

const LANG_NAMES = { en: "English", hi: "Hindi (Devanagari script)", pa: "Punjabi (Gurmukhi)", bn: "Bengali", mr: "Marathi", gu: "Gujarati", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam", ur: "Urdu" };
function roleBrief(role) {
  const bits = [`Role: ${role.title}`, role.grade && `Grade band: ${role.grade}`, role.subject && `Subject: ${role.subject}`, role.department && `Department: ${role.department}`, role.campus && `Campus: ${role.campus}`, role.brief && `About the role and the children: ${role.brief}`].filter(Boolean).join(". ");
  return `${bits}. Every example, follow-up and role-play detail you use must fit this grade band and subject exactly; never reach for early-years or secondary examples for a primary role, and vice versa. If the candidate gives an example from a different age group, do not treat it as a weakness; ask how they would adapt it to this grade band.`;
}
export function interviewSystem(role, candidate, language) {
  const qs = role.questions.map((q, i) => `${i + 1}. ${q.text}`).join(" ");
  const lang = `Conduct the interview in ${LANG_NAMES[language] || "English"}. If the candidate switches language, follow them. Technical education terms may stay in English.`;
  const interactive = role.interview_mode === "interactive" && role.scenario?.trim();
  const rolePlay = interactive ? ` This is an interactive interview. After question ${Math.min(2, role.questions.length)}, say you will now try a short role play, describe the situation in one or two sentences, and then play the other person in this scenario realistically for 3 to 4 exchanges: "${role.scenario.trim()}". Stay in character, react to what the candidate actually says, and escalate gently if they handle it poorly. Then step out of character, say the role play is over, and continue with the remaining questions.` : "";
  const turns = role.questions.length + 3 + (interactive ? 5 : 0);
  return `You are Maya, a warm and professional first-round interviewer for ${SCHOOL} You are interviewing ${candidate.name}. ${roleBrief(role)} Ask exactly these questions in order, one at a time, waiting for each answer: ${qs}${rolePlay} You may ask one brief follow-up when an answer is thin, but keep the whole interview under ${turns} of your turns. Keep each message to 2 or 3 sentences; this may be read aloud, so avoid lists and symbols. Never give feedback on answers, never reveal scores, never discuss salary. ${lang} After the final answer, thank them warmly and end your message with the exact token [END].`;
}

// Answers a candidate's WhatsApp question from the school's FAQ list and their own status. Returns null when unsure.
export async function answerFaq(faqs, candidate, role, question) {
  const system = `You are the recruiting assistant of ${SCHOOL} Answer the candidate's WhatsApp message briefly and warmly, in the language they wrote in, using ONLY the facts below. If the facts do not cover it, or the message needs a human (rescheduling, complaints, salary negotiation, anything personal), respond with exactly NEEDS_HUMAN. Never invent details. Do not reveal scores or internal notes. Respond with the reply text only.
Facts:
${faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n")}
Candidate: ${candidate.name}, applied for ${role?.title || "a role"} at the ${role?.campus || "Noida"} campus, currently at the "${candidate.stage}" stage${candidate.interview_at ? `, interview booked for ${new Date(candidate.interview_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}` : ""}.`;
  const r = await c().messages.create({ model: MODEL, max_tokens: 300, system, messages: [{ role: "user", content: question }] });
  const t = text(r).trim(); return t.includes("NEEDS_HUMAN") ? null : t;
}

export async function interviewTurn(role, candidate, language, transcript) {
  const messages = transcript.length ? transcript : [{ role: "user", content: "(The candidate has joined. Greet them by first name in one sentence and ask the first question.)" }];
  const r = await c().messages.create({ model: MODEL, max_tokens: 350, system: interviewSystem(role, candidate, language), messages });
  const t = text(r);
  return { content: t.replace("[END]", "").trim(), ended: t.includes("[END]") };
}

// First-round assessment. Principles agreed with the school:
//  - it reads a MACHINE TRANSCRIPT of spoken answers; transcription errors are the transcriber's, not the candidate's
//  - spoken English is never scored from text; it is assessed by people at the next stage
//  - each answer is judged only against what its question was designed to assess
//  - absence of evidence is not evidence of absence: untested competencies are "not assessed"
//  - a 15-minute interview supports cautious language and a list of things to verify at the demo lesson
export async function interviewReport(role, candidate, transcript, opts = {}) {
  const qs = role.questions;
  const answers = transcript.filter((m) => m.role === "user");
  const system = `You write first-round interview assessments for ${SCHOOL} ${roleBrief(role)}

You are reading a MACHINE TRANSCRIPT of spoken answers recorded on a phone or laptop. Odd words, missing words and broken grammar are almost always the transcriber's errors, not the candidate's. Never score grammar, vocabulary, fluency, pronunciation or "communication" from this text. Where a passage is garbled, read for the idea and say the transcription was unclear. Each answer carries a transcription confidence; treat anything below 70% as unreliable.

Each scripted question was designed to assess one competency, given below. Judge an answer ONLY against its own competency. Do not look for evidence of anything the questions did not ask about; if a competency on the role's list was not the target of any question, report it as "not assessed". Absence of evidence is not evidence of absence.

This is a short interview. Prefer "limited evidence in this interview" to strong conclusions. Where the candidate gave an example from a different age group, that is not a weakness; note it and suggest the panel ask how they would adapt it.

Respond with JSON only:
{"overall": 0-100, "band": "Strong | Promising | Borderline | Not now", "summary": "2 to 3 cautious sentences about what the interview did and did not show",
 "per_question": [{"index": 0, "assesses": "", "verdict": "demonstrated | weakness | not_assessed | unreliable", "evidence": "short quote or close paraphrase", "note": "one line"}],
 "competencies": [{"name": "", "verdict": "demonstrated | weakness | not_assessed", "note": "one line, or 'Not assessed in this interview'"}],
 "role_play": {"verdict": "demonstrated | weakness | not_assessed", "note": ""},
 "strengths": "", "concerns": "", "transcription_issues": "where the transcript was unclear, or 'none'",
 "recommendation": "Invite to panel rounds | Invite with points to probe | Do not invite",
 "verify_next_stage": ["3 to 5 specific things the demo lesson and panel should check, including spoken English"]}
Scoring: overall reflects only the competencies that were assessed, with each assessed competency weighted equally; not_assessed and unreliable items are excluded from the number. Band: Strong 75+, Promising 60 to 74, Borderline 45 to 59, Not now below 45. Be generous at the margin: this stage exists to shortlist for humans, and a wrongly excluded good teacher costs the school more than a wrongly included one.`;
  const lines = [];
  let qi = 0;
  for (const m of transcript) {
    if (m.role === "assistant") { lines.push(`Interviewer: ${m.content}`); continue; }
    const conf = opts.confidence?.[qi] ?? m.meta?.confidence ?? null;
    const scripted = qs[qi];
    lines.push(`${candidate.name} (answer ${qi + 1}${scripted ? `, question assesses: ${scripted.assesses}` : ", follow-up or role play"}${conf != null ? `, transcription confidence ${Math.round(conf * 100)}%` : ""}${m.meta?.retake ? ", RE-TAKE: candidate re-recorded this answer" : ""}): ${m.content}${m.meta?.candidate_note ? ` [Candidate's note on the transcription: ${m.meta.candidate_note}]` : ""}`);
    qi++;
  }
  const comps = [...new Set(qs.map((q) => q.assesses))];
  const untested = role.criteria.map((k) => k.text).filter((t) => !comps.some((cName) => t.toLowerCase().includes(cName.toLowerCase().split(" ")[0])));
  const user = `Scripted questions and what each assesses:\n${qs.map((q, i) => `${i + 1}. [${q.assesses}] ${q.text}`).join("\n")}\n\nCompetencies assessed by this interview: ${comps.join("; ")}\nRole criteria NOT targeted by any question (report as not assessed): ${untested.join("; ") || "none"}\n${role.interview_mode === "interactive" && role.scenario ? `Role play scenario: ${role.scenario}\n` : ""}\nTranscript:\n${lines.join("\n")}`;
  const r = await c().messages.create({ model: MODEL, max_tokens: 1800, system, messages: [{ role: "user", content: user }] });
  return { ...parse(text(r)), at: new Date().toISOString(), version: 2 };
}

// Looks at the answers themselves for signs of outside help: register shifts, generic AI-style prose,
// content that contradicts the resume, or knowledge the candidate could not plausibly hold.
export async function analyseAnswers(role, candidate, transcript) {
  const answers = transcript.filter((m) => m.role === "user").map((m, i) => `A${i + 1} (${m.meta ? `${m.meta.seconds}s, ${m.content.length} chars` : "no timing"}): ${m.content}`).join("\n\n");
  const system = `You review interview answers for signs the candidate had outside help (another person, or a chatbot) during a first-round text interview for ${SCHOOL} Be careful and fair: many good candidates write well, and Indian English varies widely. Flag only concrete patterns: an abrupt change in vocabulary or grammar quality between answers; polished generic prose with no first-person specifics, especially after weaker answers; claims that contradict the resume; markdown or list formatting typical of chatbots; near-identical phrasing to well-known model outputs; timing that does not fit the length or quality of the text. Respond with JSON only: {"summary": "1 sentence", "reasons": [{"level": "low | medium | high", "text": "specific, cites the answer number"}]}. If nothing stands out, return an empty reasons list.`;
  const r = await c().messages.create({ model: MODEL, max_tokens: 700, system, messages: [{ role: "user", content: `Role: ${role.title}\nResume:\n${(candidate.resume_text || "").slice(0, 4000)}\n\nAnswers:\n${answers}` }] });
  return parse(text(r));
}

export async function gradeWriting(role, candidate, prompt, essay) {
  const system = `You assess a written English task for teaching and school staff at ${SCHOOL} Indian English conventions are correct English; do not penalise them. Judge only the text. Respond with JSON only: {"overall": 0-100, "summary": "2 sentences", "dimensions": [{"name": "Grammar and accuracy", "score": 0-100, "note": ""}, {"name": "Clarity and structure", "score": 0-100, "note": ""}, {"name": "Tone for parents and colleagues", "score": 0-100, "note": ""}, {"name": "Completeness against the task", "score": 0-100, "note": ""}], "strengths": "", "concerns": "", "recommendation": "Meets the standard | Borderline | Below the standard", "word_count": 0}`;
  const r = await c().messages.create({ model: MODEL, max_tokens: 900, system, messages: [{ role: "user", content: `Role: ${role.title}\nTask given:\n${prompt}\n\nCandidate's text:\n${essay}` }] });
  return { ...parse(text(r)), at: new Date().toISOString() };
}

export async function consolidatedSummary(role, candidate, material) {
  const system = `You prepare the Final Review note for the Director of ${SCHOOL} Consolidate the evidence from every round into a fair, concise recommendation. Note disagreements between panelists and any gaps. Do not invent scores. Plain prose, no lists, no dashes as punctuation, under 220 words, ending with one sentence that begins "Recommendation:".`;
  const r = await c().messages.create({ model: MODEL, max_tokens: 600, system, messages: [{ role: "user", content: `Candidate: ${candidate.name} for ${role.title}\n\n${material}` }] });
  return text(r).trim();
}

export async function draftJobDescription(role) {
  const r = await c().messages.create({ model: MODEL, max_tokens: 900, system: `You write concise, warm job postings for ${SCHOOL} Plain language, no buzzwords, no dashes as punctuation. Sections: About the role, What you will do, What we look for, How to apply. Under 300 words.`, messages: [{ role: "user", content: `Role: ${role.title} (${role.department}, ${role.campus}). Criteria: ${role.criteria.map((k) => `${k.text}${k.must ? " (required)" : ""}`).join("; ")}` }] });
  return text(r);
}

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";
let client = null;
export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;
function c() { if (!aiEnabled()) throw new Error("AI is not configured: set ANTHROPIC_API_KEY in server/.env"); return (client ||= new Anthropic()); }
// House style: no em or en dashes anywhere the school's name appears. The prompts say so; this is the safety net.
export const noDashes = (t) => String(t).replace(/\s*—\s*/g, ", ").replace(/(\d)\s*–\s*(\d)/g, "$1 to $2").replace(/\s*–\s*/g, ", ");
const text = (r) => noDashes(r.content.filter((b) => b.type === "text").map((b) => b.text).join("\n"));
// Tolerant JSON extraction: strips fences and any prose before the first { or after the last }
const parse = (t) => { const c = t.replace(/```json|```/g, ""); const a = c.indexOf("{"), b = c.lastIndexOf("}"); if (a < 0 || b < a) throw new Error("The assessment was not valid JSON"); return JSON.parse(c.slice(a, b + 1)); };

const SCHOOL = "Healthy Planet School, a K-12 school in Noida, India, which believes environments and relationships teach as much as curriculum." + " " + "House style: never use em dashes or en dashes (— or –) anywhere, including inside JSON strings; use commas, full stops, colons, or the word 'to' for ranges.";

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
export function scenarioBrief(sc) {
  if (!sc) return "";
  if (sc.type === "situation") return ` After question 2, say you will now describe a classroom situation and ask what they would do. Describe it in two or three plain sentences: "${sc.setup}" Ask what they would do and why. After their answer, add this development in one sentence and ask how it changes things: "${sc.twist}" That is the whole scenario: two exchanges. Then continue with the remaining questions. Do not tell them what you were looking for.`;
  return ` After question 2, say you will now try a short role play, describe only the setting in one sentence, and then play this person for exactly 3 exchanges (your opening, one reply, one closing reaction): ${sc.persona}. What the person says at first, and keeps saying if the candidate only explains or reassures: "${sc.surface}" What is really going on, which you reveal ONLY if the candidate listens, asks open questions about what the child says at home, when it started, or what worries the parent most: "${sc.underlying || "nothing further; the surface concern is the whole story"}" Stay in character; react to what the candidate actually says; become slightly more upset if they are defensive, dismissive or jump to solutions; soften if they genuinely listen. Then step out of character, say the role play is over, and continue with the remaining questions. Never explain what you were looking for.`;
}
export function interviewSystem(role, candidate, language, drawn = null) {
  const questions = drawn?.questions?.length ? drawn.questions : role.questions;
  const scenario = drawn ? drawn.scenario : null;
  const qs = questions.map((q, i) => `${i + 1}. ${q.text}`).join(" ");
  const lang = `Conduct the interview in ${LANG_NAMES[language] || "English"}. If the candidate switches language, follow them. Technical education terms may stay in English.`;
  const interactive = !!scenario;
  const rolePlay = scenarioBrief(scenario);
  const turns = questions.length + 2 + (interactive ? 3 : 0);
  return `You are Maya, a warm and professional first-round interviewer for ${SCHOOL} You are interviewing ${candidate.name}. ${roleBrief(role)} This is a short first screen; the whole interview must finish inside 15 minutes, so keep your own turns to one or two sentences and move briskly. Ask exactly these questions in order, one at a time, waiting for each answer: ${qs}${rolePlay} You may ask ONE brief follow-up in the entire interview, only if an answer is empty; otherwise move on. Keep the whole interview under ${turns} of your turns. Keep each message to 2 or 3 sentences; this may be read aloud, so avoid lists and symbols. Never give feedback on answers, never reveal scores, never discuss salary. The candidate's answers reach you as machine transcripts of speech: if an answer seems to stop abruptly or mid-sentence, assume the candidate finished and move on; never say they were cut off, never ask them to continue, repeat or re-record an answer, and never comment on the wording of the transcript. ${lang} After the final answer, thank them warmly and end your message with the exact token [END].`;
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

export async function interviewTurn(role, candidate, language, transcript, drawn = null) {
  const messages = transcript.length ? transcript : [{ role: "user", content: "(The candidate has joined. Greet them by first name in one sentence and ask the first question.)" }];
  const r = await c().messages.create({ model: MODEL, max_tokens: 350, system: interviewSystem(role, candidate, language, drawn), messages });
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
  const qs = opts.questions?.length ? opts.questions : role.questions;
  const sc = opts.scenario || null;
  const answers = transcript.filter((m) => m.role === "user");
  const system = `You write first-round interview assessments for ${SCHOOL} ${roleBrief(role)}

You are reading a MACHINE TRANSCRIPT of spoken answers recorded on a phone or laptop. Odd words, missing words and broken grammar are almost always the transcriber's errors, not the candidate's. An answer that ends abruptly or mid-sentence is a transcription artefact: the candidate pressed Done after finishing. Never describe answers as "cut off", "truncated" or "incomplete", never list that as a concern, and never let it lower a verdict; judge the ideas that are present. Never score grammar, vocabulary, fluency, pronunciation or "communication" from this text. Where a passage is garbled, read for the idea and say the transcription was unclear. Each answer carries a transcription confidence; treat anything below 70% as unreliable.

Each scripted question was designed to assess one competency, given below. Judge an answer ONLY against its own competency. Do not look for evidence of anything the questions did not ask about; if a competency on the role's list was not the target of any question, report it as "not assessed". Absence of evidence is not evidence of absence.

This is a short interview. Prefer "limited evidence in this interview" to strong conclusions. Where the candidate gave an example from a different age group, that is not a weakness; note it and suggest the panel ask how they would adapt it.

Respond with JSON only:
{"overall": 0-100, "band": "Strong | Promising | Borderline | Not now", "summary": "2 to 3 cautious sentences about what the interview did and did not show",
 "per_question": [{"index": 0, "assesses": "", "verdict": "demonstrated | weakness | not_assessed | unreliable", "evidence": "short quote or close paraphrase", "note": "one line"}],
 "competencies": [{"name": "", "verdict": "demonstrated | weakness | not_assessed", "note": "one line, or 'Not assessed in this interview'"}],
 "role_play": {"verdict": "demonstrated | weakness | not_assessed", "note": "for a role play: did they listen and probe, and did the underlying issue surface? for a situation: how did they handle the twist?"},
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
  const scText = sc ? (sc.type === "situation" ? `Classroom situation given (assesses ${sc.assesses}): ${sc.setup} Twist: ${sc.twist}\nWhat the panel wanted to see: ${sc.observe}` : `Role play (assesses ${sc.assesses}): Maya played ${sc.persona}. Surface concern: ${sc.surface} Underlying issue, revealed only if the candidate probed: ${sc.underlying || "none"}\nWhat the panel wanted to see: ${sc.observe}\nJudge especially whether the candidate listened and asked questions that could uncover the underlying issue, or only explained and reassured.`) : "";
  const user = `Scripted questions and what each assesses:\n${qs.map((q, i) => `${i + 1}. [${q.assesses}] ${q.text}`).join("\n")}\n\nCompetencies assessed by this interview: ${[...comps, ...(sc ? [sc.assesses] : [])].join("; ")}\nRole criteria NOT targeted by any question (report as not assessed): ${untested.join("; ") || "none"}\n${scText}\n\nTranscript:\n${lines.join("\n")}`;
  const r = await c().messages.create({ model: MODEL, max_tokens: 6000, system, messages: [{ role: "user", content: user }] });
  if (r.stop_reason === "max_tokens") throw new Error("Assessment was cut off; interview too long for one pass");
  return { ...parse(text(r)), at: new Date().toISOString(), version: 2 };
}

// Looks at the answers themselves for signs of outside help: register shifts, generic AI-style prose,
// content that contradicts the resume, or knowledge the candidate could not plausibly hold.
export async function analyseAnswers(role, candidate, transcript, spoken = false) {
  const answers = transcript.filter((m) => m.role === "user").map((m, i) => `A${i + 1} (${m.meta ? `${m.meta.seconds}s${spoken ? "" : `, ${m.content.length} chars`}` : "no timing"}${m.meta?.transcribed ? ", server transcription with punctuation" : spoken ? ", phone transcription without punctuation" : ""}): ${m.content}`).join("\n\n");
  const system = spoken
    ? `You review MACHINE TRANSCRIPTS of spoken video answers from a first-round interview for ${SCHOOL} The candidate spoke to a camera; the recording is the real evidence and recruiters can watch it. Some answers were transcribed by a server with punctuation and complete sentences, others by the phone without punctuation: differences in polish, punctuation, register or fragmentation between answers come from the transcriber, never from the candidate, and must not be flagged. Timing, characters per second and "typing rate" mean nothing for speech; never reason about them. The only things worth noting are substantive: content that contradicts the resume, an answer that reads like a memorised script recited word for word (for example a list of textbook headings with no first-person detail), or a factual claim that cannot be true. Even then the strongest level you may give is "low", phrased as "worth watching clip An". Respond with JSON only: {"summary": "1 sentence", "reasons": [{"level": "low", "text": "specific, cites the answer number"}]}. Return an empty reasons list unless something substantive stands out.`
    : `You review interview answers for signs the candidate had outside help (another person, or a chatbot) during a first-round typed interview for ${SCHOOL} Be careful and fair: many good candidates write well, and Indian English varies widely. Flag only concrete patterns: an abrupt change in vocabulary or grammar quality between answers; polished generic prose with no first-person specifics, especially after weaker answers; claims that contradict the resume; markdown or list formatting typical of chatbots; near-identical phrasing to well-known model outputs; timing that does not fit the length or quality of the text. Respond with JSON only: {"summary": "1 sentence", "reasons": [{"level": "low | medium | high", "text": "specific, cites the answer number"}]}. If nothing stands out, return an empty reasons list.`;
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

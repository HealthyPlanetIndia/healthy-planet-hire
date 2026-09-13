# Healthy Planet Hire

Recruiting software for Healthy Planet School. Turns applications into decision-ready shortlists:
structured roles, AI resume screening with cited evidence, a pipeline board, AI first-round
interviews candidates complete on their own phone, WhatsApp and email outreach, automated
follow-up nudges, and a searchable talent pool.

## What's inside

- `server/` Node 20 + Express API, SQLite database (file-based, zero setup), Anthropic Claude for
  screening and interviews, WhatsApp Business Cloud API, SMTP email, PDF/DOCX resume parsing,
  JWT logins, nightly follow-up job.
- `web/` React (Vite) app for the recruiting team plus a public candidate interview page.

## Not a developer? Read SETUP-GUIDE.md

One-click hosting: `https://render.com/deploy?repo=<this repository's GitHub URL>`. Then the **Setup**
page inside the app tests every connection and registers the WhatsApp webhook for you.

It walks through hosting this yourself on Railway with no command line: about two hours, ~$5/month.

## For developers

```bash
cp .env.example server/.env        # ANTHROPIC_API_KEY, PUBLIC_URL
cd web && npm install && npm run build     # builds the web app into web/dist
cd ../server && npm install && npm start   # serves API and web app on :4000
```

The database, admin user (from ADMIN_EMAIL / ADMIN_PASSWORD, defaults in seed.js) and sample data are
created on first start. JWT_SECRET is generated and stored in the data folder if not set.
`docker compose up -d` does the same in one container with data in `server/data`.
For local development run `npm run dev` in both folders (web on :5173 proxies /api to :4000).

## The HR process, as written, enforced by the software

The pipeline follows the school's Recruitment and Selection process document step for step:

Applied → Screened → AI interview → Screening call → Shortlist → Leadership interview → Subject
assessment → Demo lesson → Written assessment → Final review → HR discussion → Offer → Joined

- **Step 1 Manpower requisition.** Principals and hiring managers raise it (role, grade, subject,
  openings, justification, reporting manager). It stays "requested" and invisible to the public until
  the Director approves. The home screen shows the Director what is waiting.
- **Step 2 Sourcing.** Internal job posting first: set a date and the role is hidden from the careers
  page and job feeds until then. Referrals cannot be saved without the referrer's name.
- **Step 3 CV screening.** AI screening against the criteria, plus location/distance captured on the
  application form. After the AI interview, HR records the 10 to 15 minute **screening call**
  (fit, interest, notice period, expected salary); "Proceed" moves the candidate to Shortlist.
- **Step 4 Rounds.** Three panel rounds, each with its own rubric and scoring links: Leadership
  interview (Principal), Subject assessment and Demo lesson (Department Coordinator). Round 4 is a timed
  **written English assessment** the candidate completes online, graded by AI and reviewable. Round 5
  **Final review** consolidates every round into one note for the Director; nobody can move to HR
  discussion or Offer without the Director's recorded approval. Round 6 **HR discussion** captures the
  agreed remuneration, joining date and policy clarifications, which flow into the letters.
- **Step 5 Background verification.** Identity, address, credentials, employment history, police
  verification, POCSO declaration and two references, each with an owner and a file. Offers are blocked
  until verified, or can be explicitly marked conditional on verification (logged).
- **Step 6 Offer and documentation.** Offer and appointment letters are drafted from templates with an
  automatic reference number (HPS/HR/OFR/2026/0001), approved by the Executive Head, then issued by
  email or printed; every letter appears in the issuance tracker.
- **Onboarding.** The checklist is split into Pre-boarding, Day 1 induction and Week 1 role
  orientation, each item owned by HR, IT/Admin or the Reporting Manager. Marking a candidate Joined
  emails IT/Admin the workstation, email, biometric and ID card request (`ONBOARDING_NOTIFY_EMAIL`).

Attendance, grievances and letters for existing staff are HR-system functions outside recruiting.

## Automation, assistant and channels

- **Rules** (Settings → Automation): "when a resume scores 70+, send the AI interview", "when moved to
  Offer, send the offer message", "when an interview report shows high integrity risk, hold for review".
  Six sensible rules ship switched off except the integrity hold; every run is logged on the candidate.
- **Follow-up sequences**: three steps (day 3, 6, 10 by default), stopping the moment the candidate
  replies or moves stage.
- **WhatsApp assistant**: candidate replies are answered from an editable FAQ list plus their own status
  (stage, booked time). Anything outside the facts, or anything personal, is handed to a person and
  appears in the Automation inbox with a red badge in the nav.
- **Channels**: WhatsApp, email and SMS (MSG91 or Twilio). Without a gateway each send opens in your
  own app and is still logged.
- **Voice interviews**: on the candidate's phone, "Talk instead of type" makes Maya speak her questions
  and transcribes the candidate's spoken answers (browser speech APIs; Chrome and Safari on mobile).
  The transcript, report and integrity checks are identical to typed interviews.
- **Interactive interviews**: set a role to Interactive and describe a scenario; Maya plays the other
  person (an upset parent, a disruptive student) for a few exchanges and the report scores the handling.
- **Eleven languages** for the AI interview: English, Hindi, Punjabi, Bengali, Marathi, Gujarati,
  Tamil, Telugu, Kannada, Malayalam, Urdu.
- **Shareable reports**: every candidate has a read-only report link (screening, interview, panel
  scores) for board members or external panelists. Rotate it to revoke.
- **Campus workspaces**: recruiters can be limited to a campus (Noida, Suncity); roles and candidates
  are filtered, the talent pool stays shared.
- **API keys** (Settings → Integrations) for the website, ERP or ARISE tools; endpoint list at
  `/api/docs`.
- **Screening queue**: bulk imports screen in the background, three at a time, with live progress on the
  pipeline.

## The hiring workflow for a school

Applied → Screened → AI interview → Shortlist → Demo lesson → School interview → Offer → Joined

- **Bulk import**: drop dozens of CVs (PDF/Word) or a CSV; names are read from the files. Duplicates by
  phone, email or similar name are flagged, including people who applied to another campus before.
- **Demo lesson and interview panels**: create a scoring link per panelist; they score the role's rubric
  (1 to 5 per item) from their phone, no login. Scores roll up on the candidate with per-item averages.
- **Self-booking**: add interview slots on a role, send the candidate a booking link, they pick a time;
  confirmation goes out automatically and you get a Google Calendar link or .ics file.
- **Document and child-safety gate**: a checklist per candidate (certificates, ID, CTET, police
  verification, POCSO declaration, references, then onboarding items). Nobody can be moved to Offer
  or Joined until every required document and safety check is verified. Admins can override and the
  override is logged.
- **Offer letters**: generated from an editable template with salary, joining date and role, sent by
  email or printed to PDF. Onboarding checklist takes over after acceptance.
- **Hiring managers**: a user role that sees only shortlisted candidates for roles assigned to them,
  can score and add notes, cannot move the pipeline or see messages.
- **Video interviews** (optional, Daily.co): recorded rooms with transcription; the report generator
  runs on the transcript when Daily's webhook delivers it.
- **Sourcing**: `/apply` is a public application page for the school website (link or iframe), and
  `/api/public/jobs.xml` is an Indeed/Google-for-Jobs compatible feed of open roles. Naukri and
  LinkedIn have no open API for pulling applicants; export from them and use bulk import.
- **Analytics**: funnel per role, source effectiveness, time to offer, drop-off by stage, monthly
  volume, integrity outcomes, panel score averages.
- **Hindi**: recruiter-side labels switch with the हिं/EN button; candidate pages are bilingual.

## The AI interview is a video interview

Candidates open the link on a phone or laptop; camera and microphone are required. Maya asks each
question aloud (browser speech synthesis in the candidate's chosen language), the candidate presses
Answer and speaks to the camera, and each answer is recorded in the browser and uploaded to the
server, where it is encrypted with AES-256-GCM before it touches the disk. Spoken words are transcribed
in the browser (speech recognition; Chrome and Safari on phones) so the written report, integrity
analysis and role play all work exactly as before. If transcription fails on a device the candidate can
type alongside the recording. Recruiters watch clips beside the transcript through 30-minute signed
links; every opening is logged. Clips are deleted after `SNAPSHOT_DAYS` (default 90) and on erasure.
Roughly 40 to 60 MB per interview; size the disk accordingly.

**Better transcription (recommended):** set `DEEPGRAM_API_KEY` and each recorded answer is
transcribed on the server (Nova-3, `language=multi`) which handles Indian English and Hindi-English
code-switching far better than the phone. It runs in the background right after each answer, replaces
the phone's text in the transcript before the report is written, and shows a confidence score and
"what the phone heard" beside each clip. Recruiters can re-transcribe an interview and refresh the report
with one button. The candidate sees the transcription of each answer as soon as it is ready and can
attach a short note if it misheard them; the note never replaces the transcript (the video is the
record) but is shown to recruiters and to the report writer. About ₹1 to ₹1.5 per minute of audio, so ₹15 to ₹25 per interview. Set `ALLOW_TEXT_INTERVIEWS=true` to let
candidates without a camera fall back to typing, or send a typed link deliberately from the profile.

## Video recordings (Daily.co rooms)

Recordings never touch this server. They stay in Daily.co's private cloud storage (encrypted at rest);
we store only the recording id. When a signed-in recruiter or the assigned hiring manager presses
Watch, the server mints a viewing link valid for 15 minutes, and the view is written to the audit log
and the candidate's history. Recordings and transcripts are deleted at Daily after `SNAPSHOT_DAYS`
(default 90) and immediately when a candidate is erased or anonymised; the written report remains.
Rooms are private per candidate, expire with the link, block screenshare, and eject everyone at expiry.
Point Daily's webhook (recording and transcript events) at `/api/public/webhooks/daily`.

## Data protection and security

Built for the DPDP Act 2023: privacy notice on apply and interview pages; export everything held about
a person as JSON; "Erase everything" purges files, messages, transcripts and photos; camera photos
auto-delete after 90 days; "Not now" candidates are anonymised after 12 months; nightly backups.
Rate limiting on public and sign-in endpoints, security headers, password reset by email, and an
audit log of every change (who, what, when) visible to admins.

## Tests

`cd server && npm test` runs the API test suite against a throwaway database: auth, roles and slots,
duplicate detection, the checks gate and admin override, self-booking, panel scoring, hiring-manager
scoping, export/purge, analytics, audit, rate limits, automation rules, share links, API keys, FAQ
hand-off, campus scoping, screening queue, SMS fallback. No API keys needed.

## Scaling beyond one school

SQLite handles one school comfortably (thousands of candidates, a few dozen staff). If ARISE member
schools ever share this, move to Postgres: the queries are plain SQL and `db.js` is the only file that
opens the database.

## Interview integrity (detecting outside help)

Every AI interview is monitored unless you turn it off per link (`proctor: false`). Candidates are told
before they start and tick a consent box. During the interview the app records:

- leaving the screen (tab switch, app switch, lost focus) and how often
- text pasted into answers (and its length)
- answer timing versus length, to catch text arriving faster than anyone types
- whether the link was opened from more than one device or browser
- optional camera frames every 75 seconds (candidate grants permission), plus a face count on browsers
  that support face detection, so a second person in frame is flagged

After the interview, Claude also reads the answers for signs of a helper or chatbot: abrupt shifts in
writing quality, generic polished prose with no first-person detail, chatbot-style formatting, and
claims that contradict the resume.

Everything rolls up into one verdict (clear, low, medium, medium-high, high) with the specific reasons
listed. High-risk candidates get a red flag on the pipeline card and an `integrity_alert` in their
history. These are signals, not proof: the recruiter reviews and decides, and the app says so on screen.

## Integrations

| Feature | Needs | Without it |
|---|---|---|
| AI screening + interviews | `ANTHROPIC_API_KEY` | Disabled |
| Video interviews | `DAILY_API_KEY` + webhook | Text and voice interviews only |
| SMS | MSG91 or Twilio keys | Opens your SMS app |
| Server transcription | `DEEPGRAM_API_KEY` | Phone's own speech recognition |
| WhatsApp sending + replies | Meta Business account, Cloud API token, phone number ID, webhook URL | Falls back to wa.me "open chat" links |
| Email | Any SMTP (Google Workspace, Zoho, Resend) | Falls back to mailto links |
| Interview links | `PUBLIC_URL` set to your domain | Links point to localhost |

WhatsApp webhook: point Meta to `https://yourdomain/api/webhooks/whatsapp` with the verify token
from `.env`. Candidate replies land on their profile and reset the follow-up timer.

## Data model

roles → candidates (one per application) → screenings, interviews (token, transcript, report),
messages (outbound + inbound), users. All in `server/data/hph.db`. Back it up like any file.

## Still on the list

Google Calendar two-way sync (today: one-click add and .ics), IMAP parsing of email applications,
and an ARISE-wide shared talent pool. Voice mode depends on the candidate's browser; where speech
recognition is missing the page falls back to typing automatically.

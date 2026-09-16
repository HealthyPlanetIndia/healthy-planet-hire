import "dotenv/config";
import { db } from "./db.js";
import { createUser } from "./auth.js";

export async function ensureSeed() {
if (!db.prepare("SELECT 1 FROM users LIMIT 1").get()) {
  const email = process.env.ADMIN_EMAIL || "arunabh@healthyplanetschool.com", password = process.env.ADMIN_PASSWORD || "changeme";
  await createUser({ name: process.env.ADMIN_NAME || "Arunabh Singh", email, password, role: "admin" });
  console.log(`Admin user created: ${email}`);
}
if (!db.prepare("SELECT 1 FROM roles LIMIT 1").get()) {
  const ins = db.prepare("INSERT INTO roles (title, department, campus, openings, criteria, questions) VALUES (?,?,?,?,?,?)");
  const r1 = ins.run("Primary Teacher (Grades 3 to 5)", "Primary", "Noida", 2, JSON.stringify([
    { id: "c1", text: "B.Ed or equivalent teaching qualification", must: true },
    { id: "c2", text: "3+ years teaching in a primary classroom", must: true },
    { id: "c3", text: "Fluent spoken and written English", must: true },
    { id: "c4", text: "Experience with inquiry or project-based learning", must: false },
    { id: "c5", text: "Comfortable using digital tools in class", must: false }]),
    JSON.stringify([
      { text: "Tell me about a lesson that did not go as planned. What did you do?", assesses: "Reflection and growth" }, { text: "What do you enjoy most about teaching, and what do you find hardest?", assesses: "Reflection and growth" },
      { text: "How do you help a shy child take part in class?", assesses: "Child-centred practice" }, { text: "What do you do when a child gives a wrong answer in front of the class?", assesses: "Child-centred practice" },
      { text: "What do you do when the class becomes noisy or restless?", assesses: "Classroom management" }, { text: "How do you make sure children are listening when you are speaking?", assesses: "Classroom management" },
      { text: "How do you build a good relationship with the parents of your class?", assesses: "Handling parents" }, { text: "Tell me about a time a parent was unhappy, and what you did.", assesses: "Handling parents" },
      { text: "What does a good classroom feel like to you?", assesses: "School values" }, { text: "Why do you want to work at Healthy Planet School?", assesses: "School values" },
    ]));
  db.prepare("UPDATE roles SET scenarios=? WHERE id=?").run(JSON.stringify([]), r1.lastInsertRowid); // filled below from the defaults
  db.prepare("UPDATE roles SET grade='Grades 3 to 5', subject='General (Primary)', justification='Two sections added in Grade 4 for 2026-27', reporting_manager='Primary Coordinator', brief='Children aged 8 to 11 in Grades 3, 4 and 5; class teacher for all subjects except Hindi and specialist subjects; CBSE-aligned; classes of about 28; project work and outdoor learning are part of the timetable' WHERE id=?").run(r1.lastInsertRowid);
  const { DEFAULT_SCENARIOS } = await import("./db.js");
  db.prepare("UPDATE roles SET interview_mode='interactive', scenarios=? WHERE id=?").run(JSON.stringify(DEFAULT_SCENARIOS), r1.lastInsertRowid);
  const faq = db.prepare("INSERT INTO faqs (question, answer) VALUES (?,?)");
  faq.run("Where is the school?", "Healthy Planet School is in Noida, Uttar Pradesh. The exact address and a map link are in your interview confirmation message.");
  faq.run("What documents should I bring to the interview?", "Please bring original degree certificates and marksheets, your B.Ed or professional qualification, a photo ID (Aadhaar or passport), and your last relieving letter if you have one.");
  faq.run("How long does the AI interview take?", "About 15 minutes. You can do it on your phone, at any time before the deadline in your message, and you can choose to type or speak.");
  faq.run("When will I hear back?", "We aim to update every candidate within 5 working days of each step. If you have not heard from us in that time, reply here and a team member will check.");
  faq.run("What are the school timings for staff?", "Teaching staff are on campus from 7:45 am to 3:15 pm, Monday to Friday, with occasional Saturday events.");
  ins.run("Basketball Coach", "Sports", "Noida", 1, JSON.stringify([
    { id: "c6", text: "Played or coached at state level or above", must: true },
    { id: "c7", text: "Experience coaching children aged 8 to 16", must: true },
    { id: "c8", text: "First aid certification", must: false }]),
    JSON.stringify(["How do you plan a season for a mixed-ability under-14 team?", "A parent thinks their child deserves more court time. What do you say?", "Describe your warm-up routine and why."]));
  db.prepare("INSERT INTO candidates (role_id, name, phone, email, source, resume_text) VALUES (?,?,?,?,?,?)").run(r1.lastInsertRowid, "Priya Sharma", "+91 98100 00000", "priya@example.com", "Job portal",
    "Priya Sharma, Noida. B.Ed (CCS University, 2018), B.A. English (DU). Primary teacher at Sunrise Public School, Ghaziabad, 2019 to present: Grade 4 class teacher, led a year-long 'Our Neighbourhood' project where students mapped local water sources and presented to the RWA. Trained in Google Classroom and used Padlet for reflection journals. Conducted parent workshops on reading at home. Languages: English, Hindi.");
  console.log("Sample roles and candidate created");
}
}
if (process.argv[1]?.endsWith("seed.js")) { await ensureSeed(); console.log("Seed complete"); }

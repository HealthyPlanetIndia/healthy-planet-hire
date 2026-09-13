# Healthy Planet Hire: setting it up yourself

You do not need to know Node, Docker or any programming. You will use three websites and fill in
a few forms. Budget about two hours the first evening, then a few days of waiting on Meta for
WhatsApp. Cost: roughly ₹450 a month for hosting plus AI usage (₹5 to ₹15 per candidate).

Do the steps in order. Each one tells you what you should see when it worked.

---

## Step 1. Get your AI key (15 minutes)

1. Go to **console.anthropic.com** and create an account with your school email.
2. Click **Billing** in the left menu and add a card. Put ₹2,000 (about $25) of credit on it; that
   covers a few hundred candidates.
3. Click **API Keys**, then **Create Key**. Name it "Healthy Planet Hire". Copy the key (it starts
   with `sk-ant-`) into a note on your phone or computer. You will not be able to see it again.

**You should have:** one key starting `sk-ant-`.

## Step 2. Put the files on GitHub (20 minutes)

GitHub is where the hosting service will read the software from. Free.

1. Go to **github.com**, click **Sign up**, use your school email, and verify it.
2. On your computer, unzip `healthy-planet-hire.zip`. You will get a folder called `hph`.
   Open it so you can see `README.md`, `Dockerfile`, a `server` folder and a `web` folder.
3. On GitHub, click the **+** at the top right, then **New repository**.
   - Repository name: `healthy-planet-hire`
   - Choose **Private**
   - Tick **Add a README file**
   - Click **Create repository**
4. On the repository page click **Add file**, then **Upload files**.
5. Drag **everything inside the `hph` folder** (not the folder itself) into the upload area.
   Use Google Chrome; it lets you drag whole folders. You should see about 60 files listed,
   including `server/src/index.js` and `web/src/main.jsx`.
6. Scroll down and click **Commit changes**. Wait for the page to finish.

**You should have:** a private repository showing folders `server`, `web` and files `Dockerfile`,
`railway.json`, `README.md`, `SETUP-GUIDE.md`.

## Step 3. Host it (10 minutes with the button, 30 without)

### The easy way: one button on Render (about $8 a month)

1. In your GitHub repository, click **Settings**, scroll to the bottom, **Change visibility → Public**.
   The code contains no secrets or candidate data, so this is safe; your keys go into Render, not
   GitHub. Copy your repository's address from the browser bar (like
   `https://github.com/yourname/healthy-planet-hire`).
2. Go to **render.com**, sign up with GitHub.
3. Open this address in your browser, replacing the end with your repository address:
   `https://render.com/deploy?repo=https://github.com/yourname/healthy-planet-hire`
4. Render reads the settings file in the code and shows a form with three blanks:
   **ANTHROPIC_API_KEY** (paste your key), **ADMIN_EMAIL** (your email) and **ADMIN_PASSWORD**
   (choose a strong one). Click **Apply**.
5. Wait 5 to 8 minutes. When it says Live, click the service and open the address it shows
   (something like `healthy-planet-hire.onrender.com`). Sign in.

Storage, web address, security secret and sample data are all handled. Skip to Step 4.

### The other way: Railway (about $5 a month, a few more clicks)

1. Go to **railway.com** and click **Login**, then **Login with GitHub**. Approve the connection.
2. Click **New Project**, then **Deploy from GitHub repo**. If asked, click **Configure GitHub App**
   and give Railway access to `healthy-planet-hire`. Select the repository.
3. Railway starts building. It takes 3 to 5 minutes. Meanwhile, do the next three items.
4. **Add storage for your data.** Click the service box (it is named after your repo), then the
   **Settings** tab. Scroll to **Volumes** and click **Add Volume**. Mount path: exactly
   `/app/server/data`. Save. Without this your candidates would be lost on every restart.
5. **Add your settings.** Click the **Variables** tab, then **Raw Editor**, and paste this, changing
   the three marked lines:

   ```
   ANTHROPIC_API_KEY=sk-ant-PASTE-YOUR-KEY-HERE
   ADMIN_EMAIL=you@healthyplanetschool.com
   ADMIN_PASSWORD=choose-a-strong-password-here
   ADMIN_NAME=Dr. Arunabh Singh
   PUBLIC_URL=https://TEMP
   FOLLOWUP_DAYS=3
   RETENTION_MONTHS=12
   SNAPSHOT_DAYS=90
   WA_VERIFY_TOKEN=healthyplanet-verify
   ```

   Click **Update Variables**. (We fix `PUBLIC_URL` in the next step.)
6. **Get your web address.** Go to **Settings**, scroll to **Networking**, click
   **Generate Domain**. If it asks for a port, type `4000`. You get something like
   `healthy-planet-hire-production.up.railway.app`. Copy it.
7. Back in **Variables**, change `PUBLIC_URL` to `https://` followed by that address, for example
   `https://healthy-planet-hire-production.up.railway.app`. Update. Railway redeploys (1 to 2 minutes).
8. Open your address in a browser. You should see the **Healthy Planet Hire** sign-in page.
   Sign in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you set.

**You should have:** the app open in your browser, signed in, with a sample role and one sample
candidate (Priya Sharma) already there. Open Priya, press **Screen resume**, and a scored report
should appear within about 20 seconds. If it does, the AI key works.

**If the build fails:** click the **Deployments** tab, open the failed one, and read the last red
lines. The two common causes are a missing file from the upload (go back to Step 2 and upload
again) or the volume not mounted. Railway support chat is also fast.

### Optional: your own web address

`hire.healthyplanetschool.com` looks better on a WhatsApp message than the Railway address.
In Railway **Settings → Networking → Custom Domain**, type the address you want. It shows you a
CNAME record. Log in to wherever the school's domain is managed (GoDaddy, BigRock, Cloudflare), add
that CNAME record, wait up to an hour, then change `PUBLIC_URL` in Variables to the new address.

## Step 4. Set up the app (about an hour, no technical skill)

Once signed in, click **Setup** in the top menu. It lists every step with a tick or a cross, tests each
connection with a button, and tells you exactly what to fix. Come back to it after every step below;
the home screen also nags you until the required items are green.

Do these inside the app, in this order.

1. **Settings → Team.** Add your HR person and anyone else. Recruiter sees everything; Hiring
   manager (a principal or HOD) sees only shortlisted candidates for roles you assign them. If you
   run more than one campus, set each person's campus.
2. **Settings → Message templates.** Read every template and rewrite it in your own words. These
   go to candidates under the school's name. Do the offer letter too.
3. **Roles.** Delete the two samples or edit them. For each real role write: the criteria (tick
   "must" for non-negotiables), five to six interview questions, and the demo-lesson rubric. Turn on
   Interactive and write a scenario if you want Maya to role-play with candidates.
4. **Roles → Slots.** Add interview times for the coming weeks so candidates can self-book.
5. **Automation → WhatsApp assistant.** Add at least ten questions candidates always ask, with
   your answers: location, timings, documents to bring, when they'll hear back, salary range policy.
   The assistant only answers from this list.
6. **Automation → Rules.** Leave everything off for the first two weeks. Turn on rules one at a time
   once you have seen a few real candidates go through.
7. Copy the **Apply link** from a role card and give it to whoever manages the school website. That
   page is how applicants enter the pipeline. Also give them `PUBLIC_URL/api/public/jobs.xml` if the
   school posts on Indeed.

## Step 5. Connect WhatsApp (start now; Meta takes days)

Until this is done, every WhatsApp send opens in your own WhatsApp with the message pre-filled, and
you press send yourself. The app still logs it. So you can run without this step; it just means
clicks instead of automation.

1. Go to **business.facebook.com**, create a Business Portfolio for the school if none exists, and
   complete **Business verification** (Security Centre). You will upload the school's registration
   document. This is the slow part: 2 to 10 days.
2. Go to **developers.facebook.com**, click **My Apps → Create App**, choose **Business**, name it
   "Healthy Planet Hire", and link it to your Business Portfolio.
3. In the app dashboard, find **WhatsApp** and click **Set up**.
4. Under **API Setup**, click **Add phone number**. Use a school landline or a new SIM. It must not
   be a number already used in the WhatsApp or WhatsApp Business app. Verify it by SMS or call.
5. On the same page, copy the **Phone number ID**. Then create a **permanent access token**: in
   Business Settings → System Users, add a system user (Admin), click **Generate token**, select
   your app, tick `whatsapp_business_messaging` and `whatsapp_business_management`. Copy the token.
6. Back in Railway **Variables**, add:
   ```
   WA_TOKEN=paste-the-token
   WA_PHONE_NUMBER_ID=paste-the-phone-number-id
   ```
7. Register the webhook. In the app, open **Setup**, scroll to **WhatsApp webhook**, and paste the
   Meta **App ID**, **App Secret** (Meta app → App settings → Basic → Show) and **WhatsApp Business
   Account ID** (WhatsApp → API Setup). Press **Register webhook with Meta**. Done in one click.
   (If you prefer Meta's dashboard: WhatsApp → Configuration → Webhook → Edit, paste the Callback URL
   and Verify token shown on the Setup page, then Manage → subscribe to messages.)
8. Test from the same Setup page: type your own number and press **Send test WhatsApp**. You should
   receive it. Reply "Where is the school?" and, if you added that FAQ, you get an answer within a
   few seconds.

**Note:** Meta requires message *templates* for the first message to a person who has not written to
you in 24 hours. The app sends plain text, which works once the candidate has messaged your number,
or within Meta's allowances for your account tier. In practice, ask applicants to WhatsApp "Hi" to
your number when they apply (put this on the apply page and in job ads), which opens the window.

### Let Claude do the clicking on Meta's screens

Meta's dashboard is the most confusing part of this whole guide. If you install **Claude in Chrome**,
you can open developers.facebook.com and say: "Help me set up the WhatsApp Cloud API for my app
Healthy Planet Hire: add a phone number, then show me the Phone number ID, and walk me to creating a
permanent system-user token with whatsapp_business_messaging and whatsapp_business_management." It
navigates and points; you type passwords and approve each step. Same trick works for Google app
passwords in Step 6.

## Step 6. Connect email (10 minutes, optional but recommended)

If the school uses Google Workspace:

1. In your Google account, turn on 2-Step Verification, then go to **myaccount.google.com/apppasswords**
   and create an app password named "Healthy Planet Hire". Copy the 16-character password.
2. In Railway **Variables**, add:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=hr@healthyplanetschool.com
   SMTP_PASS=the-16-character-app-password
   MAIL_FROM=Healthy Planet School <hr@healthyplanetschool.com>
   ```
3. Test from **Setup → Send test email**.

For Zoho or others, use their SMTP host and port instead; the rest is the same.

## Step 7. Optional extras

- **Accurate transcription (do this one):** create a free account at **deepgram.com** (it comes with
  about $200 of credit, enough for hundreds of interviews). In the console click **API Keys → Create
  a New API Key**, copy it, and add `DEEPGRAM_API_KEY` in Render → Environment. Then in the app's
  Setup page press **Test transcription**. From then on spoken answers are transcribed on the server
  with proper Hindi-English support instead of relying on the candidate's phone.

- **SMS:** create an account at **msg91.com**, get an Auth Key and an approved 6-letter Sender ID
  (DLT registration is required in India; MSG91 walks you through it). Add `MSG91_AUTHKEY` and
  `MSG91_SENDER` to Variables.
- **Video interviews:** create an account at **daily.co** (free tier is enough to start), copy the
  API key from Developers, add `DAILY_API_KEY` to Variables. Then in Daily's dashboard, add a webhook
  pointing at `PUBLIC_URL/api/public/webhooks/daily` for recording and transcript events. Voice
  interviews already work without this; video is for when you want to see the candidate.

## Step 8. Trial week

Before announcing anything:

1. Add yourself as a candidate with your own phone and email. Go through every step: screening,
   AI interview on your phone (try both typing and speaking), booking a slot, a scoring link sent
   to a colleague, moving to Offer (it will stop you until checks are verified), the offer letter.
2. Ask two teachers to take the AI interview for real and read their reports with them.
3. Fix templates and criteria based on what felt wrong.

## Looking after it

- **Backups:** the app backs up nightly into its storage. Once a month, download one: in Railway,
  open the service, **Volumes**, and use the backup option, or ask a candidate export from
  Settings. If you ever lose Railway, this file is your school's entire hiring history.
- **Money:** Railway bills the card monthly (~$5). Anthropic credit runs down with use; set a
  **Usage limit** and an email alert in the Anthropic console so it never surprises you.
- **Daily habit:** open **Automation**. If the inbox shows candidates, a person needs to reply.
- **When you get stuck:** the **Deployments** tab in Railway shows what the software is saying.
  Copy the last twenty lines into a message to me and I will tell you what to do.

## Passwords you will hold

Keep these in a password manager (Bitwarden is free), not in a notebook:
Anthropic console · GitHub · Railway · Meta Business (with 2-factor) · the school's domain registrar
· the app admin login · the Google app password.

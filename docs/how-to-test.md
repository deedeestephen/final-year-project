# How to test everything on your PC (the very simple guide)

This guide is written so anyone can follow it. Do the steps **in order**. Each step says **what to do** and **what you should see**. If what you see is different, look at "If something goes wrong" at the end.

> Only ever type **made-up** people into the app. Never use a real patient.

---

## Part 0: things you need (already on your PC)

- **Docker Desktop**: the box that runs the databases.
- **Android Studio (Quail)**: runs the pretend phone (the "emulator").
- **This project folder**: `D:\Final Year Project\pca-mhealth`.

---

## Part 1: find your demo password

1. Open the project folder in File Explorer.
2. Right-click the file called **`.env`**, choose **Open with**, then **Notepad**.
3. Find the line that starts with `SEED_DEMO_PASSWORD=`.
4. The text after the `=` is your **demo password**. Keep Notepad open so you can copy it.
5. **Never** send this file to anybody, and never put it on GitHub. (It is already hidden from Git.)

---

## Part 2: switch everything on (one command)

1. Press the **Windows key**, type **PowerShell**, and press **Enter**. A blue or black window opens.
2. Copy this line, paste it into the window (right-click pastes), and press **Enter**:

   ```
   cd "D:\Final Year Project\pca-mhealth"; powershell -ExecutionPolicy Bypass -File 6-infrastructure\scripts\dev-up.ps1
   ```
3. Wait. It starts Docker, the databases and the backend. The first time can take a few minutes.

**You should see:**
- a **second window** called *PCa mHealth backend*. **Leave it open.** It is the server. Closing it switches the server off.
- a **third window** called *PCa mHealth admin website*. **Leave it open too.** It serves the admin website at http://localhost:5173.
- the green word **READY!** in the first window.

**Check it with your eyes:** open your web browser and go to **http://localhost:3000/api/v1/health**. You should see `"status":"ok"`.

> If you already changed the demo passwords and forgot them, run the same command with ` -ResetDemoPasswords` at the end. The demo accounts go back to the password in `.env`.

---

## Part 3: start the Galaxy S9+ pretend phone

1. Open **Android Studio**.
2. Click **File**, then **Open**, then choose the folder **`pca-mhealth\1-presentation-layer\mobile-app`**, then **OK**. The first time, click **Trust Project**. Wait until the bar at the bottom stops moving.
3. At the top of the window there is a box with a phone name. Click it and choose **Samsung Galaxy S9+ (Android 10)**.
   - Not in the list? Click **Device Manager** (the phone icon on the right side), find **Samsung Galaxy S9+ (Android 10)**, and press its ▶ play button.
4. Next to it, pick the run setting **App - S9+ emulator**.
5. Press the green **▶ Run** button.

**You should see:** a phone appear on the screen. After a minute or two (the first time is slowest), the app opens on the **Sign in** page. At the bottom it says *Research prototype. Not a medical device.*

---

## Part 4: test each finished phase

Tick each box when it works.

### Phase 4: signing in, and keeping people safe

- [ ] **Wrong password.** Email `clinician@demo.pca-mhealth.test`, password `wrong-password-1`. Tap **Sign in**.
  → You should see *"Email or password is incorrect."* (It never says whether the email exists. That is on purpose.)
- [ ] **Right password.** Same email, then the **demo password** from Part 1.
  → The app says **Choose a new password**. Demo accounts must pick their own password first.
- [ ] **Password rules.** Type the demo password as *Current password*, and something short like `abc` as the new one. Tap **Save password**.
  → *"Use at least 12 characters."*
- [ ] **New password.** Choose a new password you will remember (12 or more characters, e.g. `green-river-stone-7`), type it again in *Confirm*, and tap **Save password**.
  → You see the **Clinician** home: *Welcome, SYNTHETIC Clinician*.
- [ ] **Other roles.** Sign out (see the next box) and try `patient@…` and `pathologist@…` (both `@demo.pca-mhealth.test`). Each one gets **its own home screen**. (The admin uses the website: see *The admin website* below.)
- [ ] **Sign out.** Tap the **☰** menu at the top left, then **Sign out**.
  → Back on the Sign in page.
- [ ] **Forgot password.** On Sign in, tap **Forgot password?**, type any email, and tap **Send reset instructions**.
  → It shows the same message for every email, so nobody can find out which emails have accounts.

### Phase 5: patients and screening records (saved on the server)

- [ ] Sign in as the **clinician**. Tap **Patients**.
  → You see the 3 made-up demo patients from the server: *Patient 001, SYNTHETIC* to *Patient 003, SYNTHETIC*, with MRNs SYN-0001 to SYN-0003. Tap one to see its PSA record.
- [ ] Tap **Register patient** (bottom right). Fill in a made-up person:
  - First name `SYNTHETIC`, Surname `Test`
  - Date of birth `1960-05-01` (or tap the calendar)
  - Area type **Rural**
  
  Tap **Save patient**.
  → The patient page opens. After a moment the green badge says **Synced**, and the server gives the patient an **MRN** (record number).
- [ ] **Screening record.** Tap **Add screening record**. Type PSA `4.5`, Free PSA `6`, and tap **Save record**.
  → *"Free PSA cannot be higher than total PSA."* (The app checks numbers like a careful nurse.)
  Change Free PSA to `1.2`, choose DRE **Normal**, and save.
  → The record shows **PSA 4.5 ng/mL**.
- [ ] **Bad input is blocked.** Register another patient with the date of birth `2999-01-01`.
  → *"The date must be between 1900 and today."*

### Phase 6: working with no internet (offline sync), the new part

- [ ] **Turn the internet off** on the pretend phone. Put your mouse at the very top of the phone screen, drag down **twice**, and tap **Airplane mode** ✈.
  → A grey strip appears in the app: *"Offline. Work is saved on this device."*
- [ ] Register a new made-up patient and give them a screening record.
  → The badges say **Saved on device** (amber). Nothing is lost.
- [ ] Tap the badge at the top right to open the **Sync** page.
  → *"2 changes waiting to be sent."*
- [ ] **Turn the internet back on** (tap Airplane mode again). Wait a few seconds, or tap **Sync now**.
  → *"Everything saved here has been sent."* The badges turn green: **Synced**.
- [ ] **Close the app completely while offline and open it again.** Airplane mode on, swipe the app away, then tap its icon (**PCa mHealth**).
  → You are still signed in and your patients are still there. The app starts even with no internet.
- [ ] **Unsent changes warning.** Airplane mode on, add a patient, then **☰**, then **Sign out**.
  → *"1 change has not been sent to the server yet…"* Tap **Cancel** to keep it.

**What makes the phone data safe:** everything saved on the phone sits in a **locked (encrypted) database**. Its key is kept in the phone's secure keystore.

### Phase 8: the patient app

- [ ] Sign out, then sign in as **`patient@demo.pca-mhealth.test`** with the demo password. It asks you to choose a new password first, just like the clinician did.
  → You see the **patient app**, with 5 buttons along the bottom: **Home · Results · Learn · Messages · Profile**.
- [ ] **Home** says *Hello, SYNTHETIC Patient 001* and shows the date of the latest screening.
- [ ] Tap **Results**.
  → You see the PSA number and the exam result, with the blue note *"Your clinician will explain what this means for you."* There are no scary colours or words; that is on purpose.
- [ ] Tap **Learn**, then tap **What is a PSA test?**
  → A short article, with its sources at the bottom. **Bemba** and **Nyanja** are greyed out: they wait until a real translator has checked them.
- [ ] **A message arrives.** Sign out, sign in as the **clinician**, and open **Patients**, then **Patient 001, SYNTHETIC**, then **Add screening record**. Add a PSA value, then sign out.
  Sign in as the **patient** again and tap **Messages**.
  → *"New screening record"* with a red number on the Messages button. Tap the message to mark it as read.
- [ ] Tap **Profile**, then **My consents**. If the list is empty, the clinician has not recorded a consent yet (see Phase 9).
  With a consent listed, tap **Withdraw**. The app explains what that means and asks first.
- [ ] **New patient account.** Sign out. On Sign in, tap **New patient? Create an account** and fill it in with made-up details, including a phone number and an **NRC** (like `123456/78/1`) or a **passport number**.
  → *"Your account is ready."* Sign in with it: Home says *"Almost ready… Ask your clinic to link it"*, because no clinic has linked it to a patient record yet.
- [ ] **Offline.** Turn **Airplane mode** on and open the tabs again.
  → The app still shows your last results and messages, with *"Offline · showing what was saved on …"*.

### Phase 9: the clinician and pathologist screens (consent, pictures, AI, review)

Everything here needs the patient to be **synced** first (green **Synced** badge). Before that, the patient page says *"Consent, images and AI analysis become available after this patient has synced to the server."*

**Put a practice picture on the pretend phone** (one time only):
1. Make the practice files if you have not yet: `cd "D:\Final Year Project\pca-mhealth\3-application-logic\backend"; npm run fixtures`
2. Open the folder `3-application-logic\backend\test\fixtures\files` in File Explorer.
3. **Drag `synthetic-mri.dcm` onto the pretend phone's screen** and let go. It is copied into the phone's **Downloads**. Do the same with `synthetic-slide.tif` for the pathologist test.

Sign in as the **clinician** and open **Patients**, then a synced patient. Below the patient's details there are now three cards: **Consent**, **Images and slides**, **AI analysis**.

- [ ] **AI analysis before consent.** Tap **AI analysis**.
  → The **Request AI analysis** button is grey, with the reason: *"The patient has not consented to AI analysis. Record it under Consent first."*
- [ ] **Record consent.** Go back, tap **Consent**, then **Record consent**. Leave *AI analysis*, *Written* and *v1* as they are and tap **Save consent**.
  → *AI analysis* is listed as given, with a **Withdraw** button (it asks before withdrawing).
- [ ] **Add a picture.** Go back, tap **Images and slides**, then **Add a file**. Leave the type as **MRI**, tap **Choose file**, pick `synthetic-mri.dcm` from Downloads, then tap **Save and upload**.
  → A moment later the file is listed under *Images on the server*.
- [ ] **Add a picture with no internet.** Turn **Airplane mode** on and add the same file again.
  → It waits under *Waiting on this phone*: *"Saved on this phone, will upload when online"*. Turn Airplane mode off and tap **Try now** (or just wait): it uploads and moves to the server list. Nothing is sent twice.
- [ ] **A file that is not a picture** (optional: drag `not-an-image.dcm` onto the phone and add it).
  → It is marked *Not accepted*, with the server's reason in plain words. Tap **Remove**.
- [ ] **Ask the AI.** Go back, tap **AI analysis**. The button is now blue. Tap **Request AI analysis**.
  → A card says *Waiting to start*, then *Running*, then **Finished** after a few seconds (the screen checks by itself while it is open).
- [ ] **Read the report.** Tap the **Finished** card.
  → At the very top, the banner **"DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT."** Then the result, the parts of the AI that ran (and why the others did not), **Why (explanations)** saying each one is not available yet, and *"Accuracy figures: Evaluation data not yet available."* No coloured "good/bad" words, and no pretend heatmaps.
- [ ] **All AI results.** On the clinician home, tap **AI results to review**.
  → Every recent analysis in your clinic, with the patient's record number.
- [ ] **Pathologist: add a slide.** Sign out, sign in as **`pathologist@demo.pca-mhealth.test`**. Open **Patients**, a synced patient, **Images and slides**, **Add a file**. Choose **Slide**, format **TIFF**, pick `synthetic-slide.tif`, and tap **Save and upload**.
  → The slide is listed as *Waiting for a pathologist*.
- [ ] **Pathologist: review it.** Go back to the home page and tap **Review queue**, then the slide. Tap **Save review** without choosing anything first.
  → *"Choose the primary pattern."* Now choose **Pattern 4** and **Pattern 3**, then **Save review**.
  → *Reviewed*: **Gleason 4 + 3 = 7**, **ISUP grade group 3**. The server works out the grade group itself, and a slide can only be reviewed once.
- [ ] **Who sees what.** The pathologist has no **Consent** card (only clinicians record consent), and the clinician has no **Review queue**.

### The new look of the phone app

- [ ] **Sign-in page.** A blue header with a white **PCa** square and **PCa mHealth**, then **Sign in**. A thin line from blue to light blue follows its rounded bottom edge (no flag colours any more, ADR-011).
- [ ] **Clinician home.** Sign in as the clinician.
  → A blue gradient header with **☰**, **Clinician** and the sync badge, then today's date, **Welcome, Demo Clinician** and a round **DC** badge.
  → Under **Your work**: **Patients** (green), **New screening** (blue), **AI results to review** (purple), each with a coloured icon square. Under **Coming later**: grey tiles with a *Coming in build phase 13* label.
- [ ] **Colours never mean good or bad.** Open a patient's AI report.
  → The orange **DEVELOPMENT MOCK DATA** banner comes first, and the numbers are plain dark text: no green or red on results.
- [ ] **Patients.** The list shows a coloured round badge with each patient's initials, and the sync label under the details.
- [ ] **Patient app.** Sign in as the patient.
  → **Hello, …** in the green header. **My results** and **Messages** are coloured tiles. The bottom tabs show the current tab as a pale-green pill.
- [ ] **Dark mode.** Settings → **Dark**. Everything above keeps its shape, and the text stays easy to read.

### Dark mode (Settings)

- [ ] As the clinician, tap **☰**, then **Settings**.
  → *Appearance* with three choices. **Same as the phone** is ticked.
- [ ] Tap **Dark**.
  → The whole app turns dark straight away. The top bar stays green, and the text is easy to read.
- [ ] Open a patient and an AI report.
  → The orange **DEVELOPMENT MOCK DATA** banner is still clearly visible.
- [ ] Sign out.
  → The Sign in page is still dark: the choice belongs to the phone, not the account.
- [ ] Sign in as the **patient**, tap **Profile**, then **Settings**, and choose **Light**.
  → Back to the light look.
- [ ] **Same as the phone:** choose it, then pull down the phone's quick settings and turn on **Dark theme**.
  → The app follows the phone.

### Phase 14: sharing data in the international format (FHIR export)

The export only includes patients who agreed. So first give one made-up patient the right consent:

1. In the phone app, as the **clinician**, open a synced patient, then **Consent**, then **Record consent**.
2. Choose **Use in research**, then **Save consent**. For the SmartCare Pro test, also record **Sharing with other health records**.

Then, on the **admin website** (http://localhost:5173), signed in as the administrator:

- [ ] Click **FHIR export** in the menu.
  → You see how many patients agreed, and what the file will contain: patients, screening visits, results, pathology reviews. A blue note says the practice (mock) AI results are left out: practice results are never shared.
- [ ] Read **What is removed**.
  → Names, phone numbers, NRC, record numbers, districts, exact dates (only the year is kept) and notes are all taken out.
- [ ] Click **Download FHIR file (.json)**.
  → A file called `pca-mhealth-fhir-research-<date>.json` is saved. Open it in Notepad: you will find PSA values and years, but **no name, phone, NRC or record number**. Each person has a long code instead of a name.
- [ ] Choose **SmartCare Pro (national EHR)**.
  → The counts change to the patients who agreed to national sharing. **Send to SmartCare Pro** is grey: *"Sending is off"*, because no SmartCare address is set yet.
- [ ] **Try sending to the practice SmartCare Pro** (optional).
  1. Open a new PowerShell window:
     ```
     cd "D:\Final Year Project\pca-mhealth\3-application-logic\backend"; npm run smartcare:mock
     ```
     → *"SmartCare Pro mock (development only) on http://localhost:8090/fhir"*. Leave this window open.
  2. Open the `.env` file in the project folder and set `SMARTCARE_FHIR_URL=http://localhost:8090/fhir`. Save it, then close the backend window and run `dev-up.ps1` again.
  3. On the FHIR export page, choose **SmartCare Pro (national EHR)** and click **Send to SmartCare Pro**, then **Send**.
     → *"Sent to localhost:8090 … SmartCare Pro accepted it (reference …)"*. The mock window prints what it received. The file is saved in `var\smartcare-mock`.
- [ ] **Only for the curious: the official FHIR check.** In Git Bash: `bash 6-infrastructure/scripts/fhir-validate.sh`
  → After a minute or two: *"Success: 0 errors"*. The warnings are only best-practice notes.

### Phase 15: the security check-up

- [ ] **The audit log.** On the admin website, click **Audit log** in the menu.
  → Every sign-in, change, export and refusal, newest first. Click **Details** on a row to see more. The details never hold passwords or patient names.
- [ ] Type `auth.login` in the action box and click **Filter**.
  → Only sign-ins.
- [ ] Click **Check integrity**.
  → *"Intact: all … entries are linked and unchanged."* Each entry is chained to the one before it, so a changed or deleted entry would show here.
- [ ] **Admins cannot give themselves patient access.** Open **Users**, open your own administrator account, tick **Clinician** and save.
  → Refused: *"You cannot give your own account a new role. Another administrator must do it."*
- [ ] **Locked permissions.** Open **Roles & permissions**, then **Clinician**.
  → Administration-only permissions (for example *Read the audit log*, *Export de-identified FHIR bundles*) are locked. On **Administrator**, patient-data permissions are locked.
- [ ] **Scans are de-identified before the AI sees them.** In the phone app, add a scan to a patient (Phase 9), then request an AI analysis.
  → It works as before. Behind the scenes, the AI received a copy with the name, ID and dates removed. If a scan cannot be de-identified, its card says *"Not sent to the AI: …"* and the AI report lists it under *Files not sent to the AI*.
- [ ] **Only for the curious (Git Bash):** `bash 6-infrastructure/scripts/tls-check.sh`
  → *"TLS CHECK PASSED"*: the server settings accept only the newest, safest connections.

### The admin dashboard (what is happening in the phone app)

Sign in on the admin website (see the next section). The first page is now the **Dashboard**.

- [ ] **The menu.** A dark menu on the left, in three groups: **Overview** (Dashboard), **People** (Users, Roles & permissions, Patient accounts) and **Records & data** (FHIR export, Audit log). Each item has a small picture. The page you are on is a **green pill**. At the bottom: *Synthetic data only*.
- [ ] **Your name.** Top right: your name, your email and a round badge with your initials, then **Sign out**.
- [ ] **The big number.** A green card: **Active in the phone app**, the number of people who used the phone app in the chosen period, and how many phones synced.
- [ ] **Six tiles.** Sign-ins (and how many failed), Patients registered, Screening records, AI analyses (and how many finished), Scans and slides, Consents recorded (and how many were withdrawn).
- [ ] **Make the numbers move.** On the pretend phone, sign in as the clinician and add a screening record. Back on the website, click **Update**.
  → *Sign-ins* and *Screening records* go up by one, and *Latest from the phone app* shows **Added a screening record** at the top, with the clinician's email and "just now".
- [ ] **Period.** Click **24 hours**, **7 days**, **30 days** or **90 days**. The numbers change. The old numbers stay (a little faded) until the new ones arrive.
- [ ] **Activity per day.** A chart with three lines: sign-ins, changes synced from phones, screening records. Move the mouse over it: a thin line and a box show every number for that day. Or click the chart and press the **left and right arrow keys**. **Show as table** gives the same numbers as a table.
- [ ] **Where activity comes from.** One bar split into **Phone app**, **Admin website** and **Other**, with the numbers and percentages written next to the colours.
- [ ] **Offline sync health.** Changes the phones sent after working offline: **Saved** (green tick), **Conflicts** (amber triangle; kept for a person to choose) and **Refused as invalid** (red cross). The pictures and words tell them apart, not only the colour.
- [ ] **No patient details.** Nothing on the dashboard shows a patient name, NRC or result. It shows counts and staff email addresses only.
- [ ] **It is recorded.** Open **Audit log** and type `activity.` in *Action starts with*.
  → An `activity.read` line for each time you opened or updated the dashboard.
- [ ] **Small screens.** Make the window narrow. The tiles go two per row, the period buttons stay on one row, and the menu hides behind **Menu**.

### The admin website (users, roles and permissions, patient accounts)

The admin page is now a **website on your PC**, not part of the phone app. `dev-up.ps1` starts it in a third window, *PCa mHealth admin website*. **Leave that window open**, just like the backend one.

**How to get in:**
1. Open **Chrome** or **Edge** on your PC and go to **http://localhost:5173**.
2. Sign in with **`admin@demo.pca-mhealth.test`** and the **demo password**: the value of `SEED_DEMO_PASSWORD` in `.env` (not `.env.example`, whose line is empty).
3. If it asks you to **choose a new password** (12 or more letters), **write it down.** If you lose it, run `dev-up.ps1 -ResetDemoPasswords`: the demo accounts go back to the password in `.env`.

- [ ] **The look.** Clean white cards on a light grey page, dark text, **blue** buttons, a blue current page in the menu, and a thin blue-to-light-blue line under the top bar (the "Clinical Field Health" layout in awareness blue, ADR-011).
- [ ] **No internet.** Turn off your PC's Wi-Fi for a moment.
  → An amber strip at the top: *"You are offline. Changes cannot be saved until the connection returns."* Turn Wi-Fi back on: a green *"Back online."* shows for a few seconds.
- [ ] **Only admins get in.** Try signing in on the website as `clinician@demo.pca-mhealth.test`.
  → *"This portal is for administrators. Clinicians and patients use the mobile app."*
- [ ] **Phone app.** Sign in on the pretend phone as the admin.
  → One card: *"Administration is on the web"*, with the website address.
- [ ] **Menu.** On the left: **Dashboard**, then **Users**, **Roles & permissions**, **Patient accounts**, **FHIR export** and **Audit log** (the dashboard is described in the section above).
- [ ] **Users.**
  → Every account, with a green *Active*, orange *Locked* or red *Disabled* label. Search by name or email, or filter by role.
  - Click a person to change their **roles**, their **facility** (a clinician only sees the patients of their own facility), or switch the **account off**.
  - **Unlock account** appears when someone typed a wrong password 5 times.
  - **Reset password** shows a one-time password. Give it to the person privately; they choose their own at their next sign-in.
  - **Delete account** asks first ("Delete this account?", with **Cancel** selected). Then the account, its sessions, messages and assistant chats are gone, and the Users list says *"The account … was deleted."* The throwaway test accounts left by the end-to-end runs (`e2e-patient-…@demo.pca-mhealth.test`) are good ones to try.
  - Try **Delete account** on `clinician@demo.pca-mhealth.test`.
    → It refuses: *"This account has clinical history, so it cannot be deleted. Disable it instead…"* Accounts that registered patients, recorded screenings or consents, uploaded scans or asked for AI analyses are kept, so the medical history stays traceable. Untick **Account active** instead.
  - Your own account has no **Delete account** button.
- [ ] **Add staff user.** Click **Add staff user**. Enter an email and name, tick **Clinician**, choose the facility, and click **Create account**.
  → A one-time password appears. Staff accounts are only made here; patients sign up themselves in the app.
- [ ] **Roles & permissions.** Click **Edit** next to a role, e.g. **Pathologist / Radiologist**.
  → Groups of ticks: what that role may do.
  - Untick something and click **Save permissions**. It asks first, then applies to everyone with that role at once.
  - Click **Reset to defaults** to undo.
  - Some boxes are **locked** (greyed) for safety: the admin role can't lose "manage users/roles" (or nobody could manage accounts again), and patients can't be given access to other people's data.
- [ ] **Patient accounts (giving a patient access to their own data).**
  1. In the phone app: **New patient? Create an account**, with a made-up NRC such as `654321/12/1`.
  2. In the phone app as the clinician: register a patient with the **same NRC**.
  3. On the website: **Patient accounts → Not linked → Find record and link**.
  → *"The NRC matches record … "* Click **Link**. The patient now sees their results in the app, and gets a message saying so.
- [ ] **Small screens.** Make the browser window narrow (or press **F12**, then the phone icon, and pick a phone).
  → The menu hides behind a **Menu** button, and tables turn into cards. Nothing needs sideways scrolling.
- [ ] **Stay signed in, safely.** Press **F5** to reload.
  → You are still signed in. The long-lived key is in a cookie that the page's own code cannot read (it protects you if a bad script ever got in). **Sign out**, then press **F5**: you stay signed out.

### Rate limits (nobody can overload the system)

- [ ] **Too many sign-in tries.** On the website, type an email that does **not** exist, such as `nobody@example.com`, and any password. Click **Sign in** 11 times quickly.
  → The first 10 say *"Email or password is incorrect."*, then *"Too many requests. Please wait … seconds and try again."* Wait a minute and it works again.
  (Use a made-up email: 5 wrong passwords on a real account lock that account for 15 minutes, which is a separate protection.)
- [ ] **Each account has its own limit** (120 requests a minute), so one busy or broken phone can't slow down everyone else. The robot tests check this, and [scalability.md](scalability.md) shows a real measurement: one account sending 15,000 requests got exactly 120 through.

### Phase 10: pictures and slides (on the server)

You can do this on the phone (see Phase 9 above). The steps below test the server on its own web page.

1. Make the practice files (they are made up, with no real person in them):
   ```
   cd "D:\Final Year Project\pca-mhealth\3-application-logic\backend"; npm run fixtures
   ```
   → Five files appear in `3-application-logic\backend\test\fixtures\files`: `synthetic-mri.dcm`, `synthetic-ct.dcm`, `synthetic-trus.dcm`, `synthetic-slide.tif` and `not-an-image.dcm`.
2. Open **http://localhost:3000/api/docs**. Use **POST /api/v1/auth/login** (Try it out) as the clinician and copy the `accessToken`. Click **Authorize** at the top, paste it, and click **Authorize**.
3. Find a patient id: **GET /api/v1/patients** → Try it out → Execute, and copy one `id`.
- [ ] **A good MRI.** Open **POST /api/v1/patients/{id}/imaging**, paste the id, choose modality **MRI**, choose the file `synthetic-mri.dcm`, and click **Execute**.
  → Code **201**, `"status": "VALIDATED"`, and a long `sha256` (the file's fingerprint).
- [ ] **The wrong kind.** Same again with the file `synthetic-ct.dcm` but modality **MRI**.
  → Code **422**: *"This DICOM file is modality CT, not MRI"*.
- [ ] **Not a picture at all.** Try `not-an-image.dcm`.
  → Code **415**. The server looks inside the file, not at its name.
- [ ] **Slides and review** (sign in as `pathologist@demo.pca-mhealth.test`): upload `synthetic-slide.tif` with **POST /api/v1/patients/{id}/histopathology**, then **GET /api/v1/histopathology/review-queue** lists it. **POST /api/v1/histopathology/{id}/review** with `{"gleasonPrimary": 4, "gleasonSecondary": 3}`.
  → `"isupGradeGroup": 3`. The server works that out itself.

### Phase 11: the AI helper (practice models only)

The AI service now runs in its own window, *PCa mHealth AI service (mock models)*, started by `dev-up.ps1`. It uses **practice ("mock") models**: their numbers are made up on purpose and every answer says **"DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT."** The phone screens are in Phase 9 above; the steps below use the server's web page.

1. Open **http://localhost:3000/api/docs**, sign in as the clinician (**POST /api/v1/auth/login**), and click **Authorize** with the `accessToken`.
2. Pick a patient id from **GET /api/v1/patients**.
- [ ] **No permission yet.** **POST /api/v1/patients/{id}/ai-jobs** → Execute.
  → Code **409** *"The patient has not consented to AI analysis."* The system asks the patient first.
- [ ] **Give permission.** **POST /api/v1/patients/{id}/consents** with `{"type": "AI_ANALYSIS", "method": "WRITTEN", "consentTextVersion": "v1"}`.
- [ ] **Ask again.** **POST /api/v1/patients/{id}/ai-jobs** → code **202**, `"status": "QUEUED"`. Copy the `id`.
- [ ] **Read the answer.** **GET /api/v1/ai-jobs/{id}** (wait a few seconds).
  → `"status": "SUCCEEDED"`, `"isMock": true`, and the disclaimer. `modulesSkipped` explains, for each missing input, why that part did not run (for example *"No imaging study was provided"*).
- [ ] **Which models?** **GET /api/v1/ai/models** → five models, all `MOCK`, `mock-0.1`, and `evaluationAvailable: false` (no made-up accuracy numbers).

### Phase 12: why did the AI say that? (explanations)

- [ ] After the Phase 11 steps, open **GET /api/v1/ai-jobs/{id}/explanations** with the same job id.
  → One entry for each part of the AI that ran (for example *ann_clinical* **SHAP**, *xgboost_fusion* **SHAP**). Each says `"available": false` with *"Explanations need a trained research model; none is loaded (development mock)."* That is honest: practice models have nothing real to explain, so the system does **not** draw a pretend heatmap.
- [ ] **Model quality figures.** **GET /api/v1/ai/models**, copy a model `id`, then **GET /api/v1/ai/models/{id}/evaluation**.
  → *"Evaluation data not yet available."* Accuracy and fairness numbers will only ever come from a real, stored evaluation.

### Phase 3: the server itself

- [ ] Open **http://localhost:3000/api/docs** in your browser.
  → A page listing every server "door" (endpoint): auth, users, patients, clinical records, sync…
- [ ] Try one: open **POST /api/v1/auth/login**, click **Try it out**, type the clinician email and your new password, and click **Execute**.
  → Code **200**, and a long `accessToken`.

### Phase 2: the databases

- [ ] Open **Docker Desktop** and click **Containers**.
  → **pca-mhealth** shows 5 green services: postgres, mongo, minio, qdrant and redis.
- [ ] **MongoDB Compass.** Click **New connection** and paste the `MONGO_URL` line from `.env` (the text after `MONGO_URL=`). Click **Connect**.
  → A database called **pca_mhealth**.
- [ ] **PostgreSQL** (patients and users). In PowerShell:
  ```
  cd "D:\Final Year Project\pca-mhealth\3-application-logic\backend"; npx prisma studio
  ```
  → The browser opens tables like `patients` and `users`. Names show as scrambled bytes, because patient names are **encrypted** in the database. That is on purpose.

### Phase 13: the assistant ("Ask a question" and "Ask the assistant")

First, restart everything so the new chat is loaded: close the server windows and run `dev-up.ps1` again.

- [ ] **As the patient**, on the home screen tap **Ask a question**.
  → A short note explains that answers come from reviewed information, that it cannot see your records, and that it is not for emergencies. Three suggested questions are shown.
- [ ] Tap **What does a PSA test measure?**
  → A card with the answer, **Source** (NHS), *Content status: Draft for review by a qualified clinician…*, and *This is general information, not medical advice…*.
- [ ] Type **Is my PSA bad?**
  → *I cannot help with that* and a polite text: your clinician will explain your results.
- [ ] Type **I cannot pass urine at all**
  → A red **Urgent** label: go to the nearest clinic or hospital now.
- [ ] Type **What is the capital of France?**
  → *No reviewed information*, and a suggestion to ask your clinician.
- [ ] **As the clinician**, tap **Ask the assistant**, then **What does PI-RADS 4 mean?**
  → The five PI-RADS categories, with the Turkbey 2019 article as the source.
- [ ] **Chatting.** Type **Hello**.
  → A friendly greeting that says what it can help with. Then ask **What happens during a DRE?**, then just **Does it hurt?**
  → The second answer understands you still mean the DRE.
- [ ] **Answers written by Claude (optional, costs money).**
  1. Create an API key at console.anthropic.com.
  2. Open the `.env` file in the project folder and put it after `ANTHROPIC_API_KEY=`. Never paste it into a chat, e-mail or the code.
  3. Restart everything with `dev-up.ps1`.
  → Answers now read more naturally and carry the label *Written by AI (Claude) from the sources below*, still with their sources.
  → If Claude is slow or not reachable, the assistant quotes the sources instead.
- [ ] Turn off Wi-Fi.
  → The send button is greyed out, and a line says the assistant needs the internet.
- [ ] Tap **⋮** → **Delete conversation** → **Delete**.
  → The conversation is gone, from the server too.
- [ ] **As the pathologist or administrator** there is no assistant tile.

### The blue look, the assistant bot, voice and read-aloud (ADR-011, ADR-012)

- [ ] **Colours and icons.** Everything is blue now, with no green or flag colours; icons are soft and rounded; the selected tab's icon is filled. Try **Profile › Settings › Dark**: dark navy, still easy to read.
- [ ] **The bot.** As the patient, a blue **Ask the assistant** button with a little robot floats at the bottom of **Home** and **Learn**. Tap it.
  → The chat opens with a large robot that blinks, *"Hi! I am the PCa Assistant."* and three suggested questions.
- [ ] **Voice message.** On a real phone (or the emulator with **Extended controls › Microphone › Virtual microphone uses host audio input** switched on): tap the **microphone** in the question box.
  → The first time, Android asks to allow the microphone: tap **Allow**.
  → A red dot pulses and bars move while you speak. Say *"What happens during a DRE?"*: the words appear in the box.
  → Tap **✓** (or stop talking for 3 seconds), check the words, then tap the **send arrow**.
- [ ] **Microphone refused.** In Android Settings, turn the app's microphone permission off, then tap the microphone again.
  → A blue note explains how to allow it. You can still type.
- [ ] **Listen to an answer.** Under an answer, tap **Listen**.
  → The phone reads the answer and the disclaimer aloud (not the web links). Tap **Stop reading** to stop.
- [ ] **Chat casually.** Type each of these and read the reply:
  - **How are you?** → *"I am doing well, thank you for asking!…"*
  - **I'm fine, and you?** → *"Glad to hear it…"*
  - **I'm scared about the test** → a kind reply: it is normal to worry, talk to your clinician, and go to a clinic if you feel very unwell.
  - **What's your name?**, **Who made you?**, **Are you a robot?**
  - **Tell me a joke** (ask twice: a different joke)
  - **Muli bwanji** → a greeting, and that it answers in English for now
  - **👍** or **ok**
  - **Bye**
  → None of these give medical advice. **Hello, is my PSA bad?** is still answered with *"I cannot help with that"* (the safety rules come first).
- [ ] **New chat.** After a few questions, tap **✎** (New chat) at the top.
  → An empty chat with the big robot. Under *Continue a chat* you see the chat you just left.
- [ ] **Past chats.** Tap **🕘** (Past chats).
  → *Your chats* lists every earlier chat with its first question, time and number of questions. Tap one: it opens, and you can carry on asking in it.
- [ ] **Learn for people who cannot read.** Open **Learn**. Each article has a big **▶ Listen** button. Tap it on **What is a PSA test?**
  → The article opens and the phone starts reading. The part being read is tinted blue and scrolls into view; the bottom shows **Pause**, **■** and *Part 1 of 5*.
  → **Pause**, then **Resume**: it starts that part again. **Slower voice** slows it down from the next part.
  → Go back, or tap another tab: the voice stops.

### Phase 17: how fast is it? (the robot measures it)

- [ ] With `dev-up.ps1` running and nothing heavy open, open Git Bash in `3-application-logic/backend` and type `npm run perf`.
  → It takes about 6 minutes and ends with **7 passed**. It pretends to be 500 clinicians using the app at the same time, asks for AI analyses while they work, and sends a burst of changes from 100 phones.
- [ ] Type `npm run perf:report`.
  → Tables of how long the answers took. Compare them with [performance.md](performance.md). Your numbers will differ a little from run to run, and more on another computer.
- For a quicker look: `PERF_USERS=100 PERF_MEASURE_S=20 npm run perf`.

### Phase 16: the whole system tested end to end (the robot does it)

These checks start the real system and use it the way people would. They use made-up data only.

- [ ] **Server workflows.** With `dev-up.ps1` running, open Git Bash in the project folder and type:
  `bash 6-infrastructure/scripts/quality-gate.sh workflows`
  → After about half a minute: **13 passed** and *QUALITY GATE PASSED (workflows)*.
  - This starts its own copy of the server in production mode, the AI helper, and a pretend SmartCare Pro over HTTPS.
  - It checks six workflows: sign-up and linking, offline sync (exactly once, and conflicts), scans and AI with consent, slide review, withdrawing consent, and sending to SmartCare.
  - At the end it reads the server's own log and checks that no password, token, name, NRC, phone number or note appears in it.
- [ ] **Phone workflows (optional, about 3 minutes).** With the pretend phone running and the app closed:
  1. In the `3-application-logic\backend` folder, run `npm run e2e:user` four times: plain, then with `-- --role patient`, `-- --role admin` and `-- --role pathologist`. Each prints a throwaway test email and password.
  2. Run the command at the top of `1-presentation-layer\mobile-app\integration_test\app_flow_test.dart` with those values.
  → The phone signs in by itself four times (clinician, patient, administrator, pathologist), then shows **All tests passed!**
  - This signs out whoever was signed in on the pretend phone. Sign in again afterwards.

### Phases 0 and 1, plus every phase at once: the robot tests

This runs **all** the automated checks (hundreds of tests) for the backend, the AI service, the app and the admin website.
```
cd "D:\Final Year Project\pca-mhealth"; powershell -ExecutionPolicy Bypass -File 6-infrastructure\scripts\quality-gate.ps1
```
→ It takes about 10–20 minutes. At the end you should see **QUALITY GATE PASSED (all)**.

---

## Part 5: your real Samsung S9+ phone (optional)

1. **On the phone**, one time only: open **Settings**, then **About phone**, then **Software information**, and tap **Build number** 7 times. It says "Developer mode on".
2. Open **Settings**, then **Developer options**, and turn **USB debugging** ON.
3. Plug the phone into the PC with a **data** USB cable. On the phone, tap **Allow** when it asks *"Allow USB debugging?"*.
4. In PowerShell (with the backend still running from Part 2):
   ```
   cd "D:\Final Year Project\pca-mhealth"; powershell -ExecutionPolicy Bypass -File 6-infrastructure\scripts\phone-usb.ps1
   ```
   → *"Connected SM-G965U … the phone can now reach the backend."*
5. In Android Studio, pick your phone in the device box, pick the run setting **App - USB phone**, and press ▶.
6. Do the same tests as in Part 4. To go offline, use the phone's own Airplane mode.

> Unplugged the cable? Run step 4 again after plugging it back in.

---

## Part 6: switch everything off

```
cd "D:\Final Year Project\pca-mhealth"; powershell -ExecutionPolicy Bypass -File 6-infrastructure\scripts\dev-down.ps1
```
Your data is kept for next time.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| App says *"Cannot reach the server"* | Is the backend window from Part 2 still open? If not, run `dev-up` again. On a real phone, run `phone-usb.ps1` again. |
| *"Email or password is incorrect"* with the right password | You probably changed it already. Run `dev-up.ps1 -ResetDemoPasswords`. |
| *"This account is temporarily locked"* | 5 wrong tries lock it for 15 minutes. Wait, or run `dev-up.ps1 -ResetDemoPasswords`. |
| `dev-up` says Docker did not start | Open Docker Desktop yourself, wait for **Engine running**, and run `dev-up` again. |
| Emulator is very slow or black | In Device Manager, click ⋮ next to the S9+, then **Cold Boot Now**. |
| Android Studio says *"No devices"* | Start the S9+ from **Device Manager** first (Part 3, step 3). |
| A red **Needs attention** badge | Open the **Sync** page. It says what the server refused, or shows a clash with someone else's edit so you can choose which version to keep. |

# How to test everything on your PC (the very simple guide)

This guide is written so anyone can follow it. Do the steps **in order**. Each step says **what to do** and **what you should see**. If what you see is different, look at "If something goes wrong" at the end.

> Only ever type **made-up** people into the app. Never use a real patient.

---

## Part 0: things you need (already on your PC)

- **Docker Desktop**: the box that runs the databases.
- **Android Studio (Quail)**: runs the pretend phone (the "emulator").
- **This project folder**: `C:\Users\deede\OneDrive\Desktop\Final Year Project\pca-mhealth`.

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
   cd "C:\Users\deede\OneDrive\Desktop\Final Year Project\pca-mhealth"; powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1
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
2. Click **File**, then **Open**, then choose the folder **`pca-mhealth\mobile`**, then **OK**. The first time, click **Trust Project**. Wait until the bar at the bottom stops moving.
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
- [ ] Tap **Profile**, then **My consents**. If the list is empty, the clinician has not recorded a consent yet (a later phase adds that screen).
  With a consent listed, tap **Withdraw**. The app explains what that means and asks first.
- [ ] **New patient account.** Sign out. On Sign in, tap **New patient? Create an account** and fill it in with made-up details, including a phone number and an **NRC** (like `123456/78/1`) or a **passport number**.
  → *"Your account is ready."* Sign in with it: Home says *"Almost ready… Ask your clinic to link it"*, because no clinic has linked it to a patient record yet.
- [ ] **Offline.** Turn **Airplane mode** on and open the tabs again.
  → The app still shows your last results and messages, with *"Offline · showing what was saved on …"*.

### The admin website (users, roles and permissions, patient accounts)

The admin page is now a **website on your PC**, not part of the phone app. `dev-up.ps1` starts it in a third window, *PCa mHealth admin website*. **Leave that window open**, just like the backend one.

**How to get in:**
1. Open **Chrome** or **Edge** on your PC and go to **http://localhost:5173**.
2. Sign in with **`admin@demo.pca-mhealth.test`** and the **demo password** from Part 1.
3. The first time, it asks you to **choose a new password** (12 or more letters). **Write it down.** If you lose it, run `dev-up.ps1 -ResetDemoPasswords`.

- [ ] **Only admins get in.** Try signing in on the website as `clinician@demo.pca-mhealth.test`.
  → *"This portal is for administrators. Clinicians and patients use the mobile app."*
- [ ] **Phone app.** Sign in on the pretend phone as the admin.
  → One card: *"Administration is on the web"*, with the website address.
- [ ] **Menu.** On the left: **Users**, **Roles & permissions**, **Patient accounts**.
- [ ] **Users.**
  → Every account, with a green *Active*, orange *Locked* or red *Disabled* label. Search by name or email, or filter by role.
  - Click a person to change their **roles**, their **facility** (a clinician only sees the patients of their own facility), or switch the **account off**.
  - **Unlock account** appears when someone typed a wrong password 5 times.
  - **Reset password** shows a one-time password. Give it to the person privately; they choose their own at their next sign-in.
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
  cd "C:\Users\deede\OneDrive\Desktop\Final Year Project\pca-mhealth\backend"; npx prisma studio
  ```
  → The browser opens tables like `patients` and `users`. Names show as scrambled bytes, because patient names are **encrypted** in the database. That is on purpose.

### Phases 0 and 1, plus every phase at once: the robot tests

This runs **all** the automated checks (hundreds of tests) for the backend, the AI service, the app and the admin website.
```
cd "C:\Users\deede\OneDrive\Desktop\Final Year Project\pca-mhealth"; powershell -ExecutionPolicy Bypass -File scripts\quality-gate.ps1
```
→ It takes about 10–20 minutes. At the end you should see **QUALITY GATE PASSED (all)**.

---

## Part 5: your real Samsung S9+ phone (optional)

1. **On the phone**, one time only: open **Settings**, then **About phone**, then **Software information**, and tap **Build number** 7 times. It says "Developer mode on".
2. Open **Settings**, then **Developer options**, and turn **USB debugging** ON.
3. Plug the phone into the PC with a **data** USB cable. On the phone, tap **Allow** when it asks *"Allow USB debugging?"*.
4. In PowerShell (with the backend still running from Part 2):
   ```
   cd "C:\Users\deede\OneDrive\Desktop\Final Year Project\pca-mhealth"; powershell -ExecutionPolicy Bypass -File scripts\phone-usb.ps1
   ```
   → *"Connected SM-G965U … the phone can now reach the backend."*
5. In Android Studio, pick your phone in the device box, pick the run setting **App - USB phone**, and press ▶.
6. Do the same tests as in Part 4. To go offline, use the phone's own Airplane mode.

> Unplugged the cable? Run step 4 again after plugging it back in.

---

## Part 6: switch everything off

```
cd "C:\Users\deede\OneDrive\Desktop\Final Year Project\pca-mhealth"; powershell -ExecutionPolicy Bypass -File scripts\dev-down.ps1
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

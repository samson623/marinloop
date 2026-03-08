# MarinLoop Beta Tester Guide

**App URL:** [https://marinloop.com](https://marinloop.com)

MarinLoop is a medication adherence and daily care app built for patients managing daily medication routines and the caregivers who support them. It runs entirely in the browser as a Progressive Web App — no app store download required. It works offline, sends push reminders, and puts medication tracking, adherence history, health logging, and caregiver coordination into one place.

This guide tells you everything you need to know to test MarinLoop effectively.

---

## Important Disclaimers

**MarinLoop is pre-release beta software.** Please read these carefully before testing.

- MarinLoop is **not a medical device** and is not intended to diagnose, treat, cure, or prevent any disease or health condition.
- **Do not rely solely on this app for medication management.** Always follow your healthcare provider's instructions.
- This beta is **not covered by a HIPAA Business Associate Agreement.** Do not enter real protected health information (PHI), Social Security numbers, or medical record numbers.
- If you enable AI features, medication names, notes, and label images are processed by OpenAI's API. OpenAI is not a HIPAA-covered entity. **Use sample or fictional data for testing.**
- AI-generated responses are **informational only** and do not constitute medical advice, clinical recommendations, or professional guidance.
- Push reminders are delivered on a best-effort basis and are **not a substitute for clinical alerting systems.**
- Beta data may be reset or deleted before general availability.

---

## Getting Started

1. Open [https://marinloop.com](https://marinloop.com) on your phone or desktop browser.
2. Tap **Get started** and sign in with your email or Google account.
3. You will see the **Beta Program Terms** — read and accept to continue.
4. You will be asked about **AI Features** — you can enable or skip them. Core tracking works without AI.
5. On supported devices, you will be prompted to **add MarinLoop to your home screen** for the best experience and to receive push reminders.

Once you reach the **Timeline** screen, you are in the app and ready to test.

---

## What to Test

Work through these flows in order. Each one builds on the previous, and together they exercise the core experience.

### Flow 1 — Onboarding and Account Setup

**Goal:** Verify the first-run experience is clear, trustworthy, and guides you naturally.

- Sign up with a new email or Google account.
- Read the Beta Terms modal — does the language feel clear and responsible?
- Choose whether to enable AI features — is the data disclosure understandable?
- If prompted, add the app to your home screen.
- Navigate to **Profile** and review your account, push notification settings, and Data & Privacy section.

**What to look for:** Confusing language, missing steps, anything that feels rushed or unclear.

### Flow 2 — Add a Medication

**Goal:** Verify medications can be added manually with correct dosing schedules.

- Tap the **Meds** tab in the bottom navigation.
- Tap **Add Medication** (or the + button).
- Enter a medication name, dosage, form, and schedule.
- If AI features are enabled, try scanning a prescription label with your camera.
- Save and confirm the medication appears in your list.

**What to look for:** Form validation issues, unclear field labels, missing confirmation after save.

### Flow 3 — View Medications and Details

**Goal:** Verify the medication list and detail views display accurate information.

- From the **Meds** tab, tap a medication to view its details.
- Check that dosage, schedule, and any notes are displayed correctly.
- Try editing the medication — change the dose or schedule.
- Try discontinuing and then restoring a medication.

**What to look for:** Stale data, missing fields, confusing edit flow.

### Flow 4 — Log a Dose from the Timeline

**Goal:** Verify the daily timeline shows scheduled doses and logging works.

- Tap the **Timeline** tab.
- You should see today's scheduled doses based on the medication you added.
- Tap a dose to mark it as taken.
- Check that the adherence ring or indicator updates.
- Navigate to a different day and back.

**What to look for:** Missing doses, wrong times, unresponsive tap targets, adherence not updating.

### Flow 5 — Set Up and Receive a Push Reminder

**Goal:** Verify push notifications work end to end.

- Go to **Profile** and enable **Push Notifications** if not already on.
- Tap **Send test notification** — you should receive a notification on your device.
- Create a medication reminder (via the reminders panel or voice command if AI is enabled).
- Wait for the reminder to fire, or test with a short interval.

**What to look for:** Notification not arriving, wrong content in notification, action buttons (Mark Taken, Snooze) not working. On iOS, push requires the app to be added to the home screen first.

### Flow 6 — Appointments and Health Tracking

**Goal:** Verify supporting health features work correctly.

- Tap the **Appts** tab and add an appointment (doctor visit, lab test, or check-in).
- Tap the **Health** tab and explore the three sub-tabs: Adherence, Vitals, Journal.
- Log a vital reading (blood pressure, heart rate, glucose, or weight).
- Add a journal entry with a mood selection.
- Add a note.

**What to look for:** Data not saving, charts not rendering, empty states that don't guide you.

### Flow 7 — Care Network and Emergency Info

**Goal:** Verify caregiver coordination and emergency features work.

- Tap the **Care** tab.
- Explore the three sections: Providers, Caregivers, Emergency Contacts.
- Add a provider (doctor, pharmacist, or specialist).
- Add an emergency contact.
- If possible, test the ICE (In Case of Emergency) card and QR code.

**What to look for:** Confusing terminology, unclear relationship between sections, broken QR code.

### Flow 8 — AI-Assisted Features (if enabled)

**Goal:** Verify AI features behave responsibly and usefully.

- From the Timeline or anywhere in the app, try the AI assistant.
- Ask a question about a medication you added (e.g., "What are common side effects of ibuprofen?").
- Try a voice command if available (e.g., "Remind me in one hour").
- Check that AI responses include appropriate caveats and do not sound like clinical authority.

**What to look for:** Responses that sound like medical advice without disclaimers, broken voice input, consent state not respected (AI working when you declined, or not working when you consented).

---

## What Is in Scope

These features are ready for testing:

- Account creation and sign-in (email + Google OAuth)
- Medication management (add, edit, discontinue, restore, delete)
- Dose logging and adherence tracking
- Push notifications and reminders
- Appointments
- Health tracking (vitals, journal, notes)
- Care network (providers, caregivers, emergency contacts)
- AI assistant and label scanning (requires AI consent)
- Dark mode / light mode
- Mobile PWA install flow
- Offline behavior (actions queue and sync when reconnected)

## What Is Still Rough

Be aware of these known limitations:

- **Stripe checkout** for plan upgrades is not yet integrated (the plan selector in Profile is a placeholder).
- **Screenshots section** in the README is pending.
- **Some edge cases** in offline sync may behave unexpectedly.
- **iOS push notifications** require the app to be added to the home screen via Safari first — this is an iOS platform limitation, not a bug.

---

## How to Report Issues

### Option 1 — In-App Feedback (Preferred)

Tap the **chat bubble icon** in the top-right corner of the app header. This opens the feedback form where you can categorize your report as:

- **Bug** — something is broken or behaving unexpectedly
- **Feature** — something you wish existed
- **General** — any other observation or suggestion

Your feedback is saved directly to our database with your current route, device info, and app version.

### Option 2 — Written Report

If you cannot use the in-app form, send your report with this format:

```
Category: Bug / Feature / General
What happened:
What I expected:
Steps to reproduce:
Screen or flow:
Device: (e.g., iPhone 15, Chrome on Windows)
Browser: (e.g., Safari 18, Chrome 131)
Screenshot: (attach if possible)
```

### Severity Guide

When reporting bugs, it helps us prioritize if you note the severity:

| Severity | Meaning |
|----------|---------|
| **Blocking** | Cannot complete a core flow (sign in, add med, log dose) |
| **Major** | Feature works but produces wrong results or loses data |
| **Minor** | Cosmetic issue, awkward wording, or confusing layout |
| **Suggestion** | Not a bug — an idea for improvement |

---

## What We Want to Hear

After testing, we especially value your perspective on:

1. **Biggest confusion** — Where did you get stuck or have to guess?
2. **Biggest frustration** — What felt slow, broken, or annoying?
3. **Trust and safety** — Did the app feel responsible with health-related information? Did any wording feel careless or overconfident?
4. **Favorite feature** — What worked well and felt useful?
5. **Missing expectation** — What did you expect to find but could not?

---

## Device and Browser Notes

MarinLoop is tested on:

- **Desktop:** Chrome, Edge, Firefox (latest versions)
- **Android:** Chrome on Android 12+
- **iOS:** Safari on iOS 16+ (must add to home screen for push notifications)

For the best experience, use the app in full-screen PWA mode by adding it to your home screen.

---

Thank you for helping make MarinLoop better. Your feedback directly shapes a tool that helps real people manage their medications safely and confidently.

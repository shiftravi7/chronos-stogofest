# CHRONOS on iPhone — the honest truth

## What works today
The **iPhone version is the installable web app (PWA)**: open the site in Safari → **Share** → **Add to Home Screen** → **Add**. It runs full-screen with manual entry, the score and the Assistant. iOS does **not** let any web app or normal app read screen time automatically.

## How a native iOS app would work
1. Apple's **FamilyControls** framework asks the user (or a parent) for permission.
2. **DeviceActivity** watches app usage in the background and fires events (e.g. "1 hour of games today").
3. **ManagedSettings** can block or limit apps (like Screen Time limits).
4. You must request the **Family Controls entitlement** from Apple (a form; approval can take weeks).
5. You need a **paid Apple Developer account** (US$99/year) and a **Mac with Xcode** to build it.
6. **Big limit:** the raw minutes can only be *shown* inside a **DeviceActivityReport extension**. Apple does not allow the numbers to leave that extension, so they cannot be sent to the Assistant or a server.

## Recommendation for the competition
Present the PWA as the iPhone edition (it works now, with the Assistant), show the Android app for automatic tracking, and explain this guide as "future work". Building a native iOS app is not realistic before the competition without a Mac, a paid account and Apple's approval.

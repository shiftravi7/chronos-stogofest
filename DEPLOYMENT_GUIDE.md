# CHRONOS — Deployment Guide (Windows, beginner)

## 1. GitHub
1. Install Git from https://git-scm.com → you should see "Git Bash" in the Start menu.
2. Create an account at https://github.com → you land on your dashboard.
3. Click **New repository**, name it `chronos-stogofest`, choose **Public**, do not add files → an empty repo page appears.
4. Open the project folder, check `.gitignore` lists `.env` and `node_modules/` → it does.
5. In Git Bash inside the folder run `git init` → "Initialized empty Git repository".
6. Run `git add .` → no output.
7. Run `git commit -m "CHRONOS 2.0"` → a list of files.
8. Run `git remote add origin https://github.com/<you>/chronos-stogofest.git` → no output.
9. Run `git branch -M main` then `git push -u origin main` → files appear on GitHub.
10. Never commit `CHRONOS.apk` or `CHRONOS-Setup.exe`. Instead: repo → **Releases** → **Draft a new release** → tag `v2.0.0` → drag both files in → **Publish release**.
11. Right-click each file → Copy link. Links look like `https://github.com/<you>/chronos-stogofest/releases/latest/download/CHRONOS.apk`.

## 2. Vercel
1. Go to https://vercel.com and sign in with GitHub → your dashboard.
2. Open your project `chronos-stogofest` (or **Add New → Project → Import** the repo) → project page.
3. Click **Settings → Environment Variables**.
4. Name `GEMINI_API_KEY`, value: **paste your key yourself**, tick Production + Preview → **Save**.
5. Add `GEMINI_MODEL` = `gemini-3.8-flash` → **Save**.
6. **Settings → Git**: connect the GitHub repo if not connected.
7. **Deployments → Redeploy** (or push to GitHub) → status "Ready".
8. Open https://chronos-stogofest.vercel.app → the intro plays, then the site.
9. Click **Assistant** → it replies about your numbers within ~10 s.

## 3. Cloudflare R2 (optional; GitHub Releases is simpler)
1. https://dash.cloudflare.com → **R2** → **Create bucket** `chronos-downloads`.
2. Open the bucket → **Upload** `CHRONOS.apk` and `CHRONOS-Setup.exe`.
3. **Settings → Public access → Allow (r2.dev subdomain)** → a public URL appears.
4. Copy each file's public URL.
5. Paste them into `downloads.config.js` (`android.url`, `windows.url`), save.
6. Commit and push → Vercel redeploys → the download cards show buttons instead of "Coming soon".

## 4. Building the apps
**Android (Android Studio)**
1. Install Android Studio → open it once and let it install the SDK.
2. In the project: `cd apps/android`, run `npm install`, then `npm run sync`.
3. Run `npm run open` → Android Studio opens the `android` folder.
4. **Build → Generate Signed App Bundle / APK → APK** → create or choose your keystore (keep it safe and backed up) → **release** → Finish.
5. The APK is in `apps/android/android/app/release/` → rename to `CHRONOS.apk`.
(Command line alternative already set up: `cd apps/android/android` then `gradlew assembleRelease`, using `apps/android/signing/keystore.properties`.)

**Windows**
1. `cd apps/windows`, run `npm install`.
2. Run `npm run dist` → `apps/windows/dist/CHRONOS-Setup.exe`.

## 5. Final test checklist
- [ ] Web: intro plays once, Skip works, sliders change the score, Download panel opens, Assistant replies.
- [ ] Android: install APK, allow Usage Access, "Your Device" shows apps, change an app's category.
- [ ] Windows: install, close the window → still in tray, restart PC → CHRONOS starts in tray.
- [ ] iPhone: Safari → Share → Add to Home Screen → opens full-screen, Assistant works.

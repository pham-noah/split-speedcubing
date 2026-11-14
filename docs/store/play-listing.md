# Google Play listing: answers and text

Everything here matches the app as built. Check each item against Play Console's current forms before submitting, because the questions change.

## Store listing
- **App name:** Split
- **Short description (80 chars):** see `fastlane/metadata/android/en-US/short_description.txt`
- **Full description:** see `fastlane/metadata/android/en-US/full_description.txt` (Play shows plain text; remove the `<b>` tags)
- **App icon (512x512):** `fastlane/metadata/android/en-US/images/icon.png`
- **Feature graphic (1024x500):** `fastlane/metadata/android/en-US/images/featureGraphic.png`
- **Phone screenshots (1080x2160, 2:1):** `fastlane/metadata/android/en-US/images/phoneScreenshots/`. These are real screenshots of the app running with demo data (`scripts/seed-demo.ts`, `scripts/screenshots.mjs`).
- **Category:** Tools (or Sports). **Tags:** puzzle, timer, education.
- **Privacy policy URL:** host `PRIVACY.md` (for example the file on your GitHub repository) and paste that URL. Fill in the contact line first.

## App content
- **Ads:** No ads.
- **App access:** All functionality available without login.
- **Data safety form:**
  - Does your app collect or share any of the required user data types? **No.**
  - All data stays on the device; nothing is transmitted. The app declares no network permission.
  - Data deletion: not applicable (no data collected); users can erase local data in Settings or uninstall.
- **Content rating questionnaire:** no violence, no user-generated content shared, no purchases, no location, no social features. Expect the lowest rating.
- **Target audience:** you choose based on your intent. The app is not designed for children specifically and contains nothing unsuitable for them; selecting 13+ avoids the extra "Designed for Families" requirements.
- **News app / COVID / government / financial features:** none.

## Release
- Upload an **Android App Bundle (.aab)** built in release mode and signed with your upload key (see `docs/RELEASING.md`).
- New personal developer accounts have had to run a closed test with a minimum number of testers for a minimum number of days before production. Check Google's current requirement.
- `versionCode` must increase with every upload (currently 11, in `android/app/build.gradle`).

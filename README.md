# UoL Timetable Converter

[![CI](https://github.com/GeniusLv2006/uol-timetables/actions/workflows/ci.yml/badge.svg)](https://github.com/GeniusLv2006/uol-timetables/actions/workflows/ci.yml)
[![License: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg)](LICENSE)

Turn your University of Liverpool **My Timetable** into a calendar file you can add to Google Calendar, Apple Calendar, Outlook, or any other calendar app.

**Use it here: <https://timetables.xjtlu.uk>**

Everything happens in your own browser. Your timetable is never uploaded, and you do not need to install anything or create an account.

> [!IMPORTANT]
> This is an **unofficial, independent tool**. It is not affiliated with, endorsed by, or operated by the University of Liverpool or Xi’an Jiaotong-Liverpool University (XJTLU). The `xjtlu.uk` domain is privately registered and is not a university website. My Timetable remains the authoritative source: always check important sessions there.

## What it does

- **Copies your timetable in one click** with a bookmark you save once.
- **Creates an `.ics` calendar file** with the right dates, times, rooms, and teaching weeks, including the change between British Summer Time and Greenwich Mean Time.
- **Lets you personalise the calendar** before you export it: event titles, module nicknames, reminders, which sessions to include, and whether to split it into one calendar per module.
- **Warns you about problems** such as duplicate or clashing sessions.

## How to use it

It is easiest on a computer, using Chrome, Edge, Firefox, or Safari.

### 1. Save the extractor (once)

Open <https://timetables.xjtlu.uk> and drag the gold **Copy UoL Timetable** button to your browser’s bookmarks bar.

If your bookmarks bar is hidden, show it first (`Ctrl+Shift+B` on Windows and Linux, `Cmd+Shift+B` on Mac). If dragging does not work, click **Copy Bookmarklet Code**, create a new bookmark by hand, and paste the copied code as its URL or address.

### 2. Copy your timetable

1. Sign in to [My Timetable](https://timetables.liverpool.ac.uk/).
2. Click **View Semester 1** or **View Semester 2** in the lower-left menu.
3. Click the **Copy UoL Timetable** bookmark. A message confirms that your timetable was copied.

If your browser blocks clipboard access, the timetable is downloaded as a `.json` file instead.

### 3. Paste it into the converter

Go back to <https://timetables.xjtlu.uk> and paste into the **Timetable JSON** box (`Ctrl+V` or `Cmd+V`), or drag in the downloaded `.json` file. Check the preview, adjust any settings you like, click **Export Calendar**, and confirm. A `.ics` calendar file is downloaded.

### 4. Add the calendar file to your calendar app

We recommend importing into a **new, separate calendar** (for example “Semester 1”). If your timetable changes later, you can then delete that calendar and import a fresh file without touching your other events.

| App | How to import |
| --- | --- |
| Google Calendar | On a computer, open **Settings → Import & export → Import**, choose the `.ics` file and the calendar to add it to. |
| Apple Calendar (Mac) | **File → Import**, then choose the `.ics` file. |
| iPhone or iPad | iOS cannot import a downloaded `.ics` file from Files. Create a new calendar in the Calendar app, email the file to yourself, open the attachment in Mail, and add its events. |
| Outlook | In Outlook on the web, choose **Add calendar → Upload from file**. In the desktop app, open the `.ics` file. |

## Your privacy

- Your timetable, calendar files, and saved settings stay in your browser. They are never sent to this website or anyone else.
- The extractor only reads the timetable shown on the page. It never reads your password, cookies, or login.
- The website uses Cloudflare Web Analytics to count visits. It does not use tracking cookies and never sees your timetable. You can turn it off from the **Privacy** link at the bottom of the page.

## Common questions

**The bookmark says “No timetable table was found on this page”.**
Make sure you are on the My Timetable page showing a whole semester (step 2 above), not the login page or the menu.

**The dates are a week out, or sessions after Easter look wrong.**
The converter works out dates from the semester’s first teaching Monday (“Week One”). Semester 1 dates are built in. Semester 2 is not yet, because its teaching weeks are split by the Easter break; open the **Schedule** settings, set Week One yourself, and check sessions after Easter against My Timetable.

**My timetable changed.**
The exported calendar is a snapshot and does not update by itself. Copy your timetable again, export a new file, delete the old calendar in your calendar app, and import the new file.

**All events are an hour out.**
Check the timezone in the **Schedule** settings. It should normally be `Europe/London`, and your calendar app will show the times in your own timezone.

**Can I use it on my phone?**
Saving a bookmarklet on a phone is fiddly, so a computer is recommended. Once you have the `.ics` file, you can import it on any device.

**Something is broken or wrong.**
Please [open an issue](https://github.com/GeniusLv2006/uol-timetables/issues/new/choose). Do not attach your real timetable, because it contains your personal schedule; describe the problem or use made-up data instead.

## Personalisation options

Once your timetable is loaded, four tabs let you change the calendar before export:

- **Naming**: event title format, module nicknames, calendar name, file name, and suggested colour.
- **Details**: what appears in event descriptions, reminders, and how locations are written.
- **Schedule**: Week One, timezone, semester dates, which teaching weeks to include, reading week, and repeating or individual events.
- **Delivery**: which kinds of sessions to include (lectures, workshops, and so on), and whether to export one calendar or one per module or session type.

You can save these choices as a named **profile** in your browser and reuse them next semester. Profiles keep your style choices; dates always come from the timetable you load.

## Command-line converter

If you prefer a terminal, `convert_to_ical.py` turns the copied JSON into the same calendar file as the website’s default settings. It needs only Python 3:

```bash
python3 convert_to_ical.py timetable.json timetable.ics
```

Unlike the website, the script does not know Week One dates, so the JSON must include `weekOneMonday`, and it only supports the `Europe/London` timezone. See [the JSON format](docs/timetable-json.md) for details.

## For developers

```bash
npm install
npm run dev    # local preview
npm run check  # tests, build, and deployment dry run
```

- [Contributing guide](CONTRIBUTING.md): setup, project structure, and conventions.
- [Maintenance guide](docs/MAINTAINING.md): yearly date updates, deployment, and Cloudflare settings.
- [Timetable JSON format](docs/timetable-json.md): the data the extractor produces and the converter accepts.
- [Security policy](SECURITY.md): how to report a vulnerability.

The website is plain HTML, CSS, and JavaScript with no runtime dependencies or server, and is hosted on Cloudflare Workers Static Assets.

## License

Copyright © 2026 Tingkai Lyu.

This project is licensed under the [GNU Affero General Public License v3.0 only](LICENSE) (`AGPL-3.0-only`). You may use, study, change, and share it. If you distribute a modified version, or run one as a website or other network service, you must make its complete source code available to its users under the same licence.

The licence covers the code, not the project name or the production domain.

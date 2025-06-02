Foam-Capital Gantt Timeline Kit
Elegant, brand-ready timeline built on Frappe Gantt — perfect for showcasing fundraising, product road-maps, or project plans on any website (Webflow, plain HTML, etc.).

Files in This Kit
File	Purpose
foam-gantt.css	Brand overrides: tints bars #35898b, styles pop-ups, and softly shades weekends.
foam-gantt.js	All JavaScript: task data, custom pop-up HTML, and weekend-highlight logic. Loads after Frappe Gantt’s core script.
index_local.html	Local sandbox only. Double-click to launch the chart in your browser without deploying. Not meant for production.
index.html	Local sandbox only pointing to github pages. Double-click to launch the chart in your browser without deploying. Not meant for production.

Quick-Embed (Webflow or Any HTML Page)
Add a container where the chart will render:

html
Copier
Modifier
<div id="gantt-target"></div>
Include styles (Frappe core + brand overrides) in your <head>:

html
Copier
Modifier
<!-- Frappe Gantt core CSS -->
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/frappe-gantt@0.6.1/dist/frappe-gantt.css"
>
<!-- Foam-Capital overrides -->
<link
  rel="stylesheet"
  href="https://foamcapital.github.io/fundraising-gantt/foam-gantt.css"
>
Include scripts just before the closing </body> tag:

html
Copier
Modifier
<!-- Frappe Gantt core JS -->
<script src="https://cdn.jsdelivr.net/npm/frappe-gantt@0.6.1/dist/frappe-gantt.min.js"></script>
<!-- Foam-Capital overrides -->
<script src="https://foamcapital.github.io/fundraising-gantt/foam-gantt.js" defer></script>
Publish — the timeline appears, weekends are tinted, and hover cards show additional info.

Webflow note:

Place the <div id="gantt-target"></div> inside an “Embed” element.

Paste the two <link>+<script> pairs in Page Settings → Custom Code (or Site-wide Custom Code if reused on multiple pages).

Customizing Tasks & Colours
Tasks:
Open foam-gantt.js and update the array of task objects. Each task defines:

name

start (YYYY-MM-DD)

end (YYYY-MM-DD)

progress (0–100)

custom.info (a string to display in the hover pop-up)

Brand colour:
Edit the --primary token at the top of foam-gantt.css to switch from #35898b to your own brand teal (or any hex value).

View mode (Day/Week/Month):
In foam-gantt.js, find the Gantt constructor’s options and adjust view_mode to "Day", "Week", "Month", or "Year" as desired.

Local Test (foam-gantt-test.html)
Double-click foam-gantt-test.html to open it in your default browser.

It pulls Frappe Gantt from a CDN and applies the local foam-gantt.css and foam-gantt.js.

Use this file to quickly verify edits before pushing to a CDN or deploying on Webflow.

Note: This file is for local testing only; it is not referenced by your live site.

Troubleshooting
Symptom	Fix
Chart doesn’t appear	• Ensure Frappe Gantt’s core script and foam-gantt.js both load after <div id="gantt-target">.
Bars are grey, not teal	• Confirm foam-gantt.css path is correct and that it appears after the Frappe core CSS.
Weekend shading missing	• Ensure foam-gantt.js is loading (check browser console for 404 or JS errors).

© Foam Capital — crafted for elegant financial websites.
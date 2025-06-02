Foam‑Capital Gantt Timeline Kit

Elegant, brand‑ready timeline built on Frappe Gantt — perfect for showcasing fundraising, product road‑maps, or project plans on any website (Webflow, plain HTML, etc.).

Files in this Kit

File

Purpose

foam‑gantt.css

Brand‑overrides. Tints bars #35898b, styles pop‑ups, and softly shades weekends.

foam‑gantt.js

All JavaScript: task data, custom pop‑up HTML, and weekend‑highlight logic. Loads after Frappe Gantt’s core script.

foam‑gantt-test.html

Local sandbox only. Lets you double‑click and see the chart without deploying anything. Not meant for production embedding.

Quick‑Embed (Webflow or any HTML page)

Add a container where the chart will render:

<div id="gantt-target"></div>

Include styles (Frappe core + brand overrides) in your <head>:

<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/frappe-gantt@0.6.1/dist/frappe-gantt.css">
<link rel="stylesheet" href="https://YOUR-CDN/foam-gantt.css">

Include scripts just before the closing </body> tag:

<script src="https://cdn.jsdelivr.net/npm/frappe-gantt@0.6.1/dist/frappe-gantt.min.js"></script>
<script src="https://YOUR-CDN/foam-gantt.js" defer></script>

Publish — the timeline appears, weekends are tinted, and hover cards show extra info.

Webflow note: Put the <div id="gantt-target"> inside an Embed element, and paste the two <link>+<script> pairs in Page Settings → Custom Code (or Site‑wide Custom Code if you’ll reuse them).

Customising Tasks / Colours

Update tasks inside foam‑gantt.js — each object defines name, start, end, progress, and a custom hover info string.

Change brand colour: edit the --primary token at the top of foam‑gantt.css.

Alter view mode (day / week / month) by tweaking the view_mode option in the JS initialiser.

Local Test (index / foam‑gantt‑test.html)

Double‑clicking foam‑gantt-test.html spins up the same timeline in your browser, pulling Frappe Gantt from a CDN and the local CSS/JS overrides from the same folder.

Use this file to quick‑check edits before pushing to your CDN or deploying on Webflow. It is not loaded by your live site.

Troubleshooting

Symptom

Fix

Chart doesn’t appear

Make sure Frappe Gantt core script and foam-gantt.js load after the <div id="gantt-target">.

Bars are grey, not teal

Confirm foam-gantt.css path is correct and override is after Frappe core CSS.

Weekend shading missing

Ensure foam-gantt.js loads (check console for 404/JS errors).

© Foam Capital — crafted for elegant financial websites.
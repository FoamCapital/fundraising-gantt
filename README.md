# Foam‑Capital Gantt Timeline Kit

Elegant, brand‑ready timeline built on [Frappe Gantt](https://github.com/frappe/gantt) — perfect for showcasing fundraising, product road‑maps, or project plans on any website (Webflow, plain HTML, etc.).

---

## Files in This Kit

| File                    | Purpose                                                                                       |
|-------------------------|-----------------------------------------------------------------------------------------------|
| `foam-gantt.css`        | Brand overrides: tints bars `#35898b`, styles pop‑ups, and softly shades weekends.           |
| `foam-gantt.js`         | All JavaScript: task data, custom pop‑up HTML, and weekend‑highlight logic. Loads after Frappe Gantt’s core script. |
| `index_local.html`      | Local sandbox only. Double‑click to launch the chart in your browser without deploying. Not meant for production. |
| `index.html`            | The published version of the chart. |

---

## Quick‑Embed (Webflow or Any HTML Page)

1. **Add a container** where the chart will render:

    ```html
    <div id="gantt-target"></div>
    ```

2. **Include styles** (Frappe core + brand overrides) in your `<head>`:

    ```html
    <!-- Frappe Gantt core CSS -->
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/frappe-gantt@0.6.1/dist/frappe-gantt.css"
    >
    <!-- Foam‑Capital overrides -->
    <link
      rel="stylesheet"
      href="https://foamcapital.github.io/fundraising-gantt/foam-gantt.css"
    >
    ```

3. **Include scripts** just before the closing `</body>` tag:

    ```html
    <!-- Frappe Gantt core JS -->
    <script src="https://cdn.jsdelivr.net/npm/frappe-gantt@0.6.1/dist/frappe-gantt.min.js"></script>
    <!-- Foam‑Capital overrides -->
    <script src="https://foamcapital.github.io/fundraising-gantt/foam-gantt.js" defer></script>
    ```

4. **Publish** — the timeline appears, weekends are tinted, and hover cards show additional info.

> **Webflow Note:**  
> Place the `<div id="gantt-target">` inside an Embed element.  
> Paste the `<link>` and `<script>` tags into Page Settings → Custom Code (or Site-wide Custom Code for reuse).

---

## Customizing Tasks & Colours

- **Tasks:**  
  Edit the task array in `fundraising-gantt.js`. Each task includes:
  - `name`
  - `start` (YYYY-MM-DD)
  - `end` (YYYY-MM-DD)
  - `progress` (0–100)
  - `custom.info` (text for the pop-up)

- **Brand Colour:**  
  Change the `--primary` variable at the top of `fundraising-gantt.css`.

- **View Mode (Day/Week/Month):**  
  Adjust the `view_mode` option in the JS initializer to `"Day"`, `"Week"`, `"Month"`, or `"Year"`.

---

## Local Test (`index_local.html`)

Double‑click `index_local.html` to open it in your browser. It loads:

- Frappe Gantt from a CDN  
- Your local `fundraising-gantt.css` and `fundraising-gantt.js`

Use it to validate changes before deploying.  
⚠️ Not referenced in production.

---

## Troubleshooting

| Symptom                    | Fix                                                                                  |
|----------------------------|--------------------------------------------------------------------------------------|
| **Chart doesn’t appear**   | Ensure Frappe Gantt and `fundraising-gantt.js` load _after_ the `<div id="gantt-target">`. |
| **Bars are grey**          | Confirm `fundraising-gantt.css` loads and is after the Frappe CSS.                          |
| **Weekend shading missing**| Check that `fundraising-gantt.js` is properly loaded (no 404 or JS errors).                 |

---

© Foam Capital — crafted for elegant financial websites.

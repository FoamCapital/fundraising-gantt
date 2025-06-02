/* foam-gantt.js
   ----------------------------------------------------
   Month view (3×350px), truly read-only, hover pop-ups, no scroll/pan,
   trims bottom whitespace. Must load **after** frappe-gantt.min.js.
*/

;(function () {
  /* ──────────────────────────────────────────────────────────────────────────
     1 · Date-format helper
  ─────────────────────────────────────────────────────────────────────────── */
  const today = new Date();
  const fmt   = d => d.toISOString().slice(0, 10);   // "YYYY-MM-DD"

  /* ──────────────────────────────────────────────────────────────────────────
     2 · Task definitions (unchanged)
  ─────────────────────────────────────────────────────────────────────────── */
  const taskDefs = [
    { id:'prep',    name:'Deck & Data Room Prep',        duration:14, progress:0,
      custom:{ info:'Finalize internal assessment, narrative and data pack'} },
    { id:'io',      name:'Investor Outreach',             duration:10, progress:0,
      custom:{ info:'Warm Intros, Data Room Access and Management Calls'} },
    { id:'qna',     name:'Investor Analysis & Q&A',      duration:25, progress:0,
      custom:{ info:'Investor Assessment & Q&A'} },
    { id:'ts',      name:'Term-Sheet Negotiation',        duration:10, progress:0,
      custom:{ info:'Amount, Pricing, Covenants and Securities'} },
    { id:'approv',  name:'Final Approvals',               duration: 5, progress:0,
      custom:{ info:'Board and Shareholder approvals'} },
    { id:'dd',      name:'Due Diligence',                 duration:45, progress:0,
      custom:{ info:'KYC/KYB, Legal docs, Financial assessment, etc.'} },
    { id:'close',   name:'Closing & Signing',             duration: 5, progress:0,
      custom:{ info:'Signing of legal docs and capital call'} },
    { id:'capital', name:'Capital Call',                  duration: 5, progress:0,
      custom:{ info:'Funds wired within few days'} }
  ];

  // Build actual start/end dates (“io” + “qna” parallel)
  let cur = new Date(today);
  let ioStart;
  const tasks = taskDefs.map(t => {
    let s, e;
    if (t.id === 'prep') {
      s = new Date(cur);
      e = new Date(s); e.setDate(e.getDate() + t.duration - 1);
      cur = new Date(e); cur.setDate(cur.getDate() + 1);
    } else if (t.id === 'io') {
      s = new Date(cur);
      e = new Date(s); e.setDate(e.getDate() + t.duration - 1);
      ioStart = new Date(s);
    } else if (t.id === 'qna') {
      s = new Date(ioStart);
      e = new Date(s); e.setDate(e.getDate() + t.duration - 1);
      const ioEnd = new Date(ioStart);
      ioEnd.setDate(ioEnd.getDate() + taskDefs.find(x => x.id === 'io').duration - 1);
      cur = new Date(Math.max(e, ioEnd));
      cur.setDate(cur.getDate() + 1);
    } else {
      s = new Date(cur);
      e = new Date(s); e.setDate(e.getDate() + t.duration - 1);
      cur = new Date(e); cur.setDate(cur.getDate() + 1);
    }
    return {
      id:       t.id,
      name:     t.name,
      start:    fmt(s),
      end:      fmt(e),
      progress: t.progress,
      custom:   t.custom
    };
  });

  /* ──────────────────────────────────────────────────────────────────────────
     3 · Initialize on DOMContentLoaded
  ─────────────────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    // Lock grid to first/last task dates
    const firstDate = tasks.reduce((a, t) => (t.start < a ? t.start : a), tasks[0].start);
    const lastDate  = tasks.reduce((a, t) => (t.end   > a ? t.end   : a), tasks[0].end);
    

    const gantt = new Gantt('#gantt-target', tasks, {
      /* Month view: one column = a calendar month */
      view_mode   : 'Month',

      /* 350px per month → 3 months ≈ 1050px (matches container CSS) */
      column_width: 350,

      /* Fix the grid exactly from firstDate to lastDate */
      start_date: firstDate,
      end_date  : lastDate,

      /* Disable all editing/dragging */
      readonly:          true,
      readonly_dates:    true,
      readonly_progress: true,
      draggable:         false,

      /* Show pop-up on hover (not click) */
      // popup_trigger: 'click',

      /* Optional: keep Day/Week/Year in dropdown if you want */
      view_modes: ['Day', 'Week', 'Month', 'Year'],

      /* Custom pop-up HTML (unchanged) */
      custom_popup_html: function(task) {
        return `
          <div class="details-container">
            <h5>${task.name}</h5>
            <p>${task.custom.info}</p>
            <p>
              <strong>${task._start.toLocaleDateString()}</strong>
              &nbsp;➜&nbsp;
              <strong>${task._end.toLocaleDateString()}</strong>
            </p>
          </div>
        `;
      },

      /* No-op handlers as extra precaution */
      on_click          : () => {},
      on_date_change    : () => {},
      on_progress_change: () => {}
    });

    /* ────────────────────────────────
      Fake-click once to "prime" popup system
    ──────────────────────────────── */
    setTimeout(() => {
      const bars = document.querySelectorAll('.bar-wrapper');
    
      // Simulate click once to "prime" Frappe Gantt's popup system
      const firstBar = bars[0];
      if (firstBar) {
        firstBar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        gantt.hide_popup();
      }
    
      // Track open state
      let popupOpenId = null;
    
      bars.forEach(bar => {
        const taskId = bar.getAttribute('data-id');
    
        if (!taskId) return;
    
        const task = gantt.get_task(taskId);
    
        // 🖱️ Desktop: Hover in/out
        bar.addEventListener('mouseenter', () => {
          console.log('mouseenter', taskId);
          if (!isTouchDevice()) {
            gantt.show_popup({ task, target_element: bar });
            popupOpenId = taskId;

            // Immediately reposition if it would overflow below
            requestAnimationFrame(() => {
              const popup = document.querySelector('.popup-wrapper');
              if (!popup) return;

              const rect = popup.getBoundingClientRect();
              const containerRect = document
                .getElementById('gantt-target')
                .getBoundingClientRect();

              console.log('rect', rect);
              console.log('containerRect', containerRect);

              // If the popup's bottom edge goes beyond viewport bottom, flip it up:
              if (rect.bottom > containerRect.bottom) {
                // Determine how much to move up: 
                // 1) popup’s height 
                // 2) plus the bar’s height (so it doesn’t cover the bar)
                const popupHeight = rect.height;
                const barRect = bar.getBoundingClientRect();
                const barHeight = barRect.height;

                // Current top (px) as a number:
                const currentTop = parseFloat(popup.style.top || 0);

                // Move the popup higher and to the left
                popup.style.top = (currentTop - popupHeight/2 - barHeight) + 'px';
                popup.style.left = (barRect.left - popup.offsetWidth/1.5) + 'px';
              }
            });
          }
        });
        bar.addEventListener('mouseleave', () => {
          console.log('mouseleave', taskId);
          if (!isTouchDevice()) {
            gantt.hide_popup();
            popupOpenId = null;
          }
        });
    
        // 📱 Mobile: Tap once to show, tap again to close
        bar.addEventListener('click', e => {
          if (isTouchDevice()) {
            e.stopPropagation(); // prevent bubbling to document
            if (popupOpenId === taskId) {
              gantt.hide_popup();
              popupOpenId = null;
            } else {
              gantt.show_popup(task);
              popupOpenId = taskId;
            }
          }
        });
      });
    
      // 📱 Mobile: Tap outside to hide
      document.addEventListener('click', e => {
        if (popupOpenId && isTouchDevice()) {
          const popup = document.querySelector('.details-container');
          if (popup && !popup.contains(e.target)) {
            gantt.hide_popup();
            popupOpenId = null;
          }
        }
      });
    
      // Helper to detect touch devices
      function isTouchDevice() {
        return window.matchMedia('(pointer: coarse)').matches;
      }
    });
    

    /* ────────────────────────────────────────────────────────────────────────
       4 · Trim whitespace below bars by resizing SVG to its content height
       ──────────────────────────────────────────────────────────────────────── */
    setTimeout(() => {
      const svg = document.querySelector('#gantt-target svg');
      if (!svg) return;
      const bbox = svg.getBBox();
      svg.setAttribute('height', bbox.height);
      document.getElementById('gantt-target').style.height = bbox.height + 'px';
    }, 0);

    /* ────────────────────────────────────────────────────────────────────────
       5 · Prevent horizontal scroll/pan on wheel or touch
       ──────────────────────────────────────────────────────────────────────── */
    const ganttTarget = document.getElementById('gantt-target');
    if (ganttTarget) {
      ganttTarget.addEventListener(
        'wheel',
        e => {
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.preventDefault();
        },
        { passive: false }
      );

      let lastTouchX = null;
      ganttTarget.addEventListener('touchstart', e => {
        if (e.touches.length === 1) lastTouchX = e.touches[0].clientX;
      });
      ganttTarget.addEventListener(
        'touchmove',
        e => {
          if (e.touches.length === 1 && lastTouchX !== null) {
            const deltaX = e.touches[0].clientX - lastTouchX;
            if (Math.abs(deltaX) > 0) e.preventDefault();
          }
        },
        { passive: false }
      );
    }
  });
})();

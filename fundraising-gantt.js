  /* foam-gantt.js
    ----------------------------------------------------
    Month view (3×350px), truly read-only, hover pop-ups, no scroll/pan,
    trims bottom whitespace. Must load **after** frappe-gantt.min.js.
  */

  // Check if is mobile
  const isMobile = window.innerWidth < 600;

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
      { id:'dd',      name:'Legal & Financial Due Diligence   ', duration:40, progress:0,
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
      
      /* Disable all editing/dragging */
      let draggable = isMobile ? true : false;
      let column_width = isMobile ? 50 : 350;
      let padding = isMobile ? 6 : 18;

      const gantt = new Gantt('#gantt-target', tasks, {
        /* Month view: one column = a calendar month */
        view_mode   : 'Month',

        /* Fix the grid exactly from firstDate to lastDate */
        start_date: firstDate,
        end_date  : lastDate,

        readonly:           true,
        readonly_dates:     true,
        readonly_progress:  true,
        draggable:          draggable,
        column_width:       column_width,
        padding:            padding,

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
              <p class="task-dates">
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
      }
    
    
    );

      /* ──────────────────────────────────────────────────────────────────────────────
        Adjust svg column width via monkey-patching
        ────────────────────────────────────────────────────────────────────────────── */
      
      // Now we "fix" the SVG so that everything is scaled down:
      if (isMobile) {
        setTimeout(() => {
        // 1) Grab the <svg> that Gantt just inserted
        const svg = document.querySelector('#gantt-target svg');
        if (!svg) return;

        // 2) Compute its intrinsic bounding‐box (in SVG user‐units)
        //    Note: getBBox() measures the union of all child elements' extents.
        const bbox = svg.getBBox();
        const intrinsicWidth  = bbox.width;
        const intrinsicHeight = bbox.height;
        console.log('intrinsicWidth', intrinsicWidth);
        console.log('intrinsicHeight', intrinsicHeight);

        // Define useful constant
        const ganttWidth = 300;

        // 3) Give the SVG a viewBox that matches exactly its "real" content bounds:
        //    viewBox="0 0 [intrinsicWidth] [intrinsicHeight]"
        svg.setAttribute('viewBox', `${ganttWidth * 2} 0 ${ganttWidth * 2} ${intrinsicHeight}`);

        // 4) Now reduce the <svg> to whatever final pixel width you want (e.g. 300px).
        //    The browser will automatically scale the entire chart down to fit.
        svg.setAttribute('width', ganttWidth);

        // 5) Remove any hard‐coded height attribute so that height is scaled
        //    proportionally (viewBox preserves aspect ratio by default).
        svg.removeAttribute('height');
        svg.style.height = 'auto';

        // Find the <g class="grid"> group that contains <rect class="grid-background">,Rows,Header,etc.
        const dateGroup = svg.querySelector('g.date');
        if (dateGroup) {
          // Push it down by, say, 7px so the first row moves from y=53 → y=60
          dateGroup.setAttribute('transform', 'translate(0, -7)');
        }
        const gridHeader = svg.querySelector('rect.grid-header');
        if (gridHeader) {
          gridHeader.setAttribute('height', 50);
        }
        // 6) If you'd prefer "shrink‐to‐fit" inside #gantt-target, you can also force:
        //    svg.style.maxWidth = '100%';
        //    svg.style.height   = 'auto';

        // 7) Optionally, allow horizontal scroll if you want a scrollable 300px‐canvas:
        const wrapper = document.getElementById('gantt-target');
        if (wrapper) {
          wrapper.style.overflowX = 'auto';
          wrapper.style.overflowY = 'hidden';
        }

        hidePopupWrapper();
      }, 0);
    }

      /* ────────────────────────────────
        Implement the popup system
      ──────────────────────────────── */
       // Helper to detect touch devices
      // Helper: detect touch‐device (mobile/tablet)
function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches;
}

// ────────────────────────────────────────────────────────────────
// Hide the popup by adding our "hidden" class (so it goes offscreen).
// Must be called *after* gantt.hide_popup().
// ────────────────────────────────────────────────────────────────
function hidePopupWrapper() {
  const wrapper = document.querySelector('.popup-wrapper');
  if (!wrapper) return;
  wrapper.classList.add('hidden');
}

// ────────────────────────────────────────────────────────────────
// Show and position the popup over (or centered in) #gantt-target.
// Must be called *after* gantt.show_popup({ task, target_element: bar }).
// ────────────────────────────────────────────────────────────────
function showPopupWrapper(barElement) {
  const wrapper = document.querySelector('.popup-wrapper');
  const container = document.getElementById('gantt-target');
  if (!wrapper || !container) return;

  // Unhide the wrapper (it should already have .hidden)
  wrapper.classList.remove('hidden');
  // Make sure it's invisible & non-interactive until we position it:
  wrapper.style.opacity       = '0';
  wrapper.style.pointerEvents = 'none';

  // Next animation frame: measure and position
  requestAnimationFrame(() => {
    // Measure the popup's size:
    const popupRect     = wrapper.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    let leftWrapper, topWrapper;
    console.log('popupRect', popupRect);
    console.log('containerRect', containerRect);
    const barRect = barElement.getBoundingClientRect();
    console.log('barRect', barRect);

    if (popupRect.bottom > containerRect.bottom || popupRect.right > containerRect.right) {
      const popupHeight = popupRect.height;
      const barRect = barElement.getBoundingClientRect();
      const barHeight = barRect.height;
      const barRectHCenter = barRect.left + (barRect.right - barRect.left)/2

      // Calculate top position
      topWrapper = barRect.top - containerRect.top - popupHeight - 10; // 10px gap above the bar

      // If the popup would go above the container, position it below the bar
      if (topWrapper < 0) {
        topWrapper = barRect.bottom - containerRect.top + 10; // 10px gap below the bar
      }

      // Calculate left position to center the popup over the bar
      let newLeft = barRectHCenter + containerRect.left
      console.log('newLeft', newLeft);
      // Clamp so we never spill off the left edge:
      if (newLeft < 0) newLeft = 10; // Small margin from left edge

      // And clamp off the right edge:
      // if (newLeft + popupRect.width > containerRect.width + containerRect.left) {
      //   newLeft = containerRect.right - popupRect.width/2 - 10; // Small margin from right edge
      // }

      leftWrapper = newLeft;
      console.log('leftWrapper', leftWrapper);
      console.log('topWrapper', topWrapper );
      console.log('barRectHCenter', barRectHCenter);
      console.log('popupRect', popupRect);
      console.log('barRect', barRect);
      console.log('containerRect', containerRect);
    }

    // 3) Apply the inline styles and finally show it
    wrapper.style.left          = leftWrapper + 'px';
    wrapper.style.top           = topWrapper  + 'px';
    wrapper.style.opacity       = '1';
    wrapper.style.pointerEvents = 'auto';
  });
}


// ────────────────────────────────────────────────────────────────
// Prime + hover/tap logic (drop-in replacement).
// ────────────────────────────────────────────────────────────────
setTimeout(() => {
  const bars = document.querySelectorAll('.bar-wrapper');
  if (!bars.length) return;

  // Prime Gantt's popup system once
  bars[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  gantt.hide_popup();
  hidePopupWrapper();

  let popupOpenId = null;

  bars.forEach(bar => {
    const taskId = bar.getAttribute('data-id');
    if (!taskId) return;
    const task = gantt.get_task(taskId);

    // ─── Desktop: Hover in/out ──────────────────────────
    bar.addEventListener('mouseenter', () => {
      if (!isTouchDevice()) {
        gantt.show_popup({ task, target_element: bar });
        showPopupWrapper(bar);
        popupOpenId = taskId;
      }
    });
    bar.addEventListener('mouseleave', () => {
      if (!isTouchDevice()) {
        gantt.hide_popup();
        hidePopupWrapper();
        popupOpenId = null;
      }
    });

    // ─── Mobile: Tap to toggle ─────────────────────────
    bar.addEventListener('click', e => {
      if (!isTouchDevice()) return;
      e.stopPropagation();

      if (popupOpenId === taskId) {
        // Already open → hide
        gantt.hide_popup();
        hidePopupWrapper();
        popupOpenId = null;
        return;
      }

      // Otherwise: show & reposition
      gantt.show_popup({ task, target_element: bar });
      showPopupWrapper(bar);
      popupOpenId = taskId;
    });
  });

  // Tap outside to hide (mobile only)
  document.addEventListener('click', e => {
    if (popupOpenId && isTouchDevice()) {
      const details = document.querySelector('.details-container');
      if (details && !details.contains(e.target)) {
        gantt.hide_popup();
        hidePopupWrapper();
        popupOpenId = null;
      }
    }
  });
});


      

      /* ────────────────────────────────────────────────────────────────────────
        4 · Trim whitespace below bars by resizing SVG to its content height
        ──────────────────────────────────────────────────────────────────────── */
      setTimeout(() => {
        const svg = document.querySelector('#gantt-target svg');
        if (!svg || isMobile) return;
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

/* foam-gantt.js
   Desktop: unchanged.
   Mobile: fit the whole process (first bar → last bar) with tiny pads,
           center popup, clamp labels so their END kisses the bar's LEFT.
*/

const isMobile = window.innerWidth < 1000;

;(function () {
  /* 1 · Date-format helper */
  const today = new Date();
  const fmt   = d => d.toISOString().slice(0, 10);   // "YYYY-MM-DD"

  /* 2 · Task definitions (unchanged) */
  const taskDefs = [
    { id:'prep',    name:'Deck & Data Room Prep',        duration:14, progress:0,
      custom:{ info:'Finalize internal assessment, narrative and data pack'} },
    { id:'io',      name:'Investor Outreach',             duration:10, progress:0,
      custom:{ info:'Warm Intros, Data Room Access and Management Calls'} },
    { id:'qna',     name:'Investor Analysis & Q&A',       duration:25, progress:0,
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

  /* 3 · Initialize on DOMContentLoaded */
  document.addEventListener('DOMContentLoaded', () => {
    // Lock grid to first/last task dates
    const firstDate = tasks.reduce((a, t) => (t.start < a ? t.start : a), tasks[0].start);
    const lastDate  = tasks.reduce((a, t) => (t.end   > a ? t.end   : a), tasks[0].end);

    const column_width = isMobile ? 50 : 350;
    const padding      = isMobile ? 6  : 18;

    const gantt = new Gantt('#gantt-target', tasks, {
      view_mode  : 'Month',
      start_date : firstDate,
      end_date   : lastDate,

      readonly:           true,
      readonly_dates:     true,
      readonly_progress:  true,
      draggable:          false,

      column_width,
      padding,

      view_modes: ['Day', 'Week', 'Month', 'Year'],

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

      on_click          : () => {},
      on_date_change    : () => {},
      on_progress_change: () => {}
    });

    // ─────────────────────────────────────────────────────────
    // MOBILE-ONLY viewport + label clamping
    // ─────────────────────────────────────────────────────────
    if (isMobile) {
      setTimeout(() => {
        const svg = document.querySelector('#gantt-target svg');
        if (!svg) return;

        // Month width from header (median spacing)
        const monthXs = Array.from(svg.querySelectorAll('g.date text.lower-text'))
          .map(t => parseFloat(t.getAttribute('x')))
          .filter(Number.isFinite)
          .sort((a,b)=>a-b);

        let monthWidth = 0;
        if (monthXs.length >= 2) {
          const diffs = [];
          for (let i = 1; i < monthXs.length; i++) {
            const d = monthXs[i] - monthXs[i-1];
            if (d > 0) diffs.push(d);
          }
          diffs.sort((a,b)=>a-b);
          monthWidth = diffs[Math.floor(diffs.length/2)] || 0;
        }
        if (!monthWidth) monthWidth = column_width * 2.48; // robust fallback

        // Horizontal extents of all bars
        const bars = Array.from(svg.querySelectorAll('rect.bar'));
        const firstBarX    = bars.length ? Math.min(...bars.map(r => parseFloat(r.getAttribute('x')) || 0)) : 0;
        const lastBarRight = bars.length ? Math.max(...bars.map(r => {
          const x = parseFloat(r.getAttribute('x')) || 0;
          const w = parseFloat(r.getAttribute('width')) || 0;
          return x + w;
        })) : 0;

        // Pads (in SVG units): ~12% month left, ~6% right
        const LEFT_PAD_PX  = 0.12 * monthWidth;
        const RIGHT_PAD_PX = 0.06 * monthWidth;

        // Intrinsic content size
        const bboxAll = svg.getBBox();
        const intrinsicWidth  = bboxAll.width;
        const intrinsicHeight = bboxAll.height;

        // Horizontal viewport: cover whole process with pads
        let xOffset      = Math.max(0, firstBarX - LEFT_PAD_PX);
        let visibleWidth = Math.min(
          intrinsicWidth - xOffset,
          (lastBarRight - firstBarX) + LEFT_PAD_PX + RIGHT_PAD_PX
        );

        // Vertical crop: keep header, trim below last bar
        const headerRect   = svg.querySelector('rect.grid-header');
        const headerHeight = headerRect ? parseFloat(headerRect.getAttribute('height')) : 60;
        const barsGroup    = svg.querySelector('g.bar');

        let yOffset = 0;
        let visibleHeight = intrinsicHeight;
        if (barsGroup) {
          const bb  = barsGroup.getBBox();
          const pad = 8;
          const bottom = Math.min(intrinsicHeight, bb.y + bb.height + pad);
          visibleHeight = Math.max(headerHeight + 1, bottom - yOffset);
        }

        // Apply viewport and left anchor
        svg.setAttribute('viewBox', `${xOffset} ${yOffset} ${visibleWidth} ${visibleHeight}`);
        svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');

        // Header tweaks (as before)
        const dateGroup = svg.querySelector('g.date');
        if (dateGroup) dateGroup.setAttribute('transform', 'translate(0, -7)');
        if (headerRect) headerRect.setAttribute('height', 50);

        // Run clamping after layout/scale has settled
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            clampLabelsToViewport(svg, xOffset, visibleWidth);
          });
        });

        // Keep height auto for correct aspect (CSS keeps width:100% on mobile)
        svg.removeAttribute('height');
        svg.style.height = 'auto';

        // Avoid accidental horizontal scroll on mobile
        const wrapper = document.getElementById('gantt-target');
        if (wrapper) {
          wrapper.style.overflowX = 'hidden';
          wrapper.style.overflowY = 'hidden';
        }

        // Re-clamp on orientation / resize (mobile only)
        const reclamp = () => {
          const s = document.querySelector('#gantt-target svg');
          if (s) clampLabelsToViewport(s, xOffset, visibleWidth);
        };
        window.addEventListener('resize', reclamp);
        window.addEventListener('orientationchange', reclamp);

        hidePopupWrapper();
      }, 0);
    }

    /* ────────────────────────────────
       Popup system (desktop unchanged; mobile centered)
    ──────────────────────────────── */
    function isTouchDevice() {
      return window.matchMedia('(pointer: coarse)').matches;
    }
    function hidePopupWrapper() {
      const wrapper = document.querySelector('.popup-wrapper');
      if (!wrapper) return;
      wrapper.classList.add('hidden');
    }

    // Centered on mobile; original behavior on desktop
    function showPopupWrapper(barElement) {
      const wrapper   = document.querySelector('.popup-wrapper');
      const container = document.getElementById('gantt-target');
      if (!wrapper || !container) return;
    
      wrapper.classList.remove('hidden');
      wrapper.style.opacity       = '0';
      wrapper.style.pointerEvents = 'none';
    
      requestAnimationFrame(() => {
        const containerRect = container.getBoundingClientRect();
        const barRect       = barElement.getBoundingClientRect();
    
        if (window.matchMedia('(pointer: coarse)').matches) {
          // MOBILE: centered (kept exactly as in your working version, with slight left nudge)
          const cx = containerRect.left + containerRect.width  / 2;
          const cy = containerRect.top  + containerRect.height / 2;
          const nudgeLeft = 16;
    
          wrapper.style.left      = (cx - nudgeLeft) + 'px';
          wrapper.style.top       = cy + 'px';
          wrapper.style.transform = 'translate(-50%, -50%)';
        } else {
          // DESKTOP: near-bar position (unchanged)
          const popupRect    = wrapper.getBoundingClientRect();
          const popupHeight  = popupRect.height;
          const barCenterX   = barRect.left + (barRect.right - barRect.left) / 2;
    
          let topWrapper  = barRect.top - containerRect.top - popupHeight - 10;
          if (topWrapper < 0) topWrapper = barRect.bottom - containerRect.top + 10;
    
          let leftWrapper = barCenterX + containerRect.left;
          if (leftWrapper < 0) leftWrapper = 10;
    
          wrapper.style.left      = leftWrapper + 'px';
          wrapper.style.top       = topWrapper  + 'px';
          wrapper.style.transform = 'none';
    
          // Right-edge clamp (adds a small margin so it never touches the border)
          const RIGHT_MARGIN = 12; // px breathing room from right edge
          const LEFT_MARGIN  = 8;  // optional safety on the left
    
          const now = wrapper.getBoundingClientRect();
    
          // If the popup's right edge would pass the container's right minus margin,
          // nudge it left by exactly the overshoot amount.
          const overshootR = now.right - (containerRect.right - RIGHT_MARGIN);
          if (overshootR > 0) {
            wrapper.style.left = (leftWrapper - overshootR) + 'px';
          }
    
          // Also ensure we don’t clip into the left edge (rare, but symmetrical).
          const after = wrapper.getBoundingClientRect();
          const overshootL = (containerRect.left + LEFT_MARGIN) - after.left;
          if (overshootL > 0) {
            wrapper.style.left = (parseFloat(wrapper.style.left) + overshootL) + 'px';
          }
        }
    
        wrapper.style.opacity       = '1';
        wrapper.style.pointerEvents = 'auto';
      });
    }
    

    setTimeout(() => {
      const bars = document.querySelectorAll('.bar-wrapper');
      if (!bars.length) return;

      // Prime Gantt's popup then hide ours
      bars[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      gantt.hide_popup();
      hidePopupWrapper();

      let popupOpenId = null;

      bars.forEach(bar => {
        const taskId = bar.getAttribute('data-id');
        if (!taskId) return;
        const task = gantt.get_task(taskId);

        // Desktop: Hover in/out
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

        // Mobile: Tap to toggle
        bar.addEventListener('click', e => {
          if (!isTouchDevice()) return;
          e.stopPropagation();

          if (popupOpenId === taskId) {
            gantt.hide_popup();
            hidePopupWrapper();
            popupOpenId = null;
            return;
          }
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

    /* 4 · Trim whitespace below bars — desktop only */
    setTimeout(() => {
      const svg = document.querySelector('#gantt-target svg');
      if (!svg || isMobile) return;
      const bbox = svg.getBBox();
      svg.setAttribute('height', bbox.height);
      document.getElementById('gantt-target').style.height = bbox.height + 'px';
    }, 0);

    /* 5 · Prevent horizontal pan/scroll gestures */
    const ganttTarget = document.getElementById('gantt-target');
    if (ganttTarget) {
      ganttTarget.addEventListener(
        'wheel',
        e => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.preventDefault(); },
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

  // ────────────────────────────────────────────────────────────────
  // Helper: clamp overflowing labels (mobile only)
  // Align label END to the bar's LEFT edge (minus GAP) when it would overflow.
  // ────────────────────────────────────────────────────────────────
  function clampLabelsToViewport(svg, xOffset, visibleWidth) {
    const GAP = 6; // space between text end and the bar's left edge
    const rightLimit = xOffset + visibleWidth - 6; // viewport right edge (SVG units)

    const labels = svg.querySelectorAll('text.bar-label');
    labels.forEach(label => {
      // Save original x once, so we can restore precisely
      if (!label.hasAttribute('data-x-orig')) {
        const x0 = label.getAttribute('x');
        if (x0 !== null) label.setAttribute('data-x-orig', x0);
      }

      const currX = parseFloat(label.getAttribute('x')) || 0;

      // Accurate text width (prefer computed length; fallback to bbox)
      let textW = 0;
      try {
        textW = label.getComputedTextLength
          ? label.getComputedTextLength()
          : label.getBBox().width;
      } catch {
        textW = label.getBBox ? label.getBBox().width : 0;
      }

      const wouldOverflow = currX + textW > rightLimit;
      if (!wouldOverflow) {
        // Restore defaults if previously clamped
        const xOrig = label.getAttribute('data-x-orig');
        if (xOrig !== null) label.setAttribute('x', xOrig);
        label.removeAttribute('text-anchor');
        label.classList.remove('label-clamped');
        return;
      }

      // Find associated bar
      const group = label.closest('.bar-group');
      const bar   = group && group.querySelector('rect.bar');
      if (!bar) return;

      const barX = parseFloat(bar.getAttribute('x')) || 0;

      // We want the label's RIGHT edge at (barX - GAP) → startX = targetRight - textW
      const targetRight = barX - GAP;
      const newX = targetRight - textW;

      // Left-anchored text placed so its right edge meets targetRight
      label.setAttribute('text-anchor', 'start');
      label.setAttribute('x', newX);
      label.classList.add('label-clamped');
    });
  }
})();

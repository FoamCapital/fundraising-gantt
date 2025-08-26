/* foam-gantt.js
   Desktop: hover-only; popup sits to the right of the bar by default and flips left if needed.
   Mobile (Webflow-safe): crop to process, clamp long labels (end-to-bar-left) with smart truncation,
   perfectly center popup on tap, and harden SVG sizing.
*/

const isMobile =
  window.matchMedia('(max-width: 1000px)').matches ||
  window.matchMedia('(pointer: coarse)').matches;

;(function () {
  /* 1 · Date-format helper */
  const today = new Date();
  const fmt   = d => d.toISOString().slice(0, 10);   // "YYYY-MM-DD"

  /* 2 · Task definitions */
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
    // Positioning context for popup (guard in case CSS loads late)
    const containerEl = document.getElementById('gantt-target');
    if (containerEl && getComputedStyle(containerEl).position === 'static') {
      containerEl.style.position = 'relative';
    }

    const firstDate = tasks.reduce((a, t) => (t.start < a ? t.start : a), tasks[0].start);
    const lastDate  = tasks.reduce((a, t) => (t.end   > a ? t.end   : a), tasks[0].end);

    const column_width = isMobile ? 50 : 350;
    const padding      = isMobile ? 6  : 18;

    // Desktop must be hover-only to avoid stray click popups
    const popupTrigger = isMobile ? 'click' : 'mouseenter';

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

      popup_trigger: popupTrigger,

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
        if (!monthWidth) monthWidth = column_width * 2.48; // fallback

        // Horizontal extents of all bars
        const bars = Array.from(svg.querySelectorAll('rect.bar'));
        const firstBarX    = bars.length ? Math.min(...bars.map(r => parseFloat(r.getAttribute('x')) || 0)) : 0;
        const lastBarRight = bars.length ? Math.max(...bars.map(r => {
          const x = parseFloat(r.getAttribute('x')) || 0;
          const w = parseFloat(r.getAttribute('width')) || 0;
          return x + w;
        })) : 0;

        // Pads (in SVG units)
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

        // Let CSS own the rendered size (Webflow-safe)
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width    = '100%';
        svg.style.maxWidth = '100%';
        svg.style.height   = 'auto';
        svg.style.display  = 'block';

        // Header tweaks
        const dateGroup = svg.querySelector('g.date');
        if (dateGroup) dateGroup.setAttribute('transform', 'translate(0, -7)');
        if (headerRect) headerRect.setAttribute('height', 50);

        // Clamp long labels after layout settles
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            clampLabelsToViewport(svg, xOffset, visibleWidth);
          });
        });

        // Hard crop (no horizontal scroll) on mobile
        const wrapper = document.getElementById('gantt-target');
        if (wrapper) {
          wrapper.style.overflowX = 'hidden';
          wrapper.style.overflowY = 'hidden';
        }

        // Re-clamp on orientation / resize
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
       Popup system
    ──────────────────────────────── */
    function isTouchDevice() {
      return window.matchMedia('(pointer: coarse)').matches;
    }
    function hidePopupWrapper() {
      const wrapper = document.querySelector('.popup-wrapper');
      if (!wrapper) return;
      wrapper.classList.add('hidden');
    }

    function showPopupWrapper(barElement) {
      const container = document.getElementById('gantt-target');
      let wrapper   = document.querySelector('.popup-wrapper');
      if (!wrapper || !container) return;

      // Ensure the wrapper is anchored to the container and sits on top
      if (wrapper.parentElement !== container) container.appendChild(wrapper);
      wrapper.style.zIndex = '5';

      wrapper.classList.remove('hidden');
      // Reset any previous transform/pos so measurements are stable
      wrapper.style.transform    = 'none';
      wrapper.style.left         = '0px';
      wrapper.style.top          = '0px';
      wrapper.style.opacity      = '0';
      wrapper.style.pointerEvents= 'none';

      requestAnimationFrame(() => {
        const anchorRect = container.getBoundingClientRect();
        const barRect    = barElement.getBoundingClientRect();                 // wrapper (for vertical, unchanged)
        const barRectOnly = (barElement.querySelector('rect.bar')?.getBoundingClientRect()) || barRect; // actual BAR for horizontal

        if (isTouchDevice()) {
          // MOBILE: perfectly centered
          const leftPx = (anchorRect.width  / 2);
          const topPx  = (anchorRect.height / 2);
          wrapper.style.left      = leftPx + 'px';
          wrapper.style.top       = topPx  + 'px';
          wrapper.style.transform = 'translate(-50%, -50%)';
        } else {
          // DESKTOP: right of BAR by default; flip left if would overflow.
          const popupRect = wrapper.getBoundingClientRect();
          const popupW    = popupRect.width;
          const popupH    = popupRect.height;

          // Vertical (unchanged): above bar else below
          const V_GAP = 10;
          let topPx  = barRect.top - anchorRect.top - popupH - V_GAP;
          if (topPx < 0) topPx = barRect.bottom - anchorRect.top + V_GAP;

          // Horizontal against the BAR (not the label)
          const GAP = 10, LEFT_MARGIN = 8, RIGHT_MARGIN = 12;
          let leftPx = (barRectOnly.right - anchorRect.left) + GAP; // default to the right of the BAR
          if (leftPx + popupW > anchorRect.width - RIGHT_MARGIN) {
            leftPx = (barRectOnly.left - anchorRect.left) - popupW - GAP;      // flip to left of the BAR
          }
          if (leftPx < LEFT_MARGIN) leftPx = LEFT_MARGIN;

          wrapper.style.left      = leftPx + 'px';
          wrapper.style.top       = topPx  + 'px';
          wrapper.style.transform = 'none';
        }

        wrapper.style.opacity       = '1';
        wrapper.style.pointerEvents = 'auto';
      });
    }

    setTimeout(() => {
      const bars = document.querySelectorAll('.bar-wrapper');
      if (!bars.length) return;

      // Prime Frappe's popup then hide it (we use our wrapper)
      bars[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      gantt.hide_popup();
      hidePopupWrapper();

      let popupOpenId = null;

      bars.forEach(bar => {
        const taskId = bar.getAttribute('data-id');
        if (!taskId) return;
        const task = gantt.get_task(taskId);

        // Desktop: Hover in/out (no click behavior)
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

        // Cancel desktop clicks so Frappe doesn't re-open its own popup
        bar.addEventListener('click', e => {
          if (!isTouchDevice()) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          // Mobile: Tap to toggle
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
        }, true); // capture phase to intercept Frappe listener
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
      const tgt = document.getElementById('gantt-target');
      if (tgt) tgt.style.height = bbox.height + 'px';
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
  // End-to-bar-left placement with LEFT clamp + ellipsis fitting.
  // ────────────────────────────────────────────────────────────────
  function clampLabelsToViewport(svg, xOffset, visibleWidth) {
    const GAP = 6;                     // gap between text end and the bar's left edge
    const rightLimit = xOffset + visibleWidth - 6;
    const leftLimit  = xOffset + 4;

    const labels = svg.querySelectorAll('text.bar-label');

    labels.forEach(label => {
      // Save orig x + text for restoration
      if (!label.hasAttribute('data-x-orig')) {
        const x0 = label.getAttribute('x');
        if (x0 !== null) label.setAttribute('data-x-orig', x0);
      }
      if (!label.hasAttribute('data-text-orig')) {
        label.setAttribute('data-text-orig', label.textContent);
      }

      const currX = parseFloat(label.getAttribute('x')) || 0;

      // Measure current width
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
        // restore original if previously clamped
        const xOrig = label.getAttribute('data-x-orig');
        if (xOrig !== null) label.setAttribute('x', xOrig);
        const txtOrig = label.getAttribute('data-text-orig');
        if (txtOrig !== null) label.textContent = txtOrig;
        label.style.removeProperty('text-anchor');  // ← remove inline override
        label.removeAttribute('text-anchor');
        label.classList.remove('label-clamped');
        label.style.removeProperty('fill');
        return;
      }

      // Find associated bar
      const group = label.closest('.bar-group');
      const bar   = group && group.querySelector('rect.bar');
      if (!bar) return;
      const barX = parseFloat(bar.getAttribute('x')) || 0;

      // Target: right edge of the text sits at bar-left minus GAP
      const targetRight = barX - GAP;

      // Anchor by the RIGHT edge so we "kiss" the bar precisely
      label.setAttribute('x', targetRight);
      label.style.setProperty('text-anchor', 'end', 'important'); // ← force over Frappe CSS
      label.setAttribute('text-anchor', 'end');                   // (backup presentation attr)

      // Ensure dark color / no internal white style
      label.classList.add('label-clamped');
      label.classList.remove('big');
      label.style.fill = 'var(--text-dark)';

      // If the left edge would go past the viewport's leftLimit, truncate
      const original = label.getAttribute('data-text-orig') || label.textContent;

      const leftEdge = () => {
        try {
          const w = label.getSubStringLength
            ? label.getSubStringLength(0, label.textContent.length)
            : (label.getBBox ? label.getBBox().width : 0);
          return targetRight - w;
        } catch {
          return targetRight - (label.getBBox ? label.getBBox().width : 0);
        }
      };

      if (leftEdge() < leftLimit && label.getSubStringLength) {
        let lo = 0, hi = original.length, fit = original;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const candidate = original.slice(0, mid) + (mid < original.length ? '…' : '');
          label.textContent = candidate;
          const w = label.getSubStringLength(0, candidate.length);
          if (targetRight - w >= leftLimit) {
            fit = candidate;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        label.textContent = fit;
      } else if (leftEdge() < leftLimit) {
        // Fallback if precise measuring isn't available
        label.textContent = '…';
      }
    });
  }
})();

/* foam-gantt.js
   Desktop: hover-only; popup sits to the right of the BAR by default and flips left if needed.
   Mobile (Webflow-safe): crop to process, clamp long labels (end-to-bar-left) with smart truncation,
   perfectly center popup on tap, and harden SVG sizing.

   Changes vs your reference:
   - Desktop: viewBox is cropped so the LEFT edge starts exactly 10 days before the first BAR.
     We compute global coords via getBBox(), lock px/day from header, and set BOTH x and width.
   - Add: extend the right edge by configurable EXTRA DAYS (variable name: "extra-days").
   - “Expected closing” still snaps to the rightmost bar-wrapper.
*/

const isMobile =
  window.matchMedia('(max-width: 1000px)').matches ||
  window.matchMedia('(pointer: coarse)').matches;

;(function () {
  // --- helpers (dates + edge labels + mobile vertical fix) ---
  const pad = n => String(n).padStart(2, '0');
  const formatDDMMYYYY = d => `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  const monthBucket = d => {
    const day = d.getDate();
    const bucket = day <= 10 ? 'early' : (day <= 20 ? 'mid' : 'late');
    const mon = d.toLocaleString('en-US', { month: 'short' });
    return `${bucket} ${mon} '${String(d.getFullYear()).slice(-2)}`;
  };

  // px/day from Month header (median inter-month spacing). Month ≈ 30.4 d.
  function pxPerDayFromHeader(svg) {
    const xs = Array.from(svg.querySelectorAll('g.date text.lower-text'))
      .map(t => parseFloat(t.getAttribute('x')))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

    if (xs.length < 2) return null;
    const diffs = [];
    for (let i = 1; i < xs.length; i++) {
      const d = xs[i] - xs[i - 1];
      if (d > 0) diffs.push(d);
    }
    if (!diffs.length) return null;
    diffs.sort((a, b) => a - b);
    const monthW = diffs[Math.floor(diffs.length / 2)] || 0;
    return monthW ? monthW / 30.4 : null;
  }

  // Global leftmost BAR edge (accounts for group transforms)
  function getFirstBarLeft(svg) {
    let minX = Infinity;
    svg.querySelectorAll('rect.bar').forEach(r => {
      try {
        const x = r.getBBox().x;   // global (root) coords
        if (x < minX) minX = x;
      } catch {}
    });
    return Number.isFinite(minX) ? minX : 0;
  }

  // Global rightmost WRAPPER edge (labels/handles included)
  function getRightmostWrapperX(svg) {
    let right = 0;
    svg.querySelectorAll('g.bar-wrapper').forEach(w => {
      try {
        const bb = w.getBBox();
        const r = bb.x + bb.width;
        if (r > right) right = r;
      } catch {}
    });
    return right;
  }

  // Desktop crop with 10-day left buffer; width reaches rightmost wrapper + extra days.
  let lastVB = { x: null, w: null };
  function cropDesktop(svg, { leftDays = 10, column_width, extraDays = 0 }) {
    const firstLeft = getFirstBarLeft(svg);
    const rightEdge = getRightmostWrapperX(svg);
    if (!Number.isFinite(firstLeft) || !Number.isFinite(rightEdge)) return;

    let dpx = pxPerDayFromHeader(svg);
    if (!dpx || dpx <= 0) dpx = (column_width || 350) / 30.4; // fallback

    // Desired LEFT edge (can’t be < 0)
    const vbX = Math.max(0, firstLeft - leftDays * dpx);

    // Desired WIDTH: cover up to rightmost wrapper + EXTRA days (in px)
    const vbW = Math.max(1, (rightEdge - vbX) + (Math.max(0, extraDays) + 0.25) * dpx);

    const bbox = svg.getBBox();
    const vbY = 0;
    const vbH = bbox.height || 320;

    // tiny guard to avoid oscillations from sub-pixel churn
    const EPS = 0.5;
    if (lastVB.x !== null && Math.abs(lastVB.x - vbX) < EPS &&
        lastVB.w !== null && Math.abs(lastVB.w - vbW) < EPS) {
      return;
    }

    svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');

    // lock pixel size to the chosen window; allow downscale via max-width
    const pxW = Math.ceil(vbW);
    const pxH = Math.ceil(vbH);
    svg.setAttribute('width',  pxW);
    svg.setAttribute('height', pxH);
    svg.style.width    = pxW + 'px';
    svg.style.maxWidth = '100%';
    svg.style.height   = pxH + 'px';
    svg.style.display  = 'block';

    const wrapper = document.getElementById('gantt-target');
    if (wrapper) wrapper.style.overflowX = 'hidden';

    lastVB = { x: vbX, w: vbW };
  }

  // Edge labels using global coords
  function updateEdgeLabels(svg, kickoffDateISO, cashInDateISO) {
    if (!svg) return;
    const dateGroup = svg.querySelector('g.date');
    if (!dateGroup) return;

    dateGroup.querySelectorAll('text.upper-text').forEach(n => n.remove());
    const y = 25;

    // Left = start of "prep" bar (global)
    const prepBar = svg.querySelector('[data-id="prep"] rect.bar');
    if (!prepBar) return;
    const kickoffX = prepBar.getBBox().x;

    // Right = farthest right edge of ANY bar-wrapper (labels included)
    const farRightX = getRightmostWrapperX(svg);

    const cashIn  = new Date(cashInDateISO);

    const t1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t1.setAttribute('class', 'upper-text');
    t1.setAttribute('x', kickoffX);
    t1.setAttribute('y', y);
    t1.setAttribute('text-anchor', 'start');
    t1.style.textAnchor = 'start';
    t1.textContent = `Assuming launch today`;

    const t2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t2.setAttribute('class', 'upper-text');
    t2.setAttribute('x', farRightX);
    t2.setAttribute('y', y);
    t2.setAttribute('text-anchor', 'end');
    t2.style.textAnchor = 'end';
    t2.textContent = `Projected closing in ${monthBucket(cashIn)}`;

    dateGroup.appendChild(t1);
    dateGroup.appendChild(t2);
  }

  // Mobile-only: push each bar to the bottom of its grid row
  function adjustBarVerticalMobile(svg) {
    if (!svg) return;
    const rows = Array.from(svg.querySelectorAll('rect.grid-row'));
    if (!rows.length) return;

    const rowTops = rows.map(r => ({
      y: parseFloat(r.getAttribute('y')) || 0,
      h: parseFloat(r.getAttribute('height')) || 0
    }));

    const bars = svg.querySelectorAll('g.bar-group');
    bars.forEach(group => {
      const bar = group.querySelector('rect.bar');
      const prog = group.querySelector('rect.bar-progress');
      if (!bar) return;

      const y0 = parseFloat(bar.getAttribute('y')) || 0;
      const h  = parseFloat(bar.getAttribute('height')) || 0;

      // nearest row
      let best = rowTops[0], bestDelta = Math.abs(y0 - rowTops[0].y);
      for (let i = 1; i < rowTops.length; i++) {
        const d = Math.abs(y0 - rowTops[i].y);
        if (d < bestDelta) { best = rowTops[i]; bestDelta = d; }
      }

      const GAP_BOTTOM = 3;
      const newY = Math.max(best.y, best.y + best.h - h - GAP_BOTTOM);

      if (Math.abs(newY - y0) > 0.5) {
        bar.setAttribute('y', newY);
        if (prog) prog.setAttribute('y', newY);
      }
    });
  }

  // --- dates and tasks ---
  const today = new Date();
  const fmt   = d => d.toISOString().slice(0, 10);

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

  // --- init ---
  document.addEventListener('DOMContentLoaded', () => {
    const containerEl = document.getElementById('gantt-target');
    if (containerEl && getComputedStyle(containerEl).position === 'static') {
      containerEl.style.position = 'relative';
    }

    const firstDate = tasks.reduce((a, t) => (t.start < a ? t.start : a), tasks[0].start);
    const lastDate  = tasks.reduce((a, t) => (t.end   > a ? t.end   : a), tasks[0].end);

    const column_width = isMobile ? 50 : 350;
    const padding      = isMobile ? 12  : 18;
    const popupTrigger = isMobile ? 'click' : 'mouseenter';

    const gantt = new Gantt('#gantt-target', tasks, {
      view_mode  : 'Month',
      // NOTE: Frappe Gantt ignores custom start_date/end_date for axis extents,
      // so we crop the SVG instead (desktop) after render.
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

    // Edge labels after first paint
    setTimeout(() => {
      const svg = document.querySelector('#gantt-target svg');
      if (svg) updateEdgeLabels(svg, firstDate, lastDate);
    }, 0);

    // ===== DESKTOP: crop so left edge is exactly first BAR - 10 days; extend right by extra-days =====
    if (!isMobile) {
      const extraDays = 15; // <— NEW
      const recrop = () => {
        const svg = document.querySelector('#gantt-target svg');
        if (!svg) return;
        cropDesktop(svg, { leftDays: 10, column_width, extraDays }); // <— pass through
        updateEdgeLabels(svg, firstDate, lastDate);
      };
      // after layout / animations / fonts
      requestAnimationFrame(() => requestAnimationFrame(recrop));
      setTimeout(recrop, 700);
      window.addEventListener('resize', recrop);
    }

    // ===== MOBILE path unchanged (cropped viewport, label clamp, vertical tidy) =====
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
        const firstBarX    = bars.length ? Math.min(...bars.map(r => r.getBBox().x)) : 0;
        const lastBarRight = (function(){
          let mx = 0;
          Array.from(svg.querySelectorAll('g.bar-wrapper')).forEach(w=>{
            try { const bb = w.getBBox(); mx = Math.max(mx, bb.x + bb.width); } catch {}
          });
          return mx;
        })();

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

        // After layout settles, clamp labels, fix bars, and refresh edge labels
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            clampLabelsToViewport(svg, xOffset, visibleWidth);
            adjustBarVerticalMobile(svg);
            updateEdgeLabels(svg, firstDate, lastDate);
          });
        });

        // Hard crop (no horizontal scroll) on mobile
        const wrapper = document.getElementById('gantt-target');
        if (wrapper) {
          wrapper.style.overflowX = 'hidden';
          wrapper.style.overflowY = 'hidden';
        }

        // Re-run on orientation/resize
        const rerun = () => {
          const s = document.querySelector('#gantt-target svg');
          if (!s) return;
          clampLabelsToViewport(s, xOffset, visibleWidth);
          adjustBarVerticalMobile(s);
          updateEdgeLabels(s, firstDate, lastDate);
        };
        window.addEventListener('resize', rerun);
        window.addEventListener('orientationchange', rerun);

        hidePopupWrapper();
      }, 0);
    }

    // Popup system
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

      if (wrapper.parentElement !== container) container.appendChild(wrapper);
      wrapper.style.zIndex = '5';

      wrapper.classList.remove('hidden');
      wrapper.style.transform    = 'none';
      wrapper.style.left         = '0px';
      wrapper.style.top          = '0px';
      wrapper.style.opacity      = '0';
      wrapper.style.pointerEvents= 'none';

      requestAnimationFrame(() => {
        const anchorRect = container.getBoundingClientRect();
        const barRect    = barElement.getBoundingClientRect();
        const barRectOnly = (barElement.querySelector('rect.bar')?.getBoundingClientRect()) || barRect;

        if (isTouchDevice()) {
          const leftPx = (anchorRect.width  / 2);
          const topPx  = (anchorRect.height / 2);
          wrapper.style.left      = leftPx + 'px';
          wrapper.style.top       = topPx  + 'px';
          wrapper.style.transform = 'translate(-50%, -50%)';
        } else {
          const popupRect = wrapper.getBoundingClientRect();
          const popupW    = popupRect.width;
          const popupH    = popupRect.height;

          const V_GAP = 10;
          let topPx  = barRect.top - anchorRect.top - popupH - V_GAP;
          if (topPx < 0) topPx = barRect.bottom - anchorRect.top + V_GAP;

          const GAP = 10, LEFT_MARGIN = 8, RIGHT_MARGIN = 12;
          let leftPx = (barRectOnly.right - anchorRect.left) + GAP;
          if (leftPx + popupW > anchorRect.width - RIGHT_MARGIN) {
            leftPx = (barRectOnly.left - anchorRect.left) - popupW - GAP;
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
        }, true);
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

    // Trim whitespace below bars — desktop only (height ties to content)
    setTimeout(() => {
      const svg = document.querySelector('#gantt-target svg');
      if (!svg || isMobile) return;
      const bbox = svg.getBBox();
      svg.setAttribute('height', bbox.height);
      const tgt = document.getElementById('gantt-target');
      if (tgt) tgt.style.height = bbox.height + 'px';
    }, 0);
  });

  // Helper: clamp overflowing labels (mobile only)
  function clampLabelsToViewport(svg, xOffset, visibleWidth) {
    const GAP = 6;
    const rightLimit = xOffset + visibleWidth - 6;
    const leftLimit  = xOffset + 4;

    const labels = svg.querySelectorAll('text.bar-label');

    labels.forEach(label => {
      if (!label.hasAttribute('data-x-orig')) {
        const x0 = label.getAttribute('x');
        if (x0 !== null) label.setAttribute('data-x-orig', x0);
      }
      if (!label.hasAttribute('data-text-orig')) {
        label.setAttribute('data-text-orig', label.textContent);
      }

      const currX = parseFloat(label.getAttribute('x')) || 0;

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
        const xOrig = label.getAttribute('data-x-orig');
        if (xOrig !== null) label.setAttribute('x', xOrig);
        const txtOrig = label.getAttribute('data-text-orig');
        if (txtOrig !== null) label.textContent = txtOrig;
        label.removeAttribute('text-anchor');
        label.classList.remove('label-clamped');
        label.style.removeProperty('fill');
        return;
      }

      const group = label.closest('.bar-group');
      const bar   = group && group.querySelector('rect.bar');
      if (!bar) return;
      const barX = parseFloat(bar.getAttribute('x')) || 0;

      const targetRight = barX - GAP;

      label.setAttribute('text-anchor', 'end');
      label.setAttribute('x', targetRight);

      label.classList.add('label-clamped');
      label.classList.remove('big');
      label.style.fill = 'var(--text-dark)';

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
        label.textContent = '…';
      }
    });
  }
})();

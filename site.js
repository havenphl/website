/* ==========================================================================
   HAVEN — page behaviour. Vanilla JS, no dependencies.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var logo = document.querySelector('.logo-draw');
  var comic = document.querySelector('.comic');
  var puzzle = document.querySelector('.puzzle');

  /* CSS hides the drawn artwork from the very first paint whenever JS is
     present, so nothing flashes finished in the gap before the animation is
     armed. Anything we cannot animate must therefore be told to show itself.
     The drawing itself waits for a scroll trigger — and on the home page, for
     the notebook cover to be out of the way. */
  var canAnimate = !reduced && 'IntersectionObserver' in window;

  function arm(el) {
    if (!el) return;
    el.classList.add(canAnimate ? 'is-armed' : 'is-shown');
  }
  function reveal(el) {
    if (!el || !el.classList.contains('is-armed')) return;
    el.classList.remove('is-armed');
    el.classList.add('is-shown');
  }

  arm(logo);
  arm(comic);
  arm(puzzle);


  /* --- the notebook opens -------------------------------------------------
     Closed cover holds for a beat, swings open, then the whole thing fades
     and hands the page over. Clicking or pressing a key skips ahead.
     Scroll stays locked until it's done, and every timer has a hard backstop
     so a stalled animation can never trap someone on the cover.
  ------------------------------------------------------------------------- */
  var book = document.getElementById('book');

  function finishOpening() {
    document.body.classList.remove('is-loading');
    if (book && book.parentNode) book.parentNode.removeChild(book);
    document.removeEventListener('keydown', skipOpening);
    window.removeEventListener('click', skipOpening);
    // now the page is actually visible, let the drawings start
    watchLogo();
    watchComic();
    watchPuzzle();
  }

  function skipOpening() {
    if (!book) return;
    book.classList.add('is-open', 'is-gone');
    window.setTimeout(finishOpening, 520);
  }

  // the cover plays on the first page of a visit, then stays out of the way.
  // private browsing can throw on sessionStorage, so treat any failure as
  // "haven't seen it" rather than letting it break the page.
  function alreadySeen() {
    try {
      if (window.sessionStorage.getItem('haven-opened')) return true;
      window.sessionStorage.setItem('haven-opened', '1');
    } catch (e) { /* storage unavailable — just play it */ }
    return false;
  }

  if (!book || reduced || alreadySeen()) {
    finishOpening();
  } else {
    window.setTimeout(function () { book.classList.add('is-open'); }, 900);
    window.setTimeout(function () { book.classList.add('is-gone'); }, 1850);
    window.setTimeout(finishOpening, 2400);

    window.addEventListener('click', skipOpening);
    document.addEventListener('keydown', skipOpening);
  }

  /* --- turning the page ---------------------------------------------------
     Clicking an internal link swings a sheet of looseleaf shut over the screen,
     then navigates. The next page knows it is arriving (sessionStorage, read by
     the inline script in its <head>) so it starts covered and swings the sheet
     away. Every guard below exists so that normal browser behaviour still wins:
     new-tab clicks, downloads, anchors and off-site links are left alone.
  ------------------------------------------------------------------------- */
  var leaf = document.getElementById('leaf');

  function flag(on) {
    try {
      if (on) window.sessionStorage.setItem('haven-turn', '1');
      else window.sessionStorage.removeItem('haven-turn');
    } catch (e) { /* storage unavailable — the leaf just won't play */ }
  }

  // arriving: the page is already covered, so swing the sheet off
  if (leaf && document.documentElement.classList.contains('is-arriving')) {
    flag(false);
    if (reduced) {
      document.documentElement.classList.remove('is-arriving');
    } else {
      leaf.classList.add('is-opening');
      var lift = function () {
        document.documentElement.classList.remove('is-arriving');
        leaf.classList.remove('is-opening');
      };
      leaf.addEventListener('animationend', lift, { once: true });
      window.setTimeout(lift, 1200);          // never leave the page covered
    }
  }

  // leaving: close the sheet, then follow the link
  if (leaf && !reduced) {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      var a = e.target.closest && e.target.closest('a');
      if (!a) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;

      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return;
      if (/^(mailto:|tel:|https?:\/\/)/i.test(href)) {
        // off-site links open normally; same-origin absolute ones may continue
        if (a.origin !== window.location.origin) return;
      }
      if (a.pathname === window.location.pathname && a.hash) return;

      e.preventDefault();
      flag(true);
      leaf.classList.add('is-closing');

      var go = function () { window.location.href = a.href; };
      leaf.addEventListener('animationend', go, { once: true });
      window.setTimeout(go, 700);             // navigate even if the animation stalls
    });
  }

  // coming back via the back button, the page is restored covered — uncover it
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    flag(false);
    document.documentElement.classList.remove('is-arriving');
    if (leaf) leaf.classList.remove('is-closing', 'is-opening');
  });

  /* --- scribbling with the crayon -----------------------------------------
     A canvas over the page catches the pointer's path and draws it in crayon
     green, fading as it goes. It never takes a click (pointer-events: none)
     and only runs where there is a real pointer to follow.
  ------------------------------------------------------------------------- */
  (function scribble() {
    if (reduced) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var canvas = document.createElement('canvas');
    canvas.className = 'scribble';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var marks = [];
    var last = null;

    function size() {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener('resize', size);

    document.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var p = { x: e.clientX, y: e.clientY };
      if (last) {
        var dx = p.x - last.x, dy = p.y - last.y;
        // ignore the tiny jitters so the line stays a line
        if (dx * dx + dy * dy > 4) {
          marks.push({ a: last, b: p, life: 1 });
          last = p;
        }
      } else {
        last = p;
      }
      if (marks.length > 220) marks.shift();
    });

    // a crayon lays down an uneven, slightly grainy line
    function stroke(m) {
      var jitter = function () { return (Math.random() - 0.5) * 1.6; };
      ctx.globalAlpha = m.life * 0.85;
      ctx.strokeStyle = '#5c7f42';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5.5 * m.life + 1.5;
      ctx.beginPath();
      ctx.moveTo(m.a.x + jitter(), m.a.y + jitter());
      ctx.lineTo(m.b.x + jitter(), m.b.y + jitter());
      ctx.stroke();
    }

    (function frame() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (var i = marks.length - 1; i >= 0; i--) {
        marks[i].life -= 0.018;            // about a second and a half to fade
        if (marks[i].life <= 0) { marks.splice(i, 1); continue; }
        stroke(marks[i]);
      }
      if (!marks.length) last = null;      // start a fresh line next time
      window.requestAnimationFrame(frame);
    })();
  })();

  /* --- current year in the footer ---------------------------------------- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* --- the Chronicle masthead dates itself -------------------------------
     The date in the markup is a real one, so a browser without JS still shows
     a sensible masthead rather than a blank. This just brings it up to today.
  ------------------------------------------------------------------------- */
  var npDate = document.getElementById('npDate');
  var npEdition = document.getElementById('npEdition');

  if (npDate || npEdition) {
    var now = new Date();

    if (npDate) {
      try {
        npDate.textContent = now.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        });
      } catch (e) { /* very old browser — leave the printed date alone */ }
    }

    if (npEdition) {
      // meteorological seasons, so the edition turns over on the 1st
      var seasons = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer',
                     'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter'];
      npEdition.textContent = seasons[now.getMonth()] + ' Edition';
    }
  }

  /* --- mobile nav -------------------------------------------------------- */
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');

  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });

    // close after tapping a link
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('is-open')) {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* --- the logo draws itself when it scrolls into view --------------------
     The SVG renders as the finished logo by default. Only if we can actually
     drive the animation do we hide the fills ('is-armed') and then draw them
     on ('is-drawing') — so a browser without IntersectionObserver, or someone
     who prefers less motion, still just sees the logo.
  ------------------------------------------------------------------------- */
  function watchLogo() {
    if (!logo || !logo.classList.contains('is-armed')) return;

    var drawSeen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        logo.classList.remove('is-armed');
        logo.classList.add('is-drawing');
        drawSeen.disconnect();
      });
    }, { threshold: 0.35 });

    drawSeen.observe(logo);

    // if anything stalls, show the finished logo rather than leaving it blank
    window.setTimeout(function () {
      reveal(logo);
    }, 6000);
  }

  /* --- the comic strip inks itself in when it scrolls into view -----------
     Same shape as watchLogo: the CSS does the drawing, this only says when.
  ------------------------------------------------------------------------- */
  function watchComic() {
    if (!comic || !comic.classList.contains('is-armed')) return;

    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        comic.classList.remove('is-armed');
        comic.classList.add('is-drawing');
        seen.disconnect();
      });
    }, { threshold: 0.2 });

    seen.observe(comic);

    // if anything stalls, show the finished strip rather than leaving a hole
    window.setTimeout(function () {
      reveal(comic);
    }, 6000);
  }

  /* --- the partner board assembles itself when it scrolls into view -------
     Same shape as watchComic: the CSS does the moving, this only says when.
  ------------------------------------------------------------------------- */
  function watchPuzzle() {
    if (!puzzle || !puzzle.classList.contains('is-armed')) return;

    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        puzzle.classList.remove('is-armed');
        puzzle.classList.add('is-solving');
        seen.disconnect();
      });
    }, { threshold: 0.25 });

    seen.observe(puzzle);

    // if anything stalls, show the finished board rather than a hole
    window.setTimeout(function () {
      reveal(puzzle);
    }, 6000);
  }

  /* --- scroll reveal ----------------------------------------------------- */
  var revealables = document.querySelectorAll('.reveal');

  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    revealables.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 70 + 'ms';
      io.observe(el);
    });
  }

  /* --- "get involved" buttons prefill the contact form ------------------- */
  var topic = document.getElementById('topic');

  document.querySelectorAll('[data-prefill]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!topic) return;
      topic.value = btn.getAttribute('data-prefill');
      clearError(document.getElementById('field-topic'));
      // let the smooth scroll land before pulling focus
      window.setTimeout(function () {
        var name = document.getElementById('name');
        if (name) name.focus({ preventScroll: true });
      }, 600);
    });
  });

  /* --- contact form ------------------------------------------------------ */
  var form = document.getElementById('contactForm');
  var toast = document.getElementById('toast');
  var toastTimer;

  function showError(field) {
    if (field) field.setAttribute('data-invalid', 'true');
  }
  function clearError(field) {
    if (field) field.removeAttribute('data-invalid');
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
  }

  var checks = [
    { field: 'field-name',    input: 'name',    test: function (v) { return v.trim().length > 1; } },
    { field: 'field-email',   input: 'email',   test: validEmail },
    { field: 'field-topic',   input: 'topic',   test: function (v) { return v !== ''; } },
    { field: 'field-message', input: 'message', test: function (v) { return v.trim().length > 4; } }
  ];

  // clear a field's error as soon as it becomes valid
  checks.forEach(function (check) {
    var input = document.getElementById(check.input);
    if (!input) return;
    var evt = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(evt, function () {
      if (check.test(input.value)) clearError(document.getElementById(check.field));
    });
  });

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var firstBad = null;

      checks.forEach(function (check) {
        var input = document.getElementById(check.input);
        var field = document.getElementById(check.field);
        if (!input) return;

        if (check.test(input.value)) {
          clearError(field);
        } else {
          showError(field);
          if (!firstBad) firstBad = input;
        }
      });

      if (firstBad) {
        firstBad.focus();
        return;
      }

      /* Send it to whatever endpoint the form's action points at (Formspree
         by default). Until that action is filled in, the form still validates
         and thanks the sender, but nothing is transmitted — so the button is
         disabled while sending and the sender is told if it fails. */
      var endpoint = form.getAttribute('action') || '';

      if (endpoint.indexOf('YOUR_FORM_ID') !== -1) {
        form.reset();
        showToast();
        return;
      }

      var button = form.querySelector('[type="submit"]');
      if (button) { button.disabled = true; button.dataset.label = button.textContent; button.textContent = 'sending…'; }

      fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form)
      }).then(function (res) {
        if (!res.ok) throw new Error(res.status);
        form.reset();
        showToast();
      }).catch(function () {
        showToast('that didn\'t send — please email info@havenphl.org instead.');
      }).then(function () {
        if (button) { button.disabled = false; button.textContent = button.dataset.label; }
      });
    });
  }

  function showToast(message) {
    if (!toast) return;
    if (message) toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 4200);
  }
})();

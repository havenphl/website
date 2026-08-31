/* ==========================================================================
   HAVEN — page behaviour. Vanilla JS, no dependencies.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var logo = document.querySelector('.logo-draw');
  var comic = document.querySelector('.comic');
  var puzzle = document.querySelector('.puzzle');

  // Hold the strip hidden only if we can actually draw it on. Any browser
  // without IntersectionObserver, or anyone who prefers less motion, sees the
  // finished strip instead of a blank space.
  if (comic && !reduced && 'IntersectionObserver' in window) {
    comic.classList.add('is-armed');
  }
  if (puzzle && !reduced && 'IntersectionObserver' in window) {
    puzzle.classList.add('is-armed');
  }

  // Hide it straight away so it can't flash in finished, but hold the drawing
  // until watchLogo() is called — on the home page that happens once the
  // notebook cover is out of the way, otherwise the logo would draw itself
  // behind the cover and be over before anyone saw it.
  if (logo && !reduced && 'IntersectionObserver' in window) {
    logo.classList.add('is-armed');
  }


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
      if (logo.classList.contains('is-armed')) logo.classList.remove('is-armed');
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
      if (comic.classList.contains('is-armed')) comic.classList.remove('is-armed');
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
      if (puzzle.classList.contains('is-armed')) puzzle.classList.remove('is-armed');
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

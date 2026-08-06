/* ==========================================================================
   HAVEN — page behaviour. Vanilla JS, no dependencies.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  }

  function skipOpening() {
    if (!book) return;
    book.classList.add('is-open', 'is-gone');
    window.setTimeout(finishOpening, 520);
  }

  if (!book || reduced) {
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

      /* TODO: this is front-end only — no message is sent anywhere yet.
         Point it at Formspree, Netlify Forms, or your own endpoint:

         fetch('https://your-endpoint', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(Object.fromEntries(new FormData(form)))
         });
      */

      form.reset();
      showToast();
    });
  }

  function showToast() {
    if (!toast) return;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 4200);
  }
})();

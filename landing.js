// ============================================================
// JURNAL TRADING — landing hero behavior
// Mobile menu, handoff to the real auth screen, entrance animation.
// Independent of app.js: works even before Firebase has loaded.
// ============================================================
(function () {
  var landing = document.getElementById("landing-shell");
  if (!landing) return;

  var appShell = document.getElementById("app-shell");
  var pendingShell = document.getElementById("pending-shell");
  var authToggleBtn = document.getElementById("auth-toggle-btn");

  // ---------- Handoff: dismiss the hero, reveal the real auth card ----------
  function dismiss(mode) {
    if (mode === "register" && authToggleBtn && /Daftar/.test(authToggleBtn.textContent)) {
      authToggleBtn.click();
    }
    landing.classList.add("lp-leaving");
    window.setTimeout(function () {
      landing.classList.add("hidden");
    }, 440);
  }

  var actionEls = landing.querySelectorAll("[data-lp-action]");
  for (var i = 0; i < actionEls.length; i++) {
    actionEls[i].addEventListener("click", function (e) {
      e.preventDefault();
      dismiss(this.getAttribute("data-lp-action"));
    });
  }

  // If the user already has a live session, app.js will reveal app-shell
  // or pending-shell shortly after Firebase resolves — get out of the way
  // immediately instead of making them click through the hero.
  function watch(el) {
    if (!el || !window.MutationObserver) return;
    var obs = new MutationObserver(function () {
      if (!el.classList.contains("hidden")) {
        landing.classList.add("hidden");
        obs.disconnect();
      }
    });
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
  }
  watch(appShell);
  watch(pendingShell);

  // ---------- Mobile menu sheet ----------
  var bar = document.getElementById("lp-bar");
  var menuBtn = document.getElementById("lp-menu-btn");
  if (bar && menuBtn) {
    var setOpen = function (open) {
      bar.dataset.open = open ? "true" : "false";
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.setAttribute("aria-label", open ? "Tutup menu" : "Menu");
    };
    setOpen(false);
    menuBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(bar.dataset.open !== "true");
    });
    document.addEventListener("click", function (e) {
      if (bar.dataset.open === "true" && !bar.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  // ---------- Entrance animation ----------
  var html = document.documentElement;
  if (html.classList.contains("intro")) {
    var started = false;
    function start() {
      if (started) return;
      started = true;
      html.classList.add("intro-play");

      var cleaned = false;
      function cleanup() {
        if (cleaned) return;
        cleaned = true;
        html.classList.remove("intro", "intro-play");
      }

      var ctaBtns = landing.querySelectorAll(".lp-cta .lp-btn");
      var lastBtn = ctaBtns[ctaBtns.length - 1];
      if (lastBtn) {
        lastBtn.addEventListener("animationend", function handler(e) {
          if (e.target !== lastBtn) return;
          lastBtn.removeEventListener("animationend", handler);
          cleanup();
        });
      }
      window.setTimeout(cleanup, 3000);
    }

    var run = function () {
      requestAnimationFrame(function () {
        requestAnimationFrame(start);
      });
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(run).catch(run);
      window.setTimeout(run, 700);
    } else {
      run();
    }
  }
})();

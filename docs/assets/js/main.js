/* Page behaviour: language switch, GSAP reveals, hero typer, nav, tabs, copy buttons and the live star count. */
(function () {
  "use strict";

  var REPO = "Pinyi333/cavalry-mcp";
  var STORAGE_KEY = "cavalry-mcp-lang";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var i18n = window.CavalryI18n || { zh: {}, prompts: { en: [], zh: [] } };
  var lang = "en";

  document.documentElement.classList.add("js");

  /* ---------- Storage (may be blocked in private windows) ---------- */

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch {
      return null;
    }
    return null;
  }

  /* ---------- Language ---------- */

  var english = {};

  function captureEnglish() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (!(key in english)) english[key] = el.innerHTML.trim();
    });
    english.copied = "Copied";
  }

  function t(key) {
    var table = lang === "zh" ? i18n.zh : english;
    return table[key] !== undefined ? table[key] : english[key];
  }

  function setLang(next, persist) {
    lang = next === "zh" ? "zh" : "en";
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var value = t(el.getAttribute("data-i18n"));
      if (value !== undefined) el.innerHTML = value;
    });
    document.querySelectorAll("[data-lang-opt]").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-lang-opt") === lang);
    });
    if (persist) store(STORAGE_KEY, lang);
    typer.restart();
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  function initialLang() {
    var param = new URLSearchParams(window.location.search).get("lang");
    if (param) return param.indexOf("zh") === 0 ? "zh" : "en";
    var saved = store(STORAGE_KEY);
    if (saved) return saved;
    return (navigator.language || "").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
  }

  /* ---------- Hero prompt typer ---------- */

  var typer = (function () {
    var el = document.querySelector("[data-typer]");
    var timer = null;
    var index = 0;

    function list() {
      return i18n.prompts[lang] || i18n.prompts.en || [];
    }

    function type(text, i) {
      el.textContent = text.slice(0, i);
      if (i < text.length) {
        timer = setTimeout(type, 22 + Math.random() * 38, text, i + 1);
      } else {
        timer = setTimeout(erase, 2600, text, text.length);
      }
    }

    function erase(text, i) {
      el.textContent = text.slice(0, i);
      if (i > 0) {
        timer = setTimeout(erase, 10, text, i - 1);
      } else {
        index = (index + 1) % list().length;
        timer = setTimeout(type, 400, list()[index], 0);
      }
    }

    return {
      restart: function () {
        if (!el || !list().length) return;
        clearTimeout(timer);
        index = 0;
        if (reduceMotion) {
          el.textContent = list()[0];
        } else {
          type(list()[0], 0);
        }
      },
    };
  })();

  /* ---------- Navigation: solid on scroll, hide while scrolling down ---------- */

  function initNav() {
    var nav = document.querySelector("[data-nav]");
    var last = 0;
    window.addEventListener(
      "scroll",
      function () {
        var y = window.scrollY;
        nav.classList.toggle("is-scrolled", y > 40);
        nav.classList.toggle("is-hidden", y > last && y > 400);
        last = y;
      },
      { passive: true },
    );
  }

  /* ---------- Tabs ---------- */

  function initTabs() {
    document.querySelectorAll("[data-tabs]").forEach(function (root) {
      var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
      function select(tab) {
        tabs.forEach(function (other) {
          var on = other === tab;
          other.setAttribute("aria-selected", String(on));
          other.tabIndex = on ? 0 : -1;
          document.getElementById(other.getAttribute("aria-controls")).hidden = !on;
        });
      }
      tabs.forEach(function (tab, i) {
        tab.tabIndex = i === 0 ? 0 : -1;
        tab.addEventListener("click", function () {
          select(tab);
        });
        tab.addEventListener("keydown", function (e) {
          var dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!dir) return;
          var next = tabs[(i + dir + tabs.length) % tabs.length];
          next.focus();
          select(next);
        });
      });
    });
  }

  /* ---------- Copy buttons ---------- */

  function initCopy() {
    document.querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var code = btn.parentElement.querySelector("code").textContent;
        var done = function () {
          btn.textContent = t("copied");
          btn.classList.add("is-done");
          setTimeout(function () {
            btn.textContent = t("copy");
            btn.classList.remove("is-done");
          }, 1600);
        };
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code).then(done, function () {});
        }
      });
    });
  }

  /* ---------- Live GitHub star count ---------- */

  function initStars() {
    if (!window.fetch) return;
    fetch("https://api.github.com/repos/" + REPO)
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        if (!data || typeof data.stargazers_count !== "number") return;
        var n = data.stargazers_count;
        var label = n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);
        document.querySelectorAll("[data-star-count]").forEach(function (el) {
          el.textContent = label;
          el.hidden = false;
        });
      })
      .catch(function () {});
  }

  /* ---------- GSAP motion ---------- */

  function initMotion() {
    var gsap = window.gsap;
    if (!gsap || reduceMotion) {
      document.querySelectorAll("[data-reveal]").forEach(function (el) {
        el.style.opacity = 1;
      });
      return;
    }
    gsap.registerPlugin(window.ScrollTrigger);

    // Hero intro.
    var intro = gsap.timeline({ defaults: { ease: "expo.out" } });
    intro
      .from(".hero__title .line > *", { yPercent: 110, duration: 1.4, stagger: 0.12 }, 0.15)
      .to(".hero [data-reveal]", { opacity: 1, duration: 1 }, 0.6)
      .from(".hero [data-reveal]", { y: 24, duration: 1.2, stagger: 0.08 }, 0.6)
      .from(".hero__canvas", { opacity: 0, scale: 1.08, duration: 2.2 }, 0)
      .from(".nav", { opacity: 0, duration: 1 }, 0.4);

    // Section titles: masked line reveals.
    gsap.utils.toArray("[data-split]").forEach(function (title) {
      if (title.closest(".hero")) return;
      gsap.from(title.querySelectorAll(".line > *"), {
        yPercent: 110,
        duration: 1.2,
        ease: "expo.out",
        stagger: 0.1,
        scrollTrigger: { trigger: title, start: "top 85%" },
      });
    });

    // Generic fade-up reveals.
    gsap.utils.toArray("[data-reveal]").forEach(function (el) {
      if (el.closest(".hero")) return;
      gsap.fromTo(
        el,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 1.1,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        },
      );
    });

    // Demo media: clip-path wipe plus a gentle parallax.
    gsap.utils.toArray(".demo").forEach(function (demo) {
      var media = demo.querySelector(".demo__media");
      var body = demo.querySelector(".demo__body");
      gsap.fromTo(
        media,
        { clipPath: "inset(12% 12% 12% 12% round 18px)" },
        {
          clipPath: "inset(0% 0% 0% 0% round 18px)",
          ease: "power2.out",
          scrollTrigger: { trigger: demo, start: "top 90%", end: "top 35%", scrub: 0.6 },
        },
      );
      gsap.from(body.children, {
        opacity: 0,
        y: 30,
        duration: 0.9,
        stagger: 0.07,
        ease: "power3.out",
        scrollTrigger: { trigger: demo, start: "top 70%" },
      });
    });

    // Counters on the principles row.
    gsap.utils.toArray("[data-count]").forEach(function (el) {
      var target = Number(el.getAttribute("data-count"));
      var state = { v: 0 };
      gsap.to(state, {
        v: target,
        duration: 1.6,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%" },
        onUpdate: function () {
          el.textContent = Math.round(state.v);
        },
      });
    });

    // Packets travelling along the flow wires.
    var vertical = window.matchMedia("(max-width: 860px)");
    gsap.utils.toArray(".flow__wire").forEach(function (wire, i) {
      var packet = wire.querySelector(".flow__packet");
      gsap.to(packet, {
        x: function () {
          return vertical.matches ? 0 : wire.offsetWidth - 10;
        },
        y: function () {
          return vertical.matches ? wire.offsetHeight - 10 : 0;
        },
        duration: 1.4,
        ease: "power1.inOut",
        repeat: -1,
        delay: i * 0.7,
        repeatDelay: 0.7,
        invalidateOnRefresh: true,
      });
    });

    // Marquee: endless loop whose speed follows scroll velocity.
    var track = document.querySelector("[data-marquee]");
    if (track) {
      track.innerHTML += track.innerHTML;
      var loop = gsap.to(track, { xPercent: -50, duration: 40, ease: "none", repeat: -1 });
      window.ScrollTrigger.create({
        onUpdate: function (self) {
          var boost = 1 + Math.min(Math.abs(self.getVelocity()) / 400, 4);
          gsap.to(loop, { timeScale: boost, duration: 0.2, overwrite: true });
          gsap.to(loop, { timeScale: 1, duration: 1.2, delay: 0.2 });
        },
      });
    }

    // Magnetic primary CTA (pointer devices only).
    if (window.matchMedia("(hover: hover)").matches) {
      document.querySelectorAll("[data-magnetic]").forEach(function (el) {
        var xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
        var yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });
        el.addEventListener("pointermove", function (e) {
          var r = el.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * 0.3);
          yTo((e.clientY - r.top - r.height / 2) * 0.4);
        });
        el.addEventListener("pointerleave", function () {
          xTo(0);
          yTo(0);
        });
      });
    }
  }

  /* ---------- Boot ---------- */

  function init() {
    captureEnglish();
    setLang(initialLang(), false);
    document.querySelector("[data-lang-toggle]").addEventListener("click", function () {
      setLang(lang === "zh" ? "en" : "zh", true);
    });
    initNav();
    initTabs();
    initCopy();
    initStars();
    initMotion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

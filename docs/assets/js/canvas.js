/* Canvas scenes: the hero ring field, the CTA dot wave and the four demo previews.
   Every scene is a function (ctx, w, h, t) drawn by one shared loop that skips off-screen canvases. */
(function () {
  "use strict";

  // Page colours follow Cavalry's brand violet; the demo scenes keep the colours their prompts ask for.
  var COLORS = {
    ink: "#11101a",
    accent: "#6437ff",
    lilac: "#a58bff",
    orange: "#ff6b2c",
    cyan: "#3ee6ff",
    magenta: "#ff2bd6",
    navy: "#0f1c3f",
  };

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, active: false };

  window.addEventListener(
    "pointermove",
    function (e) {
      if (e.pointerType !== "mouse") return;
      pointer.active = true;
      pointer.tx = e.clientX / window.innerWidth;
      pointer.ty = e.clientY / window.innerHeight;
    },
    { passive: true },
  );

  /* ---------- Easing, matching Cavalry's Magic Easing names where it helps ---------- */

  function clamp(v, a, b) {
    return Math.min(b, Math.max(a, v));
  }
  function overshootOut(t) {
    var s = 2.2;
    t -= 1;
    return t * t * ((s + 1) * t + s) + 1;
  }
  function slowOut(t) {
    return 1 - Math.pow(1 - t, 4);
  }
  function progress(frame, start, end) {
    return clamp((frame - start) / (end - start), 0, 1);
  }

  /* ---------- Shared loop ---------- */

  var scenes = [];

  function register(canvas, draw) {
    var scene = { canvas: canvas, ctx: canvas.getContext("2d"), draw: draw, visible: true, w: 0, h: 0 };
    resize(scene);
    scenes.push(scene);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        scene.visible = entries[0].isIntersecting;
      }).observe(canvas);
    }
    if (reduceMotion) render(scene, 2.5);
    return scene;
  }

  function resize(scene) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = scene.canvas.getBoundingClientRect();
    scene.w = rect.width;
    scene.h = rect.height;
    scene.canvas.width = Math.round(rect.width * dpr);
    scene.canvas.height = Math.round(rect.height * dpr);
    scene.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function render(scene, t) {
    scene.ctx.clearRect(0, 0, scene.w, scene.h);
    scene.draw(scene.ctx, scene.w, scene.h, t);
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      scenes.forEach(function (s) {
        resize(s);
        if (reduceMotion) render(s, 2.5);
      });
    }, 120);
  });

  function tick(now) {
    var t = now / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].visible) render(scenes[i], t);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- Hero: concentric duplicator rings ---------- */

  var RINGS = [
    { count: 12, radius: 0.16, speed: 0.18, size: 5, color: COLORS.accent },
    { count: 20, radius: 0.27, speed: -0.11, size: 3.2, color: COLORS.ink },
    { count: 28, radius: 0.38, speed: 0.07, size: 2.6, color: COLORS.ink },
    { count: 36, radius: 0.49, speed: -0.045, size: 2.2, color: COLORS.lilac },
    { count: 48, radius: 0.6, speed: 0.03, size: 1.8, color: COLORS.ink },
  ];

  function drawHero(ctx, w, h, t) {
    var mobile = w < 860;
    var cx = w * (mobile ? 0.5 : 0.7) + (pointer.x - 0.5) * 40;
    var cy = h * (mobile ? 0.3 : 0.5) + (pointer.y - 0.5) * 40;
    var unit = Math.min(w, h) * 0.95;
    var px = pointer.x * w;
    var py = pointer.y * h;

    // Soft glow behind the rig.
    var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.55);
    glow.addColorStop(0, "rgba(100,55,255,0.12)");
    glow.addColorStop(1, "rgba(100,55,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    RINGS.forEach(function (ring, ri) {
      var r = ring.radius * unit;
      // Thin guide circle, like a generator's distribution path.
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(17,16,26,0.07)";
      ctx.lineWidth = 1;
      ctx.stroke();

      for (var i = 0; i < ring.count; i++) {
        var a = (i / ring.count) * Math.PI * 2 + t * ring.speed;
        var wobble = Math.sin(t * 1.4 + i * 0.6 + ri) * unit * 0.008;
        var x = cx + Math.cos(a) * (r + wobble);
        var y = cy + Math.sin(a) * (r + wobble);
        var d = Math.hypot(x - px, y - py);
        var near = pointer.active ? clamp(1 - d / 180, 0, 1) : 0;
        var pulse = 1 + 0.35 * Math.sin(t * 2 + i * 0.5 + ri * 1.3);
        var size = ring.size * pulse * (1 + near * 1.6);

        ctx.globalAlpha = ring.color === COLORS.ink ? 0.28 + near * 0.72 : 0.9;
        ctx.fillStyle = near > 0.4 ? COLORS.accent : ring.color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    // Connection lines from the inner ring to the pointer when it is close: "wiring attributes".
    var inner = RINGS[0];
    for (var j = 0; j < inner.count; j++) {
      var ang = (j / inner.count) * Math.PI * 2 + t * inner.speed;
      var ix = cx + Math.cos(ang) * inner.radius * unit;
      var iy = cy + Math.sin(ang) * inner.radius * unit;
      var dist = Math.hypot(ix - px, iy - py);
      if (pointer.active && dist < 260) {
        ctx.strokeStyle = "rgba(100,55,255," + (0.4 * (1 - dist / 260)).toFixed(3) + ")";
        ctx.beginPath();
        ctx.moveTo(ix, iy);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
    }
  }

  /* ---------- CTA: rippling dot grid ---------- */

  function drawCta(ctx, w, h, t) {
    var gap = w < 560 ? 26 : 34;
    var cx = w / 2;
    var cy = h / 2;
    var maxD = Math.hypot(cx, cy);
    for (var y = gap / 2; y < h; y += gap) {
      for (var x = gap / 2; x < w; x += gap) {
        var d = Math.hypot(x - cx, y - cy);
        var wave = Math.sin(d * 0.022 - t * 1.8);
        var fade = 1 - d / maxD;
        var s = 0.6 + Math.max(0, wave) * 2.2 * fade;
        ctx.globalAlpha = 0.1 + Math.max(0, wave) * 0.45 * fade;
        ctx.fillStyle = wave > 0.92 ? COLORS.accent : COLORS.ink;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Demo previews: a tiny Cavalry-style viewport with a timeline ---------- */

  var FPS = 24;

  function viewport(ctx, w, h, bg) {
    ctx.fillStyle = bg || "#16161a";
    ctx.fillRect(0, 0, w, h);
    if (!bg) {
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      var g = w / 16;
      for (var x = g; x < w; x += g) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (var y = g; y < h; y += g) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }
  }

  function timeline(ctx, w, h, frame, total) {
    var bh = Math.max(22, h * 0.07);
    ctx.fillStyle = "rgba(8,8,10,0.85)";
    ctx.fillRect(0, h - bh, w, bh);
    var x0 = 70;
    var x1 = w - 16;
    var y = h - bh / 2;
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    var px = x0 + (x1 - x0) * (frame / total);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(px - 1, h - bh + 4, 2, bh - 8);
    ctx.font = "500 11px JetBrains Mono, monospace";
    ctx.fillStyle = "rgba(244,241,234,0.7)";
    ctx.textBaseline = "middle";
    ctx.fillText("F " + String(Math.floor(frame)).padStart(3, "0"), 12, y);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  var demos = {
    bounce: function (ctx, w, h, t) {
      var total = 72;
      var f = (t * FPS) % total;
      var s = w / 1920;
      viewport(ctx, w, h);
      var p = overshootOut(progress(f, 4, 28));
      var out = progress(f, 60, 70);
      var y = h / 2 + (1 - p) * (h * 0.75);
      ctx.save();
      ctx.globalAlpha = 1 - out;
      ctx.translate(w / 2, y);
      ctx.fillStyle = COLORS.orange;
      ctx.shadowColor = "rgba(255,107,44,0.45)";
      ctx.shadowBlur = 40 * s;
      roundRect(ctx, (-480 * s) / 2, (-160 * s) / 2, 480 * s, 160 * s, 36 * s);
      ctx.fill();
      ctx.restore();
      timeline(ctx, w, h, f, total);
    },

    ring: function (ctx, w, h, t) {
      var total = 120;
      var f = (t * FPS) % total;
      var s = w / 1920;
      viewport(ctx, w, h);
      var rot = (f / total) * Math.PI * 2;
      var alt = Math.sin(t * 0.5) > 0;
      for (var i = 0; i < 12; i++) {
        var a = (i / 12) * Math.PI * 2 + rot;
        var x = w / 2 + Math.cos(a) * 300 * s;
        var y = h / 2 - 20 * s + Math.sin(a) * 300 * s;
        var pulse = alt ? 1 + 0.4 * Math.sin(t * 4 + i) : 1;
        ctx.fillStyle = alt && i % 2 ? COLORS.magenta : COLORS.cyan;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 24 * s;
        ctx.beginPath();
        ctx.arc(x, y, 34 * s * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      timeline(ctx, w, h, f, total);
    },

    title: function (ctx, w, h, t) {
      titleCard(ctx, w, h, t, false);
    },

    neon: function (ctx, w, h, t) {
      titleCard(ctx, w, h, t, true);
    },
  };

  function titleCard(ctx, w, h, t, neon) {
    var total = 96;
    var f = (t * FPS) % total;
    var s = w / 1920;
    viewport(ctx, w, h, neon ? "#050507" : COLORS.navy);
    if (neon) {
      // Scanlines sell the cyberpunk restyle.
      ctx.fillStyle = "rgba(62,230,255,0.03)";
      for (var y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    }
    var a1 = slowOut(progress(f, 6, 30));
    var a2 = slowOut(progress(f, 14, 38));
    var out = progress(f, 80, 92);
    var flicker = neon && f > 40 && f < 44 ? 0.4 : 1;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.globalAlpha = a1 * (1 - out) * flicker;
    ctx.font = "700 " + Math.round(150 * s) + "px Inter Tight, system-ui, sans-serif";
    ctx.fillStyle = neon ? COLORS.cyan : "#ffffff";
    ctx.shadowColor = neon ? COLORS.cyan : "transparent";
    ctx.shadowBlur = neon ? 40 * s : 0;
    ctx.fillText("Hello Cavalry", w / 2, h / 2 - 40 * s + (1 - a1) * 60 * s);

    ctx.globalAlpha = a2 * (1 - out);
    ctx.font = "500 " + Math.round(46 * s) + "px Inter Tight, system-ui, sans-serif";
    ctx.fillStyle = neon ? COLORS.magenta : COLORS.orange;
    ctx.shadowColor = neon ? COLORS.magenta : "transparent";
    ctx.fillText("Made with Claude + MCP", w / 2, h / 2 + 80 * s + (1 - a2) * 60 * s);

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.textAlign = "start";
    timeline(ctx, w, h, f, total);
  }

  /* ---------- Boot ---------- */

  function init() {
    var hero = document.querySelector("[data-hero-canvas]");
    var cta = document.querySelector("[data-cta-canvas]");
    if (hero) register(hero, drawHero);
    if (cta) register(cta, drawCta);

    document.querySelectorAll("[data-demo]").forEach(function (el) {
      var media = el.querySelector(".demo__media");
      var draw = demos[el.getAttribute("data-demo")];
      var src = media && media.getAttribute("data-video");
      if (src) {
        mountVideo(media, src, media.getAttribute("data-poster"));
      } else if (draw) {
        register(media.querySelector("canvas"), draw);
      }
    });

    if (!reduceMotion) requestAnimationFrame(tick);
  }

  function mountVideo(media, src, poster) {
    var video = document.createElement("video");
    video.src = src;
    if (poster) video.poster = poster;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = !reduceMotion;
    video.preload = "metadata";
    video.setAttribute("aria-hidden", "true");
    var canvas = media.querySelector("canvas");
    if (canvas) canvas.remove();
    media.prepend(video);
    media.classList.add("has-video");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

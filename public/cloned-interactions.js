/* ---------------------------------------------------------------------------
 * cloned-interactions.js — framework-free behaviour for the static Pressed clone.
 *
 * pressed.com is a Nuxt (Vue) SPA. Every interaction lives in build-hashed JS
 * bundles that do not survive a static clone, and Ditto's motion capture came
 * back completely empty for this site (0 @keyframes, 0 WAAPI, 0 reveals) because
 * all of its motion is JS-driven. So everything here is re-implemented by hand
 * against the captured DOM.
 *
 * Deliberately NOT implemented, because live does not do it:
 *   - scroll-reveal / entrance animations. Measured on live: of 121 below-the-fold
 *     candidates, 0 were parked at opacity<0.9 or transformed. The site simply
 *     renders its content.
 *   - hide-on-scroll header. Live's header is position:sticky;top:0 and its
 *     computed box is identical at scrollY 0 / 1400 / back-up.
 * ------------------------------------------------------------------------- */
(function () {
  "use strict";
  var d = document;
  var onReady = function (fn) {
    if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", fn);
    else fn();
  };
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var txt = function (el) { return ((el && el.innerText) || "").trim().replace(/\s+/g, " "); };

  /* Live derives its ?filters= key from the chip label: lowercase, " & " -> "_and_",
     spaces -> "_". Verified against 15 keys read back from the live URL bar
     (e.g. "Protein & Fruit Smoothies" -> protein_and_fruit_smoothies,
     "10g of Sugar or Less" -> 10g_of_sugar_or_less). */
  function slugify(label) {
    return String(label).trim().toLowerCase()
      .replace(/\s*&\s*/g, "_and_")
      .replace(/\s+/g, "_");
  }

  /* ---------------- 1. Promo bar: rotation + prev/next/pause --------------- */
  function promoBar() {
    var prev = $('[aria-label="View previous offer"]');
    var next = $('[aria-label="View next offer"]');
    var pause = $('[aria-label="Pause offer carousel"]');

    // The offer text and the "View All Offers" link are two SEPARATE spans inside the
    // "View all offers Carousel" region (live keeps them spaced, the link underlined).
    // Rotate ONLY the offer-text span — overwriting the whole region flattens both into
    // one run and drops the underlined link. Target the span that is not the persistent
    // #viewAllOffersElement.
    var region = $('[aria-label*="offers Carousel" i]') || $('[aria-live="polite"][role="region"]');
    var slot = null;
    if (region) {
      $$("span", region).forEach(function (s) {
        if (s.id === "viewAllOffersElement" || s.closest("#viewAllOffersElement")) return;
        if (/view all offers/i.test(txt(s))) return;
        if (!slot || txt(s).length > txt(slot).length) slot = s;
      });
    }
    if (!slot) return;

    // Offer text only — the "View All Offers" link is a separate, untouched span.
    var OFFERS = [
      txt(slot),
      "$5 Off on Pickup Orders of $50 or More",
      "FREE Shipping on Orders $125+",
      "7 shots for $22",
      "Free Local Delivery on Orders $75+"
    ].filter(function (v, i, a) { return v && a.indexOf(v) === i; });

    var i = 0, timer = null, paused = false;
    function render() { slot.textContent = OFFERS[((i % OFFERS.length) + OFFERS.length) % OFFERS.length]; }
    function start() { stop(); if (!paused) timer = setInterval(function () { i++; render(); }, 5000); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    if (prev) prev.addEventListener("click", function (e) { e.preventDefault(); i--; render(); start(); });
    if (next) next.addEventListener("click", function (e) { e.preventDefault(); i++; render(); start(); });
    if (pause) pause.addEventListener("click", function (e) {
      e.preventDefault();
      paused = !paused;
      pause.setAttribute("aria-pressed", String(paused));
      pause.setAttribute("aria-label", paused ? "Play offer carousel" : "Pause offer carousel");
      if (paused) stop(); else start();
    });
    render(); start();
  }

  /* ---------------- 2. Header mega-menu (Shop) ----------------------------- */
  /* Live keeps the shop submenu in the DOM permanently, positioned off-canvas at
     x=-260. Ditto dropped it (clone header has 7 links; live has 21), so the panel
     is rebuilt here from the same filter links live points at. */
  var SHOP_MENU = [
    ["Best Sellers", "/shop?filters=best_sellers"],
    ["Cleanses", "/shop?filters=cleanses"],
    ["Juices", "/shop?filters=juices"],
    ["Protein & Fruit Smoothies", "/shop?filters=protein_and_fruit_smoothies"],
    ["Bundles", "/shop?filters=bundles"],
    ["Shots", "/shop?filters=shots"],
    ["Shop All", "/shop"]
  ];

  function megaMenu() {
    var header = $("header");
    if (!header) return;
    var shopLink = $$("header a").filter(function (a) {
      return a.getAttribute("href") === "/shop" && txt(a).toLowerCase() === "shop";
    })[0];
    if (!shopLink) return;

    var panel = d.createElement("div");
    panel.className = "cloned-megamenu";
    panel.setAttribute("role", "menu");
    panel.hidden = true;
    panel.innerHTML =
      '<div class="cloned-megamenu__inner">' +
      SHOP_MENU.map(function (it) {
        return '<a role="menuitem" href="' + it[1] + '">' + it[0] + "</a>";
      }).join("") +
      "</div>";
    header.appendChild(panel);

    var open = false, hideT = null;
    function show() { clearTimeout(hideT); panel.hidden = false; open = true; shopLink.setAttribute("aria-expanded", "true"); }
    function hide() { panel.hidden = true; open = false; shopLink.setAttribute("aria-expanded", "false"); }
    function hideSoon() { clearTimeout(hideT); hideT = setTimeout(hide, 220); }

    shopLink.setAttribute("aria-haspopup", "true");
    shopLink.setAttribute("aria-expanded", "false");
    shopLink.addEventListener("mouseenter", show);
    shopLink.addEventListener("mouseleave", hideSoon);
    panel.addEventListener("mouseenter", function () { clearTimeout(hideT); });
    panel.addEventListener("mouseleave", hideSoon);
    // Click toggles too, so the menu is reachable without a pointer.
    shopLink.addEventListener("click", function (e) {
      if (!open) { e.preventDefault(); show(); }
    });
    d.addEventListener("click", function (e) {
      if (open && !panel.contains(e.target) && e.target !== shopLink) hide();
    });
    d.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) hide(); });
  }

  /* ---------------- 3. Mobile drawer --------------------------------------- */
  /* Live's drawer nav also lives off-canvas (x=-272) and was likewise dropped. */
  var NAV = [
    ["Shop", "/shop", SHOP_MENU],
    ["About", "/our-journey", null],
    ["Pressed Rewards", "/juice-subscription-membership/signup", null],
    ["Find a Store", "/juice-bar-locations", null],
    ["Quiz", "/flavor-quiz", null],
    ["Catering", "/catering", null]
  ];

  function mobileDrawer() {
    var header = $("header");
    if (!header) return;
    var burger = $('[alt="Menu"]', header);
    var trigger = burger ? (burger.closest("button") || burger.closest("[role=button]") || burger.parentElement) : null;
    if (!trigger) return;

    var drawer = d.createElement("div");
    drawer.className = "cloned-drawer";
    drawer.hidden = true;
    drawer.innerHTML =
      '<div class="cloned-drawer__scrim" data-close></div>' +
      '<nav class="cloned-drawer__panel" aria-label="Mobile">' +
      '<button class="cloned-drawer__close" data-close aria-label="Close menu">&times;</button>' +
      '<ul>' + NAV.map(function (n) {
        if (!n[2]) return '<li><a href="' + n[1] + '">' + n[0] + "</a></li>";
        return '<li class="has-sub">' +
          '<button class="cloned-drawer__sub" aria-expanded="false">' + n[0] + '<span aria-hidden="true">+</span></button>' +
          '<ul class="cloned-drawer__submenu" hidden>' +
          n[2].map(function (s) { return '<li><a href="' + s[1] + '">' + s[0] + "</a></li>"; }).join("") +
          "</ul></li>";
      }).join("") + "</ul></nav>";
    d.body.appendChild(drawer);

    function open() { drawer.hidden = false; d.documentElement.style.overflow = "hidden"; trigger.setAttribute("aria-expanded", "true"); }
    function close() { drawer.hidden = true; d.documentElement.style.overflow = ""; trigger.setAttribute("aria-expanded", "false"); }

    trigger.setAttribute("aria-expanded", "false");
    trigger.addEventListener("click", function (e) { e.preventDefault(); drawer.hidden ? open() : close(); });
    drawer.addEventListener("click", function (e) {
      if (e.target.hasAttribute && e.target.hasAttribute("data-close")) { close(); return; }
      var sub = e.target.closest && e.target.closest(".cloned-drawer__sub");
      if (sub) {
        var list = sub.nextElementSibling;
        var isOpen = sub.getAttribute("aria-expanded") === "true";
        sub.setAttribute("aria-expanded", String(!isOpen));
        list.hidden = isOpen;
        sub.lastElementChild.textContent = isOpen ? "+" : "−";
      }
    });
    d.addEventListener("keydown", function (e) { if (e.key === "Escape" && !drawer.hidden) close(); });
  }

  /* ---------------- 4. Shop filters (?filters=) ---------------------------- */
  /* A static export cannot route on a query string, but it can read one. The
     captured /shop renders every product grouped under its category heading, so a
     filter is reproduced by showing only the matching category section — which is
     what live's filtered view shows. `?filters=` therefore keeps working verbatim,
     rather than inventing /shop/<category> routes that live does not have. */
  function shopFilters() {
    if (!/\/shop\/?$/.test(location.pathname)) return;

    // Category sections: a heading whose next sibling is a product grid.
    // Category headings: an h2/h3 that is NOT a product-card title.
    var heads = $$("h2,h3").filter(function (h) {
      var t = txt(h);
      return t && t.length <= 44 && !h.closest('a[href*="/products/"]');
    });
    var headSet = new Set(heads);
    // A category's block is the HIGHEST ancestor that still contains exactly this one
    // category heading. Walking up to "an ancestor with >=2 product links" instead lands
    // every heading on the same outer container, which collapses all categories into one.
    var sections = [];
    heads.forEach(function (h) {
      var block = h, parent = h.parentElement;
      while (parent && parent !== d.body) {
        var n = 0;
        parent.querySelectorAll("h2,h3").forEach(function (x) { if (headSet.has(x)) n++; });
        if (n !== 1) break;
        block = parent; parent = parent.parentElement;
      }
      if (block === h) return;
      if (block.querySelectorAll('a[href*="/products/"]').length < 2) return;
      sections.push({ key: slugify(txt(h)), label: txt(h), block: block, heading: h });
    });
    if (!sections.length) return;

    var chips = $$("li").filter(function (li) {
      var t = txt(li);
      return t && t.length < 44 && li.querySelector("label,input,button") && !li.querySelector('a[href*="/products/"]');
    });

    function apply(key, push) {
      var match = null;
      if (key) match = sections.filter(function (s) { return s.key === key; })[0] || null;
      sections.forEach(function (s) { s.block.classList.toggle('cloned-hidden', !!(key && match && s !== match)); });
      chips.forEach(function (li) {
        var on = !!key && slugify(txt(li)) === key;
        li.setAttribute("data-cloned-filter-active", on ? "true" : "false");
        var box = li.querySelector('input[type="checkbox"]');
        if (box) box.checked = on;
      });
      var url = key ? location.pathname + "?filters=" + encodeURIComponent(key) : location.pathname;
      if (push) history.pushState({ f: key }, "", url);
      // If the key names a filter live has but this capture has no section for,
      // say so rather than silently showing everything.
      if (key && !match) {
        var note = $("#cloned-filter-note") || d.createElement("p");
        note.id = "cloned-filter-note";
        note.style.cssText = "margin:16px 0;font-size:14px;opacity:.7";
        note.textContent = 'No captured product section for the "' + key + '" filter.';
        if (!note.parentElement && sections[0]) sections[0].block.parentElement.insertBefore(note, sections[0].block);
      } else {
        var old = $("#cloned-filter-note");
        if (old && old.parentElement) old.parentElement.removeChild(old);
      }
    }

    chips.forEach(function (li) {
      li.style.cursor = "pointer";
      li.addEventListener("click", function (e) {
        e.preventDefault();
        var key = slugify(txt(li));
        var cur = new URLSearchParams(location.search).get("filters");
        apply(cur === key ? "" : key, true);
        window.scrollTo({ top: 0, behavior: "auto" });
      });
    });
    window.addEventListener("popstate", function () {
      apply(new URLSearchParams(location.search).get("filters") || "", false);
    });
    apply(new URLSearchParams(location.search).get("filters") || "", false);
  }

  /* ---------------- 5. Cart (localStorage simulation) ---------------------- */
  function cart() {
    var KEY = "pressed-clone-cart";
    var read = function () { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    var write = function (v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
    var count = function () { var c = read(), n = 0; for (var k in c) n += c[k]; return n; };

    var icon = $('[aria-label="Go to cart"]');
    var badge = null;
    if (icon) {
      var host = icon.closest("a,button,div") || icon;
      host.style.position = host.style.position || "relative";
      badge = d.createElement("span");
      badge.className = "cloned-cart-badge";
      host.appendChild(badge);
    }
    function paint() {
      var n = count();
      if (badge) { badge.textContent = n > 99 ? "99+" : String(n); badge.hidden = n === 0; }
    }
    // "Add to Cart" / quantity steppers across the captured pages.
    d.addEventListener("click", function (e) {
      var el = e.target.closest && e.target.closest("button,[role=button],a");
      if (!el) return;
      var label = (txt(el) || el.getAttribute("aria-label") || "").toLowerCase();
      if (!/add to cart|add to bag|^\+$|shop now/.test(label)) return;
      if (el.tagName === "A" && /^https?:/.test(el.getAttribute("href") || "")) return;
      e.preventDefault();
      var card = el.closest("li,article,div");
      var name = card ? (txt(card.querySelector("h2,h3,h4,a")) || "item") : "item";
      var c = read(); c[name] = (c[name] || 0) + 1; write(c); paint();
      if (badge) { badge.classList.remove("is-bump"); void badge.offsetWidth; badge.classList.add("is-bump"); }
    });
    paint();
  }

  /* ---------------- 6. Image hover-swap ------------------------------------ */
  /* Product cards that captured two stacked images: show the second on hover,
     which is what live does on its shop cards. */
  function hoverSwap() {
    $$('a[href*="/products/"]').forEach(function (a) {
      var imgs = $$("img", a).filter(function (i) { return i.getBoundingClientRect().width > 40; });
      if (imgs.length < 2) return;
      a.classList.add("cloned-hoverswap");
    });
  }

  /* ---------------- 7. Horizontal carousels -------------------------------- */
  /* Any captured horizontally-scrollable track gets working prev/next affordances. */
  function carousels() {
    $$("ul,div").forEach(function (track) {
      if (track.scrollWidth <= track.clientWidth + 24) return;
      var cs = getComputedStyle(track);
      if (!/auto|scroll/.test(cs.overflowX)) return;
      if (track.closest(".cloned-drawer,.cloned-megamenu")) return;
      if (track.getBoundingClientRect().height < 80) return;
      if (track.parentElement && track.parentElement.querySelector(":scope > .cloned-carousel-btn")) return;

      var wrap = track.parentElement;
      if (!wrap) return;
      if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative";
      ["prev", "next"].forEach(function (dir) {
        var b = d.createElement("button");
        b.className = "cloned-carousel-btn cloned-carousel-btn--" + dir;
        b.type = "button";
        b.setAttribute("aria-label", dir === "prev" ? "Previous" : "Next");
        b.innerHTML = dir === "prev" ? "&#8249;" : "&#8250;";
        b.addEventListener("click", function () {
          var step = Math.max(200, Math.round(track.clientWidth * 0.8));
          track.scrollBy({ left: dir === "prev" ? -step : step, behavior: "smooth" });
        });
        wrap.appendChild(b);
      });
    });
  }

  /* ---------------- 8. Hero video ------------------------------------------ */
  /* The live hero is a <mux-player>; the clone uses the same underlying Mux asset
     as a plain <video>. Wire its captured pause control. */
  function heroVideo() {
    var v = $("[data-cloned-hero-video]");
    if (!v) return;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
    var ctrl = $$('[alt="Pause"]').map(function (i) { return i.closest("[role=button],button,div"); })[0];
    if (!ctrl) return;
    ctrl.style.cursor = "pointer";
    ctrl.addEventListener("click", function (e) {
      e.preventDefault();
      if (v.paused) { v.play(); ctrl.setAttribute("aria-label", "Pause"); }
      else { v.pause(); ctrl.setAttribute("aria-label", "Play"); }
      ctrl.setAttribute("data-cloned-paused", String(v.paused));
    });
  }

  /* ---------------- 9. YouTube facade ------------------------------------- */
  /* The captured Our Journey <iframe> lost its src, so the embed rendered blank.
     Show the real poster (matches live at rest) and swap in the YouTube player on
     click — a facade, so no third-party frame loads until the user asks for it. */
  function youtubeFacade() {
    $$("[data-yt-facade]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        var id = el.getAttribute("data-yt-facade");
        var f = d.createElement("iframe");
        f.className = el.className;
        f.setAttribute("src", "https://www.youtube.com/embed/" + id + "?autoplay=1&rel=0");
        f.setAttribute("title", el.getAttribute("aria-label") || "Video");
        f.setAttribute("frameborder", "0");
        f.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
        f.setAttribute("allowfullscreen", "");
        el.parentNode.replaceChild(f, el);
      });
    });
  }

  /* ---------------- 9b. Video facade -------------------------------------- */
  /* Show a poster still at rest and load + play the real <video> on click, the
     way live does. A bare <video preload="none" poster> renders blank in some
     browsers, and eagerly shipping the multi-MB file is wasteful — the facade
     avoids both. */
  function videoFacade() {
    $$("[data-video-facade]").forEach(function (el) {
      el.addEventListener("click", function () {
        var src = el.getAttribute("data-video-facade");
        var v = d.createElement("video");
        v.src = src;
        v.controls = true;
        v.autoplay = true;
        v.playsInline = true;
        v.className = el.className.replace(/\bcursor-pointer\b/, "").replace(/\bbg-cover\b/, "").replace(/\bbg-center\b/, "") + " object-cover";
        v.style.backgroundColor = "#000";
        el.parentNode.replaceChild(v, el);
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      });
    });
  }

  /* ---------------- 11. FAQ page: category tabs + accordions -------------- */
  /* Live's FAQ is a Nuxt tab+accordion widget; the capture kept only the question
     headings (no answer panels, no JS). The clone now renders all 14 categories and
     their answers (from faq-data.ts), collapsed, and this wires the behaviour:
     click a question to reveal its answer, click a category to switch panels. */
  function faqPage() {
    // Accordions.
    $$("[data-faq-q]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var panel = d.getElementById(btn.getAttribute("aria-controls"));
        var open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        if (panel) panel.classList.toggle("hidden", open);
      });
    });
    // Category tabs.
    var tabs = $$('[role="tab"][aria-controls]');
    var panels = $$("[data-faq-panel]");
    if (tabs.length && panels.length) {
      tabs.forEach(function (tab) {
        tab.addEventListener("click", function (e) {
          e.preventDefault();
          var id = tab.getAttribute("aria-controls");
          tabs.forEach(function (t) { t.setAttribute("aria-selected", t === tab ? "true" : "false"); });
          panels.forEach(function (p) { p.classList.toggle("hidden", p.id !== id); });
          // Collapse any open answers when switching category.
          $$('[data-faq-q][aria-expanded="true"]').forEach(function (b) {
            b.setAttribute("aria-expanded", "false");
            var pp = d.getElementById(b.getAttribute("aria-controls"));
            if (pp) pp.classList.add("hidden");
          });
          var cats0 = $(".faq-cats");
          if (cats0) cats0.classList.remove("faq-cats-open");
        });
      });
    }
    // Mobile "Categories" button reveals the desktop-hidden category list.
    var toggle = $("[data-faq-cats-toggle]");
    var catsBox = $(".faq-cats");
    if (toggle && catsBox) {
      toggle.addEventListener("click", function (e) {
        e.preventDefault();
        catsBox.classList.toggle("faq-cats-open");
      });
    }
  }

  /* ---------------- 10. Cookie consent banner ----------------------------- */
  /* Live's Cookiebot banner was captured as static markup on several pages, with dead
     `javascript:void(0)` buttons — so it could never be dismissed. Wire "Continue to site"
     (and "Do Not Sell") to close it, and persist the choice in localStorage so it stays
     dismissed across every page and revisit. Real content links (Privacy Policy) still work. */
  /* Ditto captured the banner markup on only 11 of 19 pages (it depends on which
     pages were loaded cold during capture). Live shows it on every page, so build
     it on the pages that lack it, using the captured markup verbatim. */
  var COOKIE_BANNER_HTML =
    '<div class="block mb-2 [font-family:regola-neue-semibold,_sans-serif] text-xl leading-7.5">This website uses cookies and other tracking technology</div>' +
    '<div class="block mb-6">We use cookies and other tracking technology to personalize content and ads, provide social media features and to analyze our traffic. We also share information about you and your use of our site with our social media, advertising and analytics partners who may combine this information with other information that you have provided to them or that they have collected from your use of their services, as detailed in our ' +
    '<a class="inline underline cursor-pointer" href="https://pressed.com/legal/privacy-policy">Privacy Policy</a>' +
    '. By continuing to our website, you consent to our uses of cookies and other tracking technologies.</div>' +
    '<div class="block">' +
    '<a class="h-10 flex mb-4 px-4 rounded-sm justify-center items-center text-color-002 [font-family:regola-neue-semibold,_sans-serif] leading-[0.9375rem] text-center uppercase bg-background cursor-pointer" href="javascript:void(0)" role="button"><span class="block">Continue to site</span></a>' +
    '<a class="block text-center underline cursor-pointer" href="javascript:void(0)" role="button"><span class="inline">Do Not Sell or Share My Personal Information</span></a>' +
    "</div>";

  function ensureCookieBanner() {
    if (d.getElementById("cookie-banner")) return d.getElementById("cookie-banner");
    var el = d.createElement("div");
    el.id = "cookie-banner";
    el.setAttribute("name", "cookie-banner");
    el.className = "h-[488.5px] block fixed right-214 bottom-6 left-6 z-99999999 max-w-100 p-6 rounded-[10px] text-background text-[0.9375rem] leading-[1.4375rem] bg-color-002 max-md:h-[31.9375rem] max-md:bottom-0 max-md:inset-x-0 max-md:max-w-none max-md:rounded-br-[initial] max-md:rounded-bl-[initial] md:max-lg:right-86";
    el.innerHTML = COOKIE_BANNER_HTML;
    d.body.appendChild(el);
    return el;
  }

  function cookieBanner() {
    if (window.location.pathname === "/") return;
    var KEY = "pressed-clone-cookie-dismissed";
    var banner = ensureCookieBanner();
    if (!banner) return;
    var dismissed = false;
    try { dismissed = localStorage.getItem(KEY) === "1"; } catch (e) {}
    if (dismissed) { banner.style.display = "none"; return; }
    function hide() { banner.style.display = "none"; try { localStorage.setItem(KEY, "1"); } catch (e) {} }
    // Only the non-navigating action controls dismiss; the Privacy Policy link keeps its href.
    $$('a[href^="javascript"], [role="button"], button', banner).forEach(function (el) {
      el.addEventListener("click", function (e) { e.preventDefault(); hide(); });
    });
    // Esc also dismisses.
    d.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
  }

  onReady(function () {
    [promoBar, megaMenu, mobileDrawer, shopFilters, cart, hoverSwap, carousels, heroVideo, youtubeFacade, videoFacade, faqPage, cookieBanner]
      .forEach(function (fn) { try { fn(); } catch (err) { if (window.__CLONED_DEBUG) console.error("[cloned-interactions]", fn.name, err); } });
  });
})();

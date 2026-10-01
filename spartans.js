/* Spartans batch: native in-site batch page + lecture player (no key generator, no redirects). */
(function () {
  "use strict";
  var BATCHES = {
    "spartans-ssc-cgl-2026": { url: "spartans-data.json", chip: "SSC CGL 2026", about: "SSC CGL 2026 Foundation Batch" },
    "super-100-ssc": { url: "super100-data.json", chip: "SSC", about: "SSC Exam Batch" }
  };
  var cache = {}, data = null, loading = null, cfg = null;
  var page, body, headTitle, playerView, player = null;
  var view = { name: "home", tab: "lectures", subject: -1, mode: "lectures", lec: -1 };
  var batchInfo = null;

  var I = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    chev: '<svg class="sp-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    vid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5 21 7.5v9l-5.5-3z"/></svg>',
    pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>'
  };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c];
    });
  }
  function toast(m) { try { if (typeof showToast === "function") showToast(m); } catch (e) {} }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : ""; }
  function counts() {
    var l = 0, n = 0;
    data.subjects.forEach(function (s) { l += s.lectures.length; s.lectures.forEach(function (x) { if (safeUrl(x.pdf)) n++; }); });
    return { subjects: data.subjects.length, lectures: l, notes: n };
  }
  function notesIn(s) { return s.lectures.filter(function (x) { return safeUrl(x.pdf); }).length; }

  function build() {
    if (page) return;
    page = document.createElement("div");
    page.id = "spPage";
    page.setAttribute("role", "dialog");
    page.setAttribute("aria-modal", "true");
    page.innerHTML =
      '<div class="sp-head"><button class="sp-back" type="button" aria-label="Back">' + I.back + '</button><h2 class="sp-head-title"></h2></div>' +
      '<div class="sp-body"><div class="sp-wrap"></div></div>';
    document.body.appendChild(page);
    body = page.querySelector(".sp-wrap");
    headTitle = page.querySelector(".sp-head-title");
    page.querySelector(".sp-back").addEventListener("click", function () { if (history.state && history.state.sp) history.back(); else closeAll(); });
    page.querySelector(".sp-body").addEventListener("click", onClick);

    playerView = document.createElement("div");
    playerView.id = "spPlayerView";
    playerView.innerHTML = '<div class="sp-pl-wrap"><div id="spPlayer"></div><div id="spPlInfo"></div></div>';
    document.body.appendChild(playerView);
    playerView.addEventListener("click", onClick);
  }

  function load(id) {
    cfg = BATCHES[id];
    if (!cfg) return Promise.reject(new Error("Unknown batch"));
    if (cache[id]) { data = cache[id]; return Promise.resolve(data); }
    loading = fetch(cfg.url, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        if (!j || !Array.isArray(j.subjects)) throw new Error("Bad data");
        cache[id] = j; data = j; loading = null; return data;
      })
      .catch(function (e) { loading = null; throw e; });
    return loading;
  }

  /* ---------- rendering ---------- */
  function subjectRows(kind) {
    return data.subjects.map(function (s, i) {
      var n = kind === "notes" ? notesIn(s) : s.lectures.length;
      var label = kind === "notes" ? (n === 1 ? "note" : "notes") : (n === 1 ? "lecture" : "lectures");
      return '<button class="sp-row" type="button" data-act="subject" data-i="' + i + '" data-mode="' + kind + '">' +
        '<span class="sp-ico' + (kind === "notes" ? " pdf" : "") + '">' + (kind === "notes" ? I.pdf : I.vid) + '</span>' +
        '<span class="sp-txt"><b>' + esc(s.name) + '</b><small>' + n + ' ' + label + '</small></span>' + I.chev + '</button>';
    }).join("");
  }

  function render() {
    if (!page) return;
    var html = "";
    if (view.name === "home") {
      headTitle.textContent = batchInfo.name;
      var c = counts();
      html =
        '<div class="sp-hero"><img src="' + esc(batchInfo.previewImage) + '" alt="" onerror="this.src=\'assets/codex-telegram.png\'">' +
        '<div class="sp-hero-info"><h1>' + esc(batchInfo.name) + '</h1><p>' + esc(batchInfo.byName) + '</p>' +
        '<div class="sp-chips"><span class="sp-chip accent">Recorded</span><span class="sp-chip">' + esc(cfg.chip) + '</span></div></div></div>' +
        '<div class="sp-tabs" role="tablist">' +
        ["lectures", "notes", "about"].map(function (t) {
          return '<button class="sp-tab' + (view.tab === t ? " on" : "") + '" type="button" role="tab" aria-selected="' + (view.tab === t) + '" data-act="tab" data-tab="' + t + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>';
        }).join("") + '</div>';
      if (view.tab === "about") {
        html += '<div class="sp-about"><h3>' + esc(batchInfo.name) + ' – ' + esc(cfg.about) + '</h3>' +
          '<p>' + esc(batchInfo.byName) + '. Recorded lectures with class notes, organised subject-wise.</p>' +
          '<div class="sp-stats"><div class="sp-stat"><b>' + c.subjects + '</b><span>Subjects</span></div>' +
          '<div class="sp-stat"><b>' + c.lectures + '</b><span>Lectures</span></div>' +
          '<div class="sp-stat"><b>' + c.notes + '</b><span>Notes</span></div></div></div>';
      } else {
        html += '<div class="sp-list">' + subjectRows(view.tab) + '</div>';
      }
    } else if (view.name === "subject") {
      var s = data.subjects[view.subject];
      headTitle.textContent = s.name;
      if (view.mode === "notes") {
        var rows = s.lectures.filter(function (x) { return safeUrl(x.pdf); }).map(function (x) {
          return '<a class="sp-row" href="' + esc(safeUrl(x.pdf)) + '" target="_blank" rel="noopener noreferrer">' +
            '<span class="sp-ico pdf">' + I.pdf + '</span><span class="sp-txt"><b>' + esc(s.name) + ' – ' + esc(x.title) + ' Notes</b><small>PDF</small></span>' + I.dl + '</a>';
        }).join("");
        html = '<div class="sp-list">' + (rows || '<div class="sp-empty">No notes in this subject yet.</div>') + '</div>';
      } else {
        html = '<div class="sp-list">' + lectureRows(s, -1) + '</div>';
      }
    }
    body.innerHTML = html;
    page.querySelector(".sp-body").scrollTop = 0;
  }

  function lectureRows(s, activeIdx) {
    return s.lectures.map(function (x, j) {
      return '<button class="sp-row' + (j === activeIdx ? " on" : "") + '" type="button" data-act="play" data-i="' + view.subject + '" data-j="' + j + '">' +
        '<span class="sp-ico num">' + (j + 1) + '</span>' +
        '<span class="sp-txt"><b>' + esc(x.title) + '</b><small>' + esc(s.name) + (safeUrl(x.pdf) ? ' · Notes available' : '') + '</small></span>' + I.vid + '</button>';
    }).join("");
  }

  /* ---------- player ---------- */
  function lecData(si, j) {
    var s = data.subjects[si], x = s.lectures[j];
    var q = {};
    ["360p", "480p", "720p"].forEach(function (k) { if (safeUrl(x.q[k])) q[k] = x.q[k]; });
    var main = q["720p"] || q["480p"] || q["360p"] || "";
    var prev = j > 0 ? { id: s.lectures[j - 1].id, title: s.name + " · " + s.lectures[j - 1].title } : null;
    var next = j < s.lectures.length - 1 ? { id: s.lectures[j + 1].id, title: s.name + " · " + s.lectures[j + 1].title } : null;
    return {
      id: x.id, title: s.name + " · " + x.title, videoUrl: main, quality: q,
      poster: batchInfo.previewImage,
      attachments: safeUrl(x.pdf) ? [{ title: x.title + " – Notes (PDF)", url: safeUrl(x.pdf) }] : [],
      chapters: [], lectures: [],
      course: {
        title: batchInfo.name,
        subjects: [{ title: batchInfo.name, chapters: data.subjects.map(function (sub) {
          return { title: sub.name, lectures: sub.lectures.map(function (l) { return { id: l.id, title: l.title }; }) };
        }) }]
      },
      previousLecture: prev, nextLecture: next, downloadUrl: null
    };
  }
  function findLec(id) {
    for (var i = 0; i < data.subjects.length; i++) {
      var L = data.subjects[i].lectures;
      for (var j = 0; j < L.length; j++) if (L[j].id === id) return [i, j];
    }
    return null;
  }
  function showLecture(si, j) {
    var s = data.subjects[si], x = s.lectures[j];
    view.subject = si; view.lec = j;
    if (!window.LecturePlayer) { toast("Player could not load. Please refresh."); return; }
    var d = lecData(si, j);
    if (!d.videoUrl) { toast("Video link not available for this lecture."); return; }
    playerView.classList.add("open");
    var root = document.getElementById("spPlayer");
    if (!player) {
      player = new window.LecturePlayer(root, d, {
        onBack: function () { history.back(); },
        onNavigate: function (n) { goId(n.id); },
        onSelectLecture: function (l) { goId(l.id); },
        onDownload: function (cur) {
          var u = player.urlFor(player.cq) || cur.videoUrl;
          if (safeUrl(u)) window.open(u, "_blank", "noopener"); else toast("Download unavailable for this lecture.");
        }
      });
    } else {
      player.load(d);
    }
    document.getElementById("spPlInfo").innerHTML =
      '<div class="sp-pl-info"><h2>' + esc(x.title) + '</h2><p>' + esc(s.name) + ' · ' + esc(batchInfo.name) + '</p>' +
      '<div class="sp-pl-btns">' + (safeUrl(x.pdf) ? '<a class="sp-pl-btn" href="' + esc(safeUrl(x.pdf)) + '" target="_blank" rel="noopener noreferrer">' + I.pdf + 'Class Notes</a>' : '') + '</div></div>' +
      '<div class="sp-pl-list-title">' + esc(s.name) + ' – all lectures</div><div class="sp-list">' + lectureRows(s, j) + '</div>';
  }
  function goId(id) {
    var p = findLec(id);
    if (!p) return;
    history.replaceState({ sp: "player", s: p[0], j: p[1] }, "");
    showLecture(p[0], p[1]);
  }
  function closePlayer() {
    if (player) { try { player.destroy(); } catch (e) {} player = null; }
    if (playerView) playerView.classList.remove("open");
  }

  /* ---------- navigation ---------- */
  function onClick(e) {
    var el = e.target.closest("[data-act]");
    if (!el) return;
    var act = el.dataset.act;
    if (act === "tab") { view.tab = el.dataset.tab; render(); }
    else if (act === "subject") {
      history.pushState({ sp: "subject", s: +el.dataset.i, mode: el.dataset.mode }, "");
      applyState(history.state);
    } else if (act === "play") {
      var si = +el.dataset.i, j = +el.dataset.j;
      if (playerView.classList.contains("open")) { history.replaceState({ sp: "player", s: si, j: j }, ""); showLecture(si, j); }
      else { history.pushState({ sp: "player", s: si, j: j }, ""); applyState(history.state); }
    }
  }
  function applyState(st) {
    if (!data || !batchInfo) return;
    build();
    if (!st || !st.sp) { closeAll(); return; }
    page.classList.add("open");
    document.body.style.overflow = "hidden";
    if (st.sp === "home") { closePlayer(); view.name = "home"; render(); }
    else if (st.sp === "subject") { closePlayer(); view.name = "subject"; view.subject = st.s; view.mode = st.mode || "lectures"; render(); }
    else if (st.sp === "player") {
      if (view.name !== "subject" || view.subject !== st.s) { view.name = "subject"; view.subject = st.s; view.mode = "lectures"; render(); }
      showLecture(st.s, st.j);
    }
  }
  function closeAll() {
    closePlayer();
    if (page) page.classList.remove("open");
    document.body.style.overflow = "";
  }
  window.addEventListener("popstate", function (e) { if (page && (page.classList.contains("open") || (e.state && e.state.sp))) applyState(e.state); });

  function open(batch) {
    batchInfo = batch;
    try { if (typeof closeModal === "function") closeModal("detailModal"); } catch (e) {}
    build();
    page.classList.add("open");
    document.body.style.overflow = "hidden";
    headTitle.textContent = batch.name || "Batch";
    body.innerHTML = '<div class="sp-empty">Loading…</div>';
    view = { name: "home", tab: "lectures", subject: -1, mode: "lectures", lec: -1 };
    load(batch._id || batch.batch_id).then(function () {
      history.pushState({ sp: "home" }, "");
      applyState(history.state);
    }).catch(function () {
      body.innerHTML = '<div class="sp-empty">Could not load the batch.<br><button type="button" id="spRetry">Try again</button></div>';
      var b = document.getElementById("spRetry");
      if (b) b.addEventListener("click", function () { open(batch); });
    });
  }

  window.SpartansBatch = {
    handles: function (b) { return !!b && !!BATCHES[b._id || b.batch_id]; },
    open: open
  };
})();

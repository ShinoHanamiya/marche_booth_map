(() => {
  "use strict";
  const cfg = window.APP_CONFIG;
  const $ = (id) => document.getElementById(id);
  const els = {};
  const escapeHtml = (v="") => String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const normalize = (v="") => String(v).toLowerCase().normalize("NFKC");
  const urlOk = (u) => /^https?:\/\//i.test(u || "");

  function instagramUrls(e) {
    const raw = Array.isArray(e?.instagram_urls) ? e.instagram_urls : (e?.instagram_url ? [e.instagram_url] : []);
    return [...new Set(raw.map(x => String(x || "").trim()).filter(urlOk))];
  }
  function instagramLabel(url, index) {
    try {
      const u = new URL(url);
      const name = u.pathname.split("/").filter(Boolean)[0];
      return name ? `Instagram @${escapeHtml(name)}` : `Instagram ${index + 1}`;
    } catch (_) { return `Instagram ${index + 1}`; }
  }
  function instagramLinks(e) {
    return instagramUrls(e).map((url, i) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${instagramLabel(url, i)} ↗</a>`).join("");
  }
  function tagList(e) {
    return Array.isArray(e?.tags) ? e.tags.map(x => String(x || "").trim()).filter(Boolean) : [];
  }

  function loadSet(key) {
    try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); }
    catch { return new Set(); }
  }
  function favoriteKey(eventId) { return `${cfg.favoriteStoragePrefix}${eventId}`; }
  function visitedKey(eventId) { return `${cfg.visitedStoragePrefix}${eventId}`; }
  function migrateLegacyState(eventId) {
    const favorites = loadSet(favoriteKey(eventId));
    const visited = loadSet(visitedKey(eventId));
    // 旧版は単一イベントだったため、既定サンプルイベントにのみ引き継ぐ。
    if (eventId === cfg.defaultEditorEventId) {
      (cfg.legacyFavoriteStorageKeys || []).forEach(key => loadSet(key).forEach(id => favorites.add(id)));
      (cfg.legacyVisitedStorageKeys || []).forEach(key => loadSet(key).forEach(id => visited.add(id)));
    }
    localStorage.setItem(favoriteKey(eventId), JSON.stringify([...favorites]));
    localStorage.setItem(visitedKey(eventId), JSON.stringify([...visited]));
    return { favorites, visited };
  }

  const state = {
    events: [], currentEventId: null, eventInfo: null, eventStatusFilter: "all",
    exhibitors: [], venue: null, filtered: [], category: "すべて", query: "", selectedTags: new Set(),
    viewMode: "all", favorites: new Set(), visited: new Set(),
    selectedBooth: null, rotation: 0,
    scale: 1, tx: 0, ty: 0, pointers: new Map(), dragStart: null, pinchStart: null
  };

  async function init() {
    Object.assign(els, {
      eventPicker: $("eventPicker"), eventList: $("eventList"), appContent: $("appContent"),
      eventName: $("eventName"), eventMeta: $("eventMeta"), searchInput: $("searchInput"), categoryFilters: $("categoryFilters"), tagFilters: $("tagFilters"),
      resultCount: $("resultCount"), clearFiltersBtn: $("clearFiltersBtn"), exhibitorList: $("exhibitorList"), mapContent: $("mapContent"), mapRotationLayer: $("mapRotationLayer"),
      venueMap: $("venueMap"), mapViewport: $("mapViewport"), zoomInBtn: $("zoomInBtn"), zoomOutBtn: $("zoomOutBtn"), resetViewBtn: $("resetViewBtn"),
      favoriteCount: $("favoriteCount"), visitedCount: $("visitedCount"), listModeLabel: $("listModeLabel"), detailSheet: $("detailSheet"),
      detailBackdrop: $("detailBackdrop"), detailContent: $("detailContent"), closeDetailBtn: $("closeDetailBtn"), toast: $("toast")
    });
    document.title = `${cfg.name} ${cfg.version}`;
    try {
      const eventsRes = await fetch(cfg.eventsFile, { cache: "no-store" });
      if (!eventsRes.ok) throw new Error("events.json を読み込めませんでした");
      state.events = await eventsRes.json();
      bindEventPicker();
      const params = new URL(window.location.href).searchParams;
      const eventId = params.get("event");
      if (!eventId) { renderEventPicker(); return; }
      await loadEvent(eventId);
    } catch (err) {
      console.error(err);
      if (els.eventList) els.eventList.innerHTML = `<div class="event-empty"><strong>イベントデータを読み込めませんでした。</strong><br><small>${escapeHtml(err.message)}</small></div>`;
    }
  }

  function eventPath(eventId, file) {
    return `${cfg.eventsBasePath}/${encodeURIComponent(eventId)}/${file}`;
  }
  function bindEventPicker() {
    document.querySelectorAll("[data-event-status]").forEach(btn => btn.addEventListener("click", () => {
      state.eventStatusFilter = btn.dataset.eventStatus;
      document.querySelectorAll("[data-event-status]").forEach(x => x.classList.toggle("active", x === btn));
      renderEventPicker();
    }));
  }
  function statusLabel(status) {
    return ({ upcoming:"開催予定", ongoing:"開催中", past:"終了" })[status] || "イベント";
  }
  function eventDateLabel(e) {
    if (!e.date_start) return "開催日未登録";
    return e.date_end && e.date_end !== e.date_start ? `${e.date_start} ～ ${e.date_end}` : e.date_start;
  }
  function renderEventPicker() {
    els.appContent.hidden = true;
    els.eventPicker.hidden = false;
    const list = state.events.filter(e => state.eventStatusFilter === "all" || e.status === state.eventStatusFilter);
    els.eventList.innerHTML = list.length ? list.map(e => {
      const u = new URL(window.location.href); u.search = ""; u.hash = ""; u.searchParams.set("event", e.event_id);
      return `<article class="event-card"><span class="event-status-badge">${escapeHtml(statusLabel(e.status))}</span><div class="event-date">${escapeHtml(eventDateLabel(e))}</div><h2>${escapeHtml(e.name || e.event_id)}</h2><div class="event-venue">📍 ${escapeHtml(e.venue_name || "会場未登録")}</div>${e.description?`<div class="event-description">${escapeHtml(e.description)}</div>`:""}<a class="event-open" href="${escapeHtml(u.toString())}">マップを見る</a></article>`;
    }).join("") : '<div class="event-empty">該当するイベントはありません。</div>';
  }
  async function loadEvent(eventId) {
    const registry = state.events.find(e => e.event_id === eventId);
    if (!registry) { renderEventPicker(); throw new Error(`イベント ${eventId} は events.json に登録されていません`); }
    const [eventRes, venueRes, exhibitorRes] = await Promise.all([
      fetch(eventPath(eventId, "event.json"), {cache:"no-store"}),
      fetch(eventPath(eventId, "venue.json"), {cache:"no-store"}),
      fetch(eventPath(eventId, "exhibitors.json"), {cache:"no-store"})
    ]);
    if (!venueRes.ok || !exhibitorRes.ok) throw new Error("イベントの会場または出店者データを読み込めませんでした");
    state.currentEventId = eventId;
    state.eventInfo = eventRes.ok ? await eventRes.json() : registry;
    state.venue = await venueRes.json();
    state.exhibitors = await exhibitorRes.json();
    const personal = migrateLegacyState(eventId); state.favorites = personal.favorites; state.visited = personal.visited;
    cleanStoredState(); validateData();
    els.eventPicker.hidden = true; els.appContent.hidden = false;
    renderHeader(); renderMap(); renderCategories(); renderTags(); bindEvents(); updateSummary(); applyFilters(); resetView();
    requestAnimationFrame(openBoothFromUrl);
  }

  function cleanStoredState() {
    const valid = new Set(state.exhibitors.map(e => e.booth_id));
    state.favorites = new Set([...state.favorites].filter(id => valid.has(id)));
    state.visited = new Set([...state.visited].filter(id => valid.has(id)));
    savePersonalState();
  }
  function savePersonalState() {
    if (!state.currentEventId) return;
    localStorage.setItem(favoriteKey(state.currentEventId), JSON.stringify([...state.favorites]));
    localStorage.setItem(visitedKey(state.currentEventId), JSON.stringify([...state.visited]));
  }
  function validateData() {
    const boothIds = new Set((state.venue.booths || []).map(b => b.id));
    state.exhibitors.forEach(e => { if (!boothIds.has(e.booth_id)) console.warn(`Unknown booth_id: ${e.booth_id}`); });
  }
  function renderHeader() {
    const e = state.eventInfo || {};
    els.eventName.textContent = e.name || cfg.name;
    els.eventMeta.textContent = [eventDateLabel(e), e.time, e.venue_name].filter(Boolean).join("  ·  ");
  }
  function svgEl(name, attrs={}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
    return el;
  }

  function originalViewBox() { return state.venue.viewBox || [0,0,1000,700]; }
  function rotatedSize() {
    const [, , w, h] = originalViewBox();
    return state.rotation % 180 === 0 ? [w, h] : [h, w];
  }
  function rotationMatrix() {
    const [, , w, h] = originalViewBox();
    if (state.rotation === 90) return `matrix(0 1 -1 0 ${h} 0)`;
    if (state.rotation === 180) return `matrix(-1 0 0 -1 ${w} ${h})`;
    if (state.rotation === 270) return `matrix(0 -1 1 0 0 ${w})`;
    return "matrix(1 0 0 1 0 0)";
  }
  function rotatePoint(x, y) {
    const [vx, vy, w, h] = originalViewBox();
    const nx = x - vx, ny = y - vy;
    if (state.rotation === 90) return { x: h - ny, y: nx };
    if (state.rotation === 180) return { x: w - nx, y: h - ny };
    if (state.rotation === 270) return { x: ny, y: w - nx };
    return { x: nx, y: ny };
  }

  function renderMap() {
    const g = els.mapContent; g.innerHTML = "";
    const [vx,vy,w,h] = originalViewBox();
    const [rw,rh] = rotatedSize();
    els.venueMap.setAttribute("viewBox", `0 0 ${rw} ${rh}`);
    els.mapRotationLayer.setAttribute("transform", rotationMatrix());
    g.setAttribute("transform", `translate(${-vx} ${-vy})`);
    g.appendChild(svgEl("rect", {x:vx+20,y:vy+12,width:Math.max(100,w-40),height:Math.max(100,h-35),rx:30,class:"venue-bg"}));
    (state.venue.aisles || []).forEach(a => g.appendChild(svgEl("rect", {...a, rx:16, class:"aisle"})));
    (state.venue.facilities || []).forEach(f => {
      g.appendChild(svgEl("rect", {x:f.x,y:f.y,width:f.width,height:f.height,rx:16,class:f.type === "entrance" ? "entrance" : "facility"}));
      const t = svgEl("text", {x:f.x+f.width/2,y:f.y+f.height/2,class:"facility-text"}); t.textContent=f.label; g.appendChild(t);
    });
    (state.venue.booths || []).forEach(b => {
      const booth = svgEl("g", {class:"booth", "data-booth-id":b.id, tabindex:"0", role:"button", "aria-label":`${b.id} ブース`});
      booth.appendChild(svgEl("rect", {x:b.x,y:b.y,width:b.width,height:b.height}));
      const text = svgEl("text", {x:b.x+b.width/2,y:b.y+b.height/2}); text.textContent=b.id; booth.appendChild(text);
      const status = svgEl("text", {x:b.x+b.width-10,y:b.y+18,class:"status-mark"}); status.textContent=""; booth.appendChild(status);
      booth.addEventListener("click", () => selectBooth(b.id, true));
      booth.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); selectBooth(b.id, true); } });
      g.appendChild(booth);
    });
    updateRotationButtons();
  }

  function renderCategories() {
    const cats = [...new Set(state.exhibitors.flatMap(e => e.categories || []))].sort((a,b)=>a.localeCompare(b,"ja"));
    els.categoryFilters.innerHTML = ["すべて", ...cats].map(c => `<button class="category-chip${c === state.category ? " active" : ""}" type="button" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");
    els.categoryFilters.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => { state.category = btn.dataset.category; renderCategories(); applyFilters(); }));
  }
  function renderTags() {
    const tags = [...new Set(state.exhibitors.flatMap(tagList))].sort((a,b)=>a.localeCompare(b,"ja"));
    if (!tags.length) { els.tagFilters.innerHTML = '<span class="filter-empty">タグは登録されていません</span>'; return; }
    els.tagFilters.innerHTML = tags.map(t => `<button class="tag-filter-chip${state.selectedTags.has(t) ? " active" : ""}" type="button" data-tag="${escapeHtml(t)}"># ${escapeHtml(t)}</button>`).join("");
    els.tagFilters.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => {
      const tag = btn.dataset.tag;
      if (state.selectedTags.has(tag)) state.selectedTags.delete(tag); else state.selectedTags.add(tag);
      renderTags(); applyFilters();
    }));
  }
  function modeMatch(id) {
    if (state.viewMode === "favorites") return state.favorites.has(id);
    if (state.viewMode === "unvisited") return state.favorites.has(id) && !state.visited.has(id);
    if (state.viewMode === "visited") return state.visited.has(id);
    return true;
  }
  function modeLabel() { return ({all:"すべて", favorites:"行きたいブース", unvisited:"行きたい・未訪問", visited:"訪問済み"})[state.viewMode] || "すべて"; }

  function applyFilters() {
    const q = normalize(state.query);
    state.filtered = state.exhibitors.filter(e => {
      const tags = tagList(e);
      const text = normalize([e.booth_id,e.shop_name,e.description,...(e.categories||[]),...(e.keywords||[]),...tags,e.note].join(" "));
      const tagMatch = !state.selectedTags.size || tags.some(t => state.selectedTags.has(t));
      return (!q || text.includes(q)) && (state.category === "すべて" || (e.categories || []).includes(state.category)) && tagMatch && modeMatch(e.booth_id);
    });
    els.resultCount.textContent = `${state.filtered.length}件`;
    els.listModeLabel.textContent = modeLabel();
    document.querySelectorAll("[data-view-mode]").forEach(btn => btn.classList.toggle("active", btn.dataset.viewMode === state.viewMode));
    renderList(); updateSummary(); updateMapState();
  }
  function statusBadges(id) {
    const badges=[];
    if (state.favorites.has(id)) badges.push('<span class="status-badge favorite">♡ 行きたい</span>');
    if (state.visited.has(id)) badges.push('<span class="status-badge visited">✓ 行った</span>');
    return badges.join("");
  }
  function visualTags(e) {
    return `${(e.categories||[]).map(c=>`<span class="tag">${escapeHtml(c)}</span>`).join("")}${tagList(e).map(t=>`<span class="tag feature-tag"># ${escapeHtml(t)}</span>`).join("")}`;
  }
  function renderList() {
    if (!state.filtered.length) { els.exhibitorList.innerHTML = `<div class="empty-state">条件に合う出店者がありません。<br>検索条件やお気に入り状態を変えてみてください。</div>`; return; }
    els.exhibitorList.innerHTML = state.filtered.map(e => {
      const fav = state.favorites.has(e.booth_id), visited = state.visited.has(e.booth_id);
      return `<article class="exhibitor-item ${visited?"is-visited":""}" data-list-booth="${escapeHtml(e.booth_id)}">
        <div class="exhibitor-top"><div><div class="booth-label">${escapeHtml(e.booth_id)}</div><h3 class="exhibitor-name">${escapeHtml(e.shop_name)}</h3>${statusBadges(e.booth_id)}</div><div class="quick-state-actions"><button class="favorite-button ${fav?"active":""}" data-fav="${escapeHtml(e.booth_id)}" type="button" aria-label="行きたい切替">${fav?"♥":"♡"}</button><button class="visited-button ${visited?"active":""}" data-visited="${escapeHtml(e.booth_id)}" type="button" aria-label="訪問済み切替">${visited?"✓":"○"}</button></div></div>
        <p class="exhibitor-desc">${escapeHtml(e.description)}</p>
        <div class="tags">${visualTags(e)}</div>
        <div class="item-actions"><button data-locate="${escapeHtml(e.booth_id)}" type="button">マップで見る</button><button data-detail="${escapeHtml(e.booth_id)}" type="button">詳細</button><button data-share="${escapeHtml(e.booth_id)}" type="button">共有</button>${instagramLinks(e)}</div>
      </article>`;
    }).join("");
    els.exhibitorList.querySelectorAll("[data-locate]").forEach(b=>b.addEventListener("click",()=>selectBooth(b.dataset.locate,true,true)));
    els.exhibitorList.querySelectorAll("[data-detail]").forEach(b=>b.addEventListener("click",()=>selectBooth(b.dataset.detail,true,false)));
    els.exhibitorList.querySelectorAll("[data-share]").forEach(b=>b.addEventListener("click",()=>shareBooth(b.dataset.share)));
    els.exhibitorList.querySelectorAll("[data-fav]").forEach(b=>b.addEventListener("click",()=>toggleFavorite(b.dataset.fav)));
    els.exhibitorList.querySelectorAll("[data-visited]").forEach(b=>b.addEventListener("click",()=>toggleVisited(b.dataset.visited)));
  }
  function updateSummary() {
    const validIds = new Set(state.exhibitors.map(e=>e.booth_id));
    els.favoriteCount.textContent = [...state.favorites].filter(id=>validIds.has(id)).length;
    els.visitedCount.textContent = [...state.visited].filter(id=>validIds.has(id)).length;
  }
  function updateMapState() {
    const visible = new Set(state.filtered.map(e=>e.booth_id));
    document.querySelectorAll(".booth").forEach(node => {
      const id=node.dataset.boothId;
      const hasFilter = state.query || state.category !== "すべて" || state.selectedTags.size || state.viewMode !== "all";
      node.classList.toggle("filtered-out", hasFilter && !visible.has(id));
      node.classList.toggle("match", hasFilter && visible.has(id));
      node.classList.toggle("favorite", state.favorites.has(id));
      node.classList.toggle("visited", state.visited.has(id));
      node.classList.toggle("selected", state.selectedBooth === id);
      const mark=node.querySelector(".status-mark");
      if (mark) mark.textContent = state.visited.has(id) ? "✓" : (state.favorites.has(id) ? "♥" : "");
    });
  }
  function selectBooth(id, openDetail=true, focusMap=false) {
    const exhibitor = state.exhibitors.find(e=>e.booth_id===id); if (!exhibitor) return;
    state.selectedBooth=id; updateMapState();
    if (focusMap) focusBooth(id);
    if (openDetail) showDetail(exhibitor);
  }
  function focusBooth(id) {
    const b = (state.venue.booths||[]).find(x=>x.id===id); if (!b) return;
    const rect=els.mapViewport.getBoundingClientRect(); const [svgW,svgH]=rotatedSize();
    const p=rotatePoint(b.x+b.width/2,b.y+b.height/2);
    state.scale=Math.max(1.25, Math.min(2.2, rect.width/520));
    // SVGのpreserveAspectRatio="xMidYMid meet"による余白も含めてフォーカス位置を計算する。
    const baseScale=Math.min(rect.width/svgW, rect.height/svgH);
    const offsetX=(rect.width-svgW*baseScale)/2, offsetY=(rect.height-svgH*baseScale)/2;
    state.tx=rect.width/2-state.scale*(offsetX+p.x*baseScale);
    state.ty=rect.height/2-state.scale*(offsetY+p.y*baseScale);
    clampTransform(); applyTransform();
    if (window.innerWidth < 921) els.mapViewport.scrollIntoView({behavior:"smooth", block:"center"});
  }
  function showDetail(e) {
    const fav = state.favorites.has(e.booth_id), visited = state.visited.has(e.booth_id);
    els.detailContent.innerHTML = `<div class="detail-booth">BOOTH ${escapeHtml(e.booth_id)}</div><h2 class="detail-title">${escapeHtml(e.shop_name)}</h2>
      <div class="detail-status">${statusBadges(e.booth_id) || '<span class="status-badge neutral">未登録</span>'}</div>
      <div class="tags">${visualTags(e)}</div>
      <p class="detail-description">${escapeHtml(e.description)}</p>${e.note?`<p><strong>メモ：</strong>${escapeHtml(e.note)}</p>`:""}
      <div class="detail-links favorite-actions"><button id="detailFavBtn" class="${fav?"primary":""}" type="button">${fav?"♥ 行きたい登録済み":"♡ 行きたい"}</button><button id="detailVisitedBtn" class="${visited?"visited-primary":""}" type="button">${visited?"✓ 行った":"○ 行ったにする"}</button></div>
      <div class="detail-links"><button id="detailLocateBtn" type="button">マップで見る</button><button id="detailShareBtn" type="button">共有URL</button>${instagramLinks(e)}${urlOk(e.shop_url)?`<a href="${escapeHtml(e.shop_url)}" target="_blank" rel="noopener noreferrer">ショップ ↗</a>`:""}</div>`;
    els.detailSheet.hidden=false; els.detailBackdrop.hidden=false;
    $("detailFavBtn").addEventListener("click",()=>{toggleFavorite(e.booth_id,false); showDetail(e);});
    $("detailVisitedBtn").addEventListener("click",()=>{toggleVisited(e.booth_id,false); showDetail(e);});
    $("detailLocateBtn").addEventListener("click",()=>focusBooth(e.booth_id));
    $("detailShareBtn").addEventListener("click",()=>shareBooth(e.booth_id));
  }
  function closeDetail(){ els.detailSheet.hidden=true; els.detailBackdrop.hidden=true; }

  function boothUrl(id) {
    const u = new URL(window.location.href);
    u.searchParams.set("event", state.currentEventId);
    u.searchParams.set("booth", id);
    u.hash = "";
    return u.toString();
  }
  async function shareBooth(id) {
    const e = state.exhibitors.find(x=>x.booth_id===id);
    const url = boothUrl(id);
    if (navigator.share && e) {
      try { await navigator.share({ title: `${e.shop_name} / ${id}`, text: `${id} ${e.shop_name}`, url }); return; }
      catch (err) { if (err?.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); toast("ブース共有URLをコピーしました"); }
    catch (_) { window.prompt("このURLをコピーしてください", url); }
  }
  function openBoothFromUrl() {
    const params = new URL(window.location.href).searchParams;
    const eventId = params.get("event"), id = params.get("booth");
    if (!id || eventId !== state.currentEventId) return;
    if (state.exhibitors.some(e=>e.booth_id===id)) selectBooth(id, true, true);
    else toast(`ブース ${id} は見つかりませんでした`);
  }

  function toggleFavorite(id, refreshDetail=true) {
    if (state.favorites.has(id)) { state.favorites.delete(id); toast("行きたいから外しました"); }
    else { state.favorites.add(id); toast("行きたいに追加しました ♡"); }
    savePersonalState(); applyFilters();
    if (refreshDetail && !els.detailSheet.hidden) { const e=state.exhibitors.find(x=>x.booth_id===id); if(e) showDetail(e); }
  }
  function toggleVisited(id, refreshDetail=true) {
    if (state.visited.has(id)) { state.visited.delete(id); toast("未訪問に戻しました"); }
    else { state.visited.add(id); toast("行ったにしました ✓"); }
    savePersonalState(); applyFilters();
    if (refreshDetail && !els.detailSheet.hidden) { const e=state.exhibitors.find(x=>x.booth_id===id); if(e) showDetail(e); }
  }

  function setRotation(angle) {
    state.rotation = [0,90,180,270].includes(angle) ? angle : 0;
    renderMap(); resetView(); updateMapState();
    toast(`地図を ${state.rotation}° にしました`);
  }
  function updateRotationButtons() {
    document.querySelectorAll("[data-rotation]").forEach(btn => btn.classList.toggle("active", Number(btn.dataset.rotation) === state.rotation));
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", e=>{ state.query=e.target.value; applyFilters(); });
    els.clearFiltersBtn.addEventListener("click",()=>{ state.query=""; state.category="すべて"; state.selectedTags.clear(); state.viewMode="all"; els.searchInput.value=""; renderCategories(); renderTags(); applyFilters(); });
    document.querySelectorAll("[data-view-mode]").forEach(btn=>btn.addEventListener("click",()=>{state.viewMode=btn.dataset.viewMode; applyFilters();}));
    document.querySelectorAll("[data-rotation]").forEach(btn=>btn.addEventListener("click",()=>setRotation(Number(btn.dataset.rotation))));
    els.closeDetailBtn.addEventListener("click", closeDetail); els.detailBackdrop.addEventListener("click", closeDetail);
    els.zoomInBtn.addEventListener("click",()=>zoomAt(1.2)); els.zoomOutBtn.addEventListener("click",()=>zoomAt(1/1.2)); els.resetViewBtn.addEventListener("click",resetView);
    els.mapViewport.addEventListener("wheel", e=>{ e.preventDefault(); const rect=els.mapViewport.getBoundingClientRect(); zoomAt(e.deltaY<0?1.12:1/1.12, e.clientX-rect.left, e.clientY-rect.top); }, {passive:false});
    els.mapViewport.addEventListener("pointerdown", pointerDown); els.mapViewport.addEventListener("pointermove", pointerMove); els.mapViewport.addEventListener("pointerup", pointerUp); els.mapViewport.addEventListener("pointercancel", pointerUp);
    window.addEventListener("resize",()=>{ clampTransform(); applyTransform(); });
  }
  function pointerDown(e){
    if (e.target.closest && e.target.closest(".booth")) return;
    els.mapViewport.setPointerCapture(e.pointerId);
    state.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(state.pointers.size===1){state.dragStart={x:e.clientX,y:e.clientY,tx:state.tx,ty:state.ty}; els.mapViewport.classList.add("dragging");}
    if(state.pointers.size===2){const p=[...state.pointers.values()]; state.pinchStart={dist:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),scale:state.scale};}
  }
  function pointerMove(e){ if(!state.pointers.has(e.pointerId))return; state.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(state.pointers.size===1&&state.dragStart){state.tx=state.dragStart.tx+(e.clientX-state.dragStart.x);state.ty=state.dragStart.ty+(e.clientY-state.dragStart.y);clampTransform();applyTransform();} else if(state.pointers.size===2&&state.pinchStart){const p=[...state.pointers.values()];const dist=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y);const centerX=(p[0].x+p[1].x)/2-els.mapViewport.getBoundingClientRect().left;const centerY=(p[0].y+p[1].y)/2-els.mapViewport.getBoundingClientRect().top;const target=state.pinchStart.scale*(dist/state.pinchStart.dist);zoomTo(target,centerX,centerY);} }
  function pointerUp(e){state.pointers.delete(e.pointerId); if(state.pointers.size<2)state.pinchStart=null; if(state.pointers.size===0){state.dragStart=null;els.mapViewport.classList.remove("dragging");} else {const p=[...state.pointers.values()][0];state.dragStart={x:p.x,y:p.y,tx:state.tx,ty:state.ty};}}
  function zoomAt(factor,cx,cy){ const rect=els.mapViewport.getBoundingClientRect(); zoomTo(state.scale*factor, cx??rect.width/2, cy??rect.height/2); }
  function zoomTo(newScale,cx,cy){ const old=state.scale; newScale=Math.max(0.8,Math.min(3.5,newScale)); const ratio=newScale/old; state.tx=cx-(cx-state.tx)*ratio; state.ty=cy-(cy-state.ty)*ratio; state.scale=newScale; clampTransform(); applyTransform(); }
  function clampTransform(){ const rect=els.mapViewport.getBoundingClientRect(); const contentW=rect.width*state.scale, contentH=rect.height*state.scale; const pad=80; state.tx=Math.min(pad,Math.max(rect.width-contentW-pad,state.tx)); state.ty=Math.min(pad,Math.max(rect.height-contentH-pad,state.ty)); }
  function applyTransform(){ els.venueMap.style.transform=`translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`; }
  function resetView(){ state.scale=1; state.tx=0; state.ty=0; applyTransform(); }
  function toast(msg){ els.toast.textContent=msg; els.toast.classList.add("show"); clearTimeout(toast.t); toast.t=setTimeout(()=>els.toast.classList.remove("show"),1700); }
  document.addEventListener("DOMContentLoaded", init);
})();

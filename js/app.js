(() => {
  "use strict";
  const cfg = window.APP_CONFIG;
  const $ = (id) => document.getElementById(id);
  const els = {};
  const escapeHtml = (v="") => String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const normalize = (v="") => String(v).toLowerCase().normalize("NFKC");
  const urlOk = (u) => /^https?:\/\//i.test(u || "");

  function loadSet(key) {
    try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); }
    catch { return new Set(); }
  }
  function migrateFavorites() {
    const current = loadSet(cfg.favoriteStorageKey);
    (cfg.legacyFavoriteStorageKeys || []).forEach(key => loadSet(key).forEach(id => current.add(id)));
    localStorage.setItem(cfg.favoriteStorageKey, JSON.stringify([...current]));
    return current;
  }

  const state = {
    exhibitors: [], venue: null, filtered: [], category: "すべて", query: "",
    viewMode: "all", favorites: migrateFavorites(), visited: loadSet(cfg.visitedStorageKey),
    selectedBooth: null, scale: 1, tx: 0, ty: 0, pointers: new Map(), dragStart: null, pinchStart: null
  };

  async function init() {
    Object.assign(els, {
      eventName: $("eventName"), eventMeta: $("eventMeta"), searchInput: $("searchInput"), categoryFilters: $("categoryFilters"),
      resultCount: $("resultCount"), clearFiltersBtn: $("clearFiltersBtn"), exhibitorList: $("exhibitorList"), mapContent: $("mapContent"),
      venueMap: $("venueMap"), mapViewport: $("mapViewport"), zoomInBtn: $("zoomInBtn"), zoomOutBtn: $("zoomOutBtn"), resetViewBtn: $("resetViewBtn"),
      favoriteCount: $("favoriteCount"), visitedCount: $("visitedCount"), listModeLabel: $("listModeLabel"), detailSheet: $("detailSheet"),
      detailBackdrop: $("detailBackdrop"), detailContent: $("detailContent"), closeDetailBtn: $("closeDetailBtn"), toast: $("toast")
    });
    try {
      const [venueRes, exhibitorRes] = await Promise.all([fetch(cfg.venueFile), fetch(cfg.dataFile)]);
      if (!venueRes.ok || !exhibitorRes.ok) throw new Error("データファイルを読み込めませんでした");
      state.venue = await venueRes.json();
      state.exhibitors = await exhibitorRes.json();
      cleanStoredState(); validateData();
      renderHeader(); renderMap(); renderCategories(); bindEvents(); updateSummary(); applyFilters(); resetView();
      document.title = `${cfg.name} ${cfg.version}`;
    } catch (err) {
      console.error(err);
      els.exhibitorList.innerHTML = `<div class="empty-state"><strong>データを読み込めませんでした。</strong><br>ローカルでは start_local_server.bat から起動してください。<br><small>${escapeHtml(err.message)}</small></div>`;
    }
  }

  function cleanStoredState() {
    const valid = new Set(state.exhibitors.map(e => e.booth_id));
    state.favorites = new Set([...state.favorites].filter(id => valid.has(id)));
    state.visited = new Set([...state.visited].filter(id => valid.has(id)));
    savePersonalState();
  }
  function savePersonalState() {
    localStorage.setItem(cfg.favoriteStorageKey, JSON.stringify([...state.favorites]));
    localStorage.setItem(cfg.visitedStorageKey, JSON.stringify([...state.visited]));
  }
  function validateData() {
    const boothIds = new Set((state.venue.booths || []).map(b => b.id));
    state.exhibitors.forEach(e => { if (!boothIds.has(e.booth_id)) console.warn(`Unknown booth_id: ${e.booth_id}`); });
  }
  function renderHeader() {
    const e = state.venue.event || {};
    els.eventName.textContent = e.name || cfg.name;
    els.eventMeta.textContent = [e.date, e.time, e.venue].filter(Boolean).join("  ·  ");
  }
  function svgEl(name, attrs={}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
    return el;
  }
  function renderMap() {
    const g = els.mapContent; g.innerHTML = "";
    const [x,y,w,h] = state.venue.viewBox || [0,0,1000,700];
    els.venueMap.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
    g.appendChild(svgEl("rect", {x:x+20,y:y+12,width:Math.max(100,w-40),height:Math.max(100,h-35),rx:30,class:"venue-bg"}));
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
  }
  function renderCategories() {
    const cats = [...new Set(state.exhibitors.flatMap(e => e.categories || []))].sort((a,b)=>a.localeCompare(b,"ja"));
    els.categoryFilters.innerHTML = ["すべて", ...cats].map(c => `<button class="category-chip${c === state.category ? " active" : ""}" type="button" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");
    els.categoryFilters.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => { state.category = btn.dataset.category; renderCategories(); applyFilters(); }));
  }
  function modeMatch(id) {
    if (state.viewMode === "favorites") return state.favorites.has(id);
    if (state.viewMode === "unvisited") return state.favorites.has(id) && !state.visited.has(id);
    if (state.viewMode === "visited") return state.visited.has(id);
    return true;
  }
  function modeLabel() {
    return ({all:"すべて", favorites:"行きたいブース", unvisited:"行きたい・未訪問", visited:"訪問済み"})[state.viewMode] || "すべて";
  }
  function applyFilters() {
    const q = normalize(state.query);
    state.filtered = state.exhibitors.filter(e => {
      const text = normalize([e.booth_id,e.shop_name,e.description,...(e.categories||[]),...(e.keywords||[]),e.note].join(" "));
      return (!q || text.includes(q)) && (state.category === "すべて" || (e.categories || []).includes(state.category)) && modeMatch(e.booth_id);
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
  function renderList() {
    if (!state.filtered.length) { els.exhibitorList.innerHTML = `<div class="empty-state">条件に合う出店者がありません。<br>検索条件やお気に入り状態を変えてみてください。</div>`; return; }
    els.exhibitorList.innerHTML = state.filtered.map(e => {
      const fav = state.favorites.has(e.booth_id), visited = state.visited.has(e.booth_id);
      return `<article class="exhibitor-item ${visited?"is-visited":""}" data-list-booth="${escapeHtml(e.booth_id)}">
        <div class="exhibitor-top"><div><div class="booth-label">${escapeHtml(e.booth_id)}</div><h3 class="exhibitor-name">${escapeHtml(e.shop_name)}</h3>${statusBadges(e.booth_id)}</div><div class="quick-state-actions"><button class="favorite-button ${fav?"active":""}" data-fav="${escapeHtml(e.booth_id)}" type="button" aria-label="行きたい切替">${fav?"♥":"♡"}</button><button class="visited-button ${visited?"active":""}" data-visited="${escapeHtml(e.booth_id)}" type="button" aria-label="訪問済み切替">${visited?"✓":"○"}</button></div></div>
        <p class="exhibitor-desc">${escapeHtml(e.description)}</p>
        <div class="tags">${(e.categories||[]).map(c=>`<span class="tag">${escapeHtml(c)}</span>`).join("")}</div>
        <div class="item-actions"><button data-locate="${escapeHtml(e.booth_id)}" type="button">マップで見る</button><button data-detail="${escapeHtml(e.booth_id)}" type="button">詳細</button>${urlOk(e.instagram_url)?`<a href="${escapeHtml(e.instagram_url)}" target="_blank" rel="noopener noreferrer">Instagram ↗</a>`:""}</div>
      </article>`;
    }).join("");
    els.exhibitorList.querySelectorAll("[data-locate]").forEach(b=>b.addEventListener("click",()=>selectBooth(b.dataset.locate,true,true)));
    els.exhibitorList.querySelectorAll("[data-detail]").forEach(b=>b.addEventListener("click",()=>selectBooth(b.dataset.detail,true,false)));
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
      const hasFilter = state.query || state.category !== "すべて" || state.viewMode !== "all";
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
    const rect=els.mapViewport.getBoundingClientRect(); const [vx,vy,svgW,svgH]=state.venue.viewBox || [0,0,1000,700];
    state.scale=Math.max(1.25, Math.min(2.2, rect.width/520));
    const sx=rect.width/svgW*state.scale, sy=rect.height/svgH*state.scale;
    state.tx=rect.width/2-(b.x+b.width/2-vx)*sx; state.ty=rect.height/2-(b.y+b.height/2-vy)*sy;
    clampTransform(); applyTransform();
    if (window.innerWidth < 921) els.mapViewport.scrollIntoView({behavior:"smooth", block:"center"});
  }
  function showDetail(e) {
    const fav = state.favorites.has(e.booth_id), visited = state.visited.has(e.booth_id);
    els.detailContent.innerHTML = `<div class="detail-booth">BOOTH ${escapeHtml(e.booth_id)}</div><h2 class="detail-title">${escapeHtml(e.shop_name)}</h2>
      <div class="detail-status">${statusBadges(e.booth_id) || '<span class="status-badge neutral">未登録</span>'}</div>
      <div class="tags">${(e.categories||[]).map(c=>`<span class="tag">${escapeHtml(c)}</span>`).join("")}</div>
      <p class="detail-description">${escapeHtml(e.description)}</p>${e.note?`<p><strong>メモ：</strong>${escapeHtml(e.note)}</p>`:""}
      <div class="detail-links favorite-actions"><button id="detailFavBtn" class="${fav?"primary":""}" type="button">${fav?"♥ 行きたい登録済み":"♡ 行きたい"}</button><button id="detailVisitedBtn" class="${visited?"visited-primary":""}" type="button">${visited?"✓ 行った":"○ 行ったにする"}</button></div>
      <div class="detail-links"><button id="detailLocateBtn" type="button">マップで見る</button>${urlOk(e.instagram_url)?`<a href="${escapeHtml(e.instagram_url)}" target="_blank" rel="noopener noreferrer">Instagram ↗</a>`:""}${urlOk(e.shop_url)?`<a href="${escapeHtml(e.shop_url)}" target="_blank" rel="noopener noreferrer">ショップ ↗</a>`:""}</div>`;
    els.detailSheet.hidden=false; els.detailBackdrop.hidden=false;
    $("detailFavBtn").addEventListener("click",()=>{toggleFavorite(e.booth_id,false); showDetail(e);});
    $("detailVisitedBtn").addEventListener("click",()=>{toggleVisited(e.booth_id,false); showDetail(e);});
    $("detailLocateBtn").addEventListener("click",()=>focusBooth(e.booth_id));
  }
  function closeDetail(){ els.detailSheet.hidden=true; els.detailBackdrop.hidden=true; }
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
  function bindEvents() {
    els.searchInput.addEventListener("input", e=>{ state.query=e.target.value; applyFilters(); });
    els.clearFiltersBtn.addEventListener("click",()=>{ state.query=""; state.category="すべて"; state.viewMode="all"; els.searchInput.value=""; renderCategories(); applyFilters(); });
    document.querySelectorAll("[data-view-mode]").forEach(btn=>btn.addEventListener("click",()=>{state.viewMode=btn.dataset.viewMode; applyFilters();}));
    els.closeDetailBtn.addEventListener("click", closeDetail); els.detailBackdrop.addEventListener("click", closeDetail);
    els.zoomInBtn.addEventListener("click",()=>zoomAt(1.2)); els.zoomOutBtn.addEventListener("click",()=>zoomAt(1/1.2)); els.resetViewBtn.addEventListener("click",resetView);
    els.mapViewport.addEventListener("wheel", e=>{ e.preventDefault(); const rect=els.mapViewport.getBoundingClientRect(); zoomAt(e.deltaY<0?1.12:1/1.12, e.clientX-rect.left, e.clientY-rect.top); }, {passive:false});
    els.mapViewport.addEventListener("pointerdown", pointerDown); els.mapViewport.addEventListener("pointermove", pointerMove); els.mapViewport.addEventListener("pointerup", pointerUp); els.mapViewport.addEventListener("pointercancel", pointerUp);
    window.addEventListener("resize",()=>{ clampTransform(); applyTransform(); });
  }
  function pointerDown(e){
    // v1.5.1: Do not capture pointer events that start on a booth.
    // Capturing them at mapViewport can cause the browser to dispatch the
    // subsequent click to the viewport instead of the booth, so booth details
    // may not open on desktop browsers (including GitHub Pages deployments).
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
  function toast(msg){ els.toast.textContent=msg; els.toast.classList.add("show"); clearTimeout(toast.t); toast.t=setTimeout(()=>els.toast.classList.remove("show"),1500); }
  document.addEventListener("DOMContentLoaded", init);
})();

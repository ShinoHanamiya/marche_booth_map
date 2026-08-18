(() => {
  "use strict";

  const cfg = window.APP_CONFIG;
  const $ = id => document.getElementById(id);
  const deepCopy = obj => JSON.parse(JSON.stringify(obj));
  const state = {
    eventMeta: null,
    venue: null,
    exhibitors: [],
    exhibitorIndex: null,
    selection: null,
    multiBooths: new Set(),
    snap: true,
    dirty: false,
    action: null,
    autoExpand: true,
    history: [],
    future: [],
    clipboard: null,
    background: { src: "", opacity: 0.45, fit: "stretch" },
    layers: {
      background: { visible: true, locked: true },
      aisles: { visible: true, locked: false },
      facilities: { visible: true, locked: false },
      booths: { visible: true, locked: false }
    },
    formCheckpointActive: false
  };
  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    Object.assign(els, {
      saveState: $("saveState"), map: $("editorVenueMap"), mapContent: $("editorMapContent"), backgroundLayer: $("editorBackgroundLayer"), overlayLayer: $("editorOverlayLayer"), viewport: $("editorMapViewport"), selectionInfo: $("selectionInfo"),
      eventId: $("eventId"), eventName: $("eventNameInput"), eventDate: $("eventDate"), eventEndDate: $("eventEndDate"), eventTime: $("eventTime"), eventStatus: $("eventStatus"), eventVenue: $("eventVenue"), eventOfficialUrl: $("eventOfficialUrl"), eventDescription: $("eventDescription"),
      venueWidth: $("venueWidth"), venueHeight: $("venueHeight"), venueOriginX: $("venueOriginX"), venueOriginY: $("venueOriginY"), venueSizeBadge: $("venueSizeBadge"), fitMargin: $("fitMargin"), autoExpandToggle: $("autoExpandToggle"),
      boothList: $("boothList"), boothCount: $("boothCount"), boothId: $("boothId"), boothNewId: $("boothNewId"), boothX: $("boothX"), boothY: $("boothY"), boothWidth: $("boothWidth"), boothHeight: $("boothHeight"), boothBadge: $("selectedBoothBadge"),
      exhibitorSelect: $("exhibitorSelect"), locationStatus: $("locationStatus"), exhibitorBoothId: $("exhibitorBoothId"), locationArea: $("locationArea"), locationAreaWrap: $("locationAreaWrap"), facilityAreaList: $("facilityAreaList"), shopName: $("shopName"), categories: $("categories"), keywords: $("keywords"), tags: $("tags"), description: $("description"), instagramUrl: $("instagramUrl"), shopUrl: $("shopUrl"), note: $("note"),
      facilityList: $("facilityList"), facilityBadge: $("selectedFacilityBadge"), facilityType: $("facilityType"), facilityLabel: $("facilityLabel"), facilityX: $("facilityX"), facilityY: $("facilityY"), facilityWidth: $("facilityWidth"), facilityHeight: $("facilityHeight"),
      aisleList: $("aisleList"), aisleBadge: $("selectedAisleBadge"), aisleX: $("aisleX"), aisleY: $("aisleY"), aisleWidth: $("aisleWidth"), aisleHeight: $("aisleHeight"),
      gridPrefix: $("gridPrefix"), gridStartNo: $("gridStartNo"), gridRows: $("gridRows"), gridCols: $("gridCols"), gridWidth: $("gridWidth"), gridHeight: $("gridHeight"), gridGapX: $("gridGapX"), gridGapY: $("gridGapY"), gridStartX: $("gridStartX"), gridStartY: $("gridStartY"),
      multiCountBadge: $("multiCountBadge"), validation: $("validationResult"), toast: $("toast"), backgroundBadge: $("backgroundBadge"), backgroundFileInput: $("backgroundFileInput"), backgroundOpacity: $("backgroundOpacity"), backgroundFit: $("backgroundFit")
    });
    bindEvents();
    await loadCurrent();
  }

  async function loadCurrent() {
    try {
      const [mr, vr, er] = await Promise.all([
        fetch(cfg.eventFile, { cache: "no-store" }),
        fetch(cfg.venueFile, { cache: "no-store" }),
        fetch(cfg.dataFile, { cache: "no-store" })
      ]);
      if (!mr.ok || !vr.ok || !er.ok) throw new Error("イベントデータを読み込めませんでした");
      state.eventMeta = normalizeEventMeta(await mr.json());
      state.venue = normalizeVenue(await vr.json());
      state.exhibitors = normalizeExhibitors(await er.json());
      state.history = []; state.future = []; state.clipboard = null;
      resetToFirstBooth();
      state.dirty = false;
      const viewLink = $("viewCurrentEventLink");
      if (viewLink) viewLink.href = `index.html?event=${encodeURIComponent(cfg.editorEventId)}`;
      document.title = `${state.eventMeta.name || cfg.editorEventId} - Marche Booth Map Editor ${cfg.version}`;
      renderAll();
      setSaveState(`${cfg.editorEventId} を読み込みました`);
    } catch (err) {
      setSaveState("読込失敗: " + err.message, true);
    }
  }

  function normalizeVenue(v) {
    v.booths = Array.isArray(v.booths) ? v.booths : [];
    v.facilities = Array.isArray(v.facilities) ? v.facilities : [];
    v.aisles = Array.isArray(v.aisles) ? v.aisles : [];
    v.viewBox = Array.isArray(v.viewBox) && v.viewBox.length === 4 ? v.viewBox : [0, 0, 1000, 700];
    v.event = v.event || {};
    return v;
  }

  function normalizeExhibitors(list) {
    return (Array.isArray(list) ? list : []).map((e, i) => ({
      ...e,
      booth_id: String(e?.booth_id || `U${String(i+1).padStart(2,"0")}`).trim(),
      location_status: ["fixed","area","undecided"].includes(e?.location_status) ? e.location_status : "fixed",
      location_area: String(e?.location_area || e?.area_label || "").trim()
    }));
  }

  function normalizeEventMeta(m) {
    return {
      event_id: m?.event_id || cfg.editorEventId,
      name: m?.name || cfg.editorEventId,
      date_start: m?.date_start || "",
      date_end: m?.date_end || m?.date_start || "",
      time: m?.time || "",
      venue_name: m?.venue_name || "",
      status: ["upcoming", "ongoing", "past"].includes(m?.status) ? m.status : "upcoming",
      official_url: m?.official_url || "",
      description: m?.description || ""
    };
  }

  function resetToFirstBooth() {
    const b = state.venue?.booths?.[0];
    state.selection = b ? { kind: "booth", id: b.id } : null;
    state.multiBooths = new Set(b ? [b.id] : []);
    state.exhibitorIndex = b ? state.exhibitors.findIndex(e => e.booth_id === b.id) : (state.exhibitors.length ? 0 : null);
  }

  function bindEvents() {
    $("undoBtn").addEventListener("click", undo);
    $("redoBtn").addEventListener("click", redo);
    $("copyBtn").addEventListener("click", copySelection);
    $("pasteBtn").addEventListener("click", pasteSelection);
    els.backgroundFileInput.addEventListener("change", loadBackgroundImage);
    els.backgroundOpacity.addEventListener("input", () => { state.background.opacity = Number(els.backgroundOpacity.value); renderBackground(); });
    els.backgroundFit.addEventListener("change", () => { state.background.fit = els.backgroundFit.value; renderBackground(); });
    $("clearBackgroundBtn").addEventListener("click", () => { state.background.src = ""; renderBackground(); renderLayerControls(); toast("背景画像を解除しました"); });
    document.querySelectorAll(".layer-visible").forEach(el => el.addEventListener("change", () => { state.layers[el.dataset.layer].visible = el.checked; renderMap(); renderBackground(); }));
    document.querySelectorAll(".layer-lock").forEach(el => el.addEventListener("change", () => { state.layers[el.dataset.layer].locked = el.checked; if (el.checked) clearLockedSelection(el.dataset.layer); renderAll(); }));
    document.addEventListener("keydown", handleGlobalShortcuts);
    document.addEventListener("focusin", handleFormFocusIn);
    document.addEventListener("focusout", () => { state.formCheckpointActive = false; });
    els.viewport.addEventListener("pointerdown", startMarqueeSelection);
    $("loadCurrentBtn").addEventListener("click", loadCurrent);
    $("eventFileInput").addEventListener("change", e => readJsonFile(e.target.files[0], data => {
      state.eventMeta = normalizeEventMeta(data); markDirty(); renderAll();
    }, "event.json"));
    $("venueFileInput").addEventListener("change", e => readJsonFile(e.target.files[0], data => {
      state.venue = normalizeVenue(data); resetToFirstBooth(); markDirty(); renderAll();
    }, "venue.json"));
    $("exhibitorFileInput").addEventListener("change", e => readJsonFile(e.target.files[0], data => {
      if (!Array.isArray(data)) throw new Error("出店者データは配列である必要があります");
      state.exhibitors = normalizeExhibitors(data); markDirty(); renderAll();
    }, "exhibitors.json"));

    $("downloadEventBtn").addEventListener("click", () => downloadJson("event.json", state.eventMeta));
    $("downloadVenueBtn").addEventListener("click", () => downloadJson("venue.json", state.venue));
    $("downloadExhibitorsBtn").addEventListener("click", () => downloadJson("exhibitors.json", state.exhibitors));
    $("downloadBothBtn").addEventListener("click", () => {
      downloadJson("event.json", state.eventMeta);
      setTimeout(() => downloadJson("venue.json", state.venue), 180);
      setTimeout(() => downloadJson("exhibitors.json", state.exhibitors), 360);
    });
    $("restoreDraftBtn").addEventListener("click", restoreDraft);
    $("clearDraftBtn").addEventListener("click", () => { localStorage.removeItem(cfg.editorDraftKey); toast("自動保存を削除しました"); });

    $("addBoothBtn").addEventListener("click", addBooth);
    document.querySelectorAll(".facility-add").forEach(btn => btn.addEventListener("click", () => addFacility(btn.dataset.type, btn.dataset.label)));
    $("addAisleBtn").addEventListener("click", addAisle);
    $("generateGridBtn").addEventListener("click", generateBoothGrid);
    $("selectAllBoothsBtn").addEventListener("click", selectAllBooths);
    document.querySelectorAll(".align-btn").forEach(btn => btn.addEventListener("click", () => alignSelectedBooths(btn.dataset.action)));
    $("applyVenueSizeBtn").addEventListener("click", applyVenueSize);
    $("fitVenueBtn").addEventListener("click", fitVenueToObjects);
    document.querySelectorAll(".venue-preset").forEach(btn => btn.addEventListener("click", () => applyVenuePreset(Number(btn.dataset.width), Number(btn.dataset.height))));
    els.autoExpandToggle.addEventListener("change", () => { state.autoExpand = els.autoExpandToggle.checked; toast(state.autoExpand ? "自動拡張をONにしました" : "自動拡張をOFFにしました"); });

    $("deleteBoothBtn").addEventListener("click", deleteBooth);
    $("duplicateBoothBtn").addEventListener("click", duplicateBooth);
    $("renameBoothBtn").addEventListener("click", renameBooth);
    $("duplicateFacilityBtn").addEventListener("click", duplicateFacility);
    $("deleteFacilityBtn").addEventListener("click", deleteFacility);
    $("duplicateAisleBtn").addEventListener("click", duplicateAisle);
    $("deleteAisleBtn").addEventListener("click", deleteAisle);
    $("addExhibitorBtn").addEventListener("click", addExhibitor);
    $("addUnlocatedExhibitorBtn").addEventListener("click", addUnlocatedExhibitor);
    $("deleteExhibitorBtn").addEventListener("click", deleteExhibitor);

    $("snapToggleBtn").addEventListener("click", () => { state.snap = !state.snap; renderSnapButton(); });
    $("resetSelectionBtn").addEventListener("click", clearSelection);
    $("validateBtn").addEventListener("click", validateData);

    [els.eventName, els.eventDate, els.eventEndDate, els.eventTime, els.eventStatus, els.eventVenue, els.eventOfficialUrl, els.eventDescription].forEach(el => el.addEventListener("input", syncEventForm));
    els.eventStatus.addEventListener("change", syncEventForm);
    [els.boothX, els.boothY, els.boothWidth, els.boothHeight].forEach(el => el.addEventListener("input", syncBoothForm));
    [els.facilityType, els.facilityLabel, els.facilityX, els.facilityY, els.facilityWidth, els.facilityHeight].forEach(el => el.addEventListener("input", syncFacilityForm));
    [els.aisleX, els.aisleY, els.aisleWidth, els.aisleHeight].forEach(el => el.addEventListener("input", syncAisleForm));
    els.exhibitorSelect.addEventListener("change", () => {
      const value = els.exhibitorSelect.value;
      if (!value) { state.exhibitorIndex = null; renderAll(); return; }
      if (value.startsWith("e:")) {
        state.exhibitorIndex = Number(value.slice(2));
        const e = state.exhibitors[state.exhibitorIndex];
        if (e && e.location_status === "fixed" && state.venue.booths.some(b => b.id === e.booth_id)) selectSingleBooth(e.booth_id, false);
        else { state.selection = null; state.multiBooths.clear(); }
      } else if (value.startsWith("b:")) {
        selectSingleBooth(value.slice(2));
      }
      renderAll();
    });
    [els.locationStatus, els.exhibitorBoothId, els.locationArea, els.shopName, els.categories, els.keywords, els.tags, els.description, els.instagramUrl, els.shopUrl, els.note].forEach(el => el.addEventListener("input", syncExhibitorForm));
    els.locationStatus.addEventListener("change", syncExhibitorForm);

    els.map.addEventListener("pointermove", mapPointerMove);
    els.map.addEventListener("click", e => {
      if (e.target === els.map || e.target.classList.contains("venue-bg")) clearSelection();
    });
    window.addEventListener("pointerup", endPointerAction);
    window.addEventListener("pointercancel", endPointerAction);
    els.viewport.addEventListener("keydown", moveSelectionByKey);
    window.addEventListener("beforeunload", e => { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });
  }

  function renderAll() {
    if (!state.venue) return;
    pruneMultiSelection();
    renderEventForm(); renderVenueSizeForm(); renderMap(); renderBoothList(); renderBoothForm();
    renderExhibitorSelect(); renderExhibitorForm(); renderFacilityList(); renderFacilityForm();
    renderAisleList(); renderAisleForm(); renderSnapButton(); renderSelectionInfo();
    renderMultiTools(); renderBackground(); renderLayerControls(); renderHistoryButtons(); validateData();
  }

  function renderEventForm() {
    const e = state.eventMeta || normalizeEventMeta({});
    els.eventId.value = e.event_id || cfg.editorEventId; els.eventName.value = e.name || ""; els.eventDate.value = e.date_start || ""; els.eventEndDate.value = e.date_end || e.date_start || "";
    els.eventTime.value = e.time || ""; els.eventStatus.value = e.status || "upcoming"; els.eventVenue.value = e.venue_name || "";
    els.eventOfficialUrl.value = e.official_url || ""; els.eventDescription.value = e.description || "";
  }

  function renderVenueSizeForm() {
    const vb = state.venue?.viewBox || [0, 0, 1000, 700];
    els.venueOriginX.value = vb[0]; els.venueOriginY.value = vb[1]; els.venueWidth.value = vb[2]; els.venueHeight.value = vb[3];
    els.venueSizeBadge.textContent = `${Math.round(vb[2])} × ${Math.round(vb[3])}`;
    els.autoExpandToggle.checked = state.autoExpand;
  }

  function applyVenuePreset(width, height) {
    els.venueOriginX.value = 0; els.venueOriginY.value = 0; els.venueWidth.value = width; els.venueHeight.value = height;
    applyVenueSize();
  }

  function applyVenueSize() {
    checkpoint();
    const x = num(els.venueOriginX.value, 0), y = num(els.venueOriginY.value, 0);
    const w = Math.max(300, num(els.venueWidth.value, 1000)), h = Math.max(300, num(els.venueHeight.value, 700));
    const bounds = getObjectBounds();
    if (bounds && (bounds.minX < x || bounds.minY < y || bounds.maxX > x + w || bounds.maxY > y + h)) {
      if (!confirm("配置物の一部が新しい会場範囲の外にあります。このサイズを適用しますか？")) return;
    }
    state.venue.viewBox = [x, y, w, h]; markDirty(); renderAll(); toast(`会場サイズを ${w} × ${h} に変更しました`);
  }

  function fitVenueToObjects() {
    checkpoint();
    const bounds = getObjectBounds();
    if (!bounds) return toast("配置物がありません");
    const margin = Math.max(0, num(els.fitMargin.value, 80));
    const x = Math.floor((bounds.minX - margin) / 10) * 10;
    const y = Math.floor((bounds.minY - margin) / 10) * 10;
    const right = Math.ceil((bounds.maxX + margin) / 10) * 10;
    const bottom = Math.ceil((bounds.maxY + margin) / 10) * 10;
    state.venue.viewBox = [x, y, Math.max(300, right - x), Math.max(300, bottom - y)];
    markDirty(); renderAll(); toast("配置物に合わせて会場サイズを調整しました");
  }

  function getObjectBounds() {
    const objects = [...state.venue.booths, ...state.venue.facilities, ...state.venue.aisles].filter(o => [o.x,o.y,o.width,o.height].every(Number.isFinite));
    if (!objects.length) return null;
    return {
      minX: Math.min(...objects.map(o => o.x)), minY: Math.min(...objects.map(o => o.y)),
      maxX: Math.max(...objects.map(o => o.x + o.width)), maxY: Math.max(...objects.map(o => o.y + o.height))
    };
  }

  function autoExpandVenue(objects) {
    if (!state.autoExpand || !objects?.length) return false;
    const vb = state.venue.viewBox, pad = 80; let [x,y,w,h] = vb; let changed = false;
    const minX = Math.min(...objects.map(o => o.x)), minY = Math.min(...objects.map(o => o.y));
    const maxX = Math.max(...objects.map(o => o.x + o.width)), maxY = Math.max(...objects.map(o => o.y + o.height));
    if (minX < x + 20) { const nx = Math.floor((minX - pad) / 100) * 100; w += x - nx; x = nx; changed = true; }
    if (minY < y + 20) { const ny = Math.floor((minY - pad) / 100) * 100; h += y - ny; y = ny; changed = true; }
    if (maxX > x + w - 20) { w = Math.ceil((maxX - x + pad) / 100) * 100; changed = true; }
    if (maxY > y + h - 20) { h = Math.ceil((maxY - y + pad) / 100) * 100; changed = true; }
    if (changed) state.venue.viewBox = [x,y,Math.max(300,w),Math.max(300,h)];
    return changed;
  }

  function renderMap() {
    const v = state.venue, vb = v.viewBox, g = els.mapContent;
    els.map.setAttribute("viewBox", vb.join(" "));
    g.innerHTML = "";
    g.appendChild(svg("rect", { x: vb[0] + 20, y: vb[1] + 12, width: Math.max(100, vb[2] - 40), height: Math.max(100, vb[3] - 35), rx: 30, class: "venue-bg" }));

    if (state.layers.aisles.visible) v.aisles.forEach((a, i) => {
      const n = svg("g", { class: "edit-aisle" + (isPrimary("aisle", i) ? " selected" : ""), "data-index": i });
      n.appendChild(svg("rect", { x: a.x, y: a.y, width: a.width, height: a.height }));
      const t = svg("text", { x: a.x + a.width / 2, y: a.y + a.height / 2 }); t.textContent = "通路"; n.appendChild(t);
      attachSelectable(n, "aisle", i);
      if (isPrimary("aisle", i)) addResizeHandle(n, "aisle", i, a);
      g.appendChild(n);
    });

    if (state.layers.facilities.visible) v.facilities.forEach((f, i) => {
      const cls = "edit-facility " + (f.type === "entrance" ? "entrance " : "") + (isPrimary("facility", i) ? "selected" : "");
      const n = svg("g", { class: cls, "data-index": i });
      n.appendChild(svg("rect", { x: f.x, y: f.y, width: f.width, height: f.height }));
      const t = svg("text", { x: f.x + f.width / 2, y: f.y + f.height / 2 }); t.textContent = f.label || f.type || "設備"; n.appendChild(t);
      attachSelectable(n, "facility", i);
      if (isPrimary("facility", i)) addResizeHandle(n, "facility", i, f);
      g.appendChild(n);
    });

    if (state.layers.booths.visible) v.booths.forEach(b => {
      const multi = state.multiBooths.has(b.id);
      const primary = isPrimary("booth", b.id);
      const cls = `edit-booth${multi ? " multi-selected" : ""}${primary ? " selected primary-selected" : ""}`;
      const n = svg("g", { class: cls, "data-id": b.id });
      n.appendChild(svg("rect", { x: b.x, y: b.y, width: b.width, height: b.height }));
      const t = svg("text", { x: b.x + b.width / 2, y: b.y + b.height / 2 }); t.textContent = b.id; n.appendChild(t);
      attachSelectable(n, "booth", b.id);
      if (primary) addResizeHandle(n, "booth", b.id, b);
      g.appendChild(n);
    });

    if (state.multiBooths.size > 1) {
      const boxes = getMultiBooths();
      if (boxes.length) {
        const minX = Math.min(...boxes.map(b => b.x)), minY = Math.min(...boxes.map(b => b.y));
        const maxX = Math.max(...boxes.map(b => b.x + b.width)), maxY = Math.max(...boxes.map(b => b.y + b.height));
        g.appendChild(svg("rect", { x: minX - 8, y: minY - 8, width: maxX - minX + 16, height: maxY - minY + 16, rx: 14, class: "multi-outline" }));
      }
    }
    renderMarquee();
  }

  function attachSelectable(node, kind, key) {
    const layer = kind === "booth" ? "booths" : kind === "facility" ? "facilities" : "aisles";
    if (state.layers[layer].locked) { node.classList.add("layer-locked"); return; }
    node.addEventListener("pointerdown", e => {
      if (e.target.classList.contains("resize-handle")) return;
      if (kind === "booth" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); e.stopPropagation(); toggleMultiBooth(key); return;
      }
      startMove(e, kind, key);
    });
  }

  function addResizeHandle(node, kind, key, obj) {
    const size = 18;
    const h = svg("rect", { x: obj.x + obj.width - size / 2, y: obj.y + obj.height - size / 2, width: size, height: size, rx: 4, class: "resize-handle" });
    h.addEventListener("pointerdown", e => startResize(e, kind, key));
    node.appendChild(h);
  }

  function renderBoothList() {
    els.boothCount.textContent = `${state.venue.booths.length}件`;
    els.boothList.innerHTML = state.venue.booths.map(b => {
      const active = state.multiBooths.has(b.id) ? "active" : "";
      return `<button type="button" data-id="${esc(b.id)}" class="${active}"><strong>${esc(b.id)}</strong><small>${b.x}, ${b.y} / ${b.width}×${b.height}</small></button>`;
    }).join("") || "<div class='hint'>ブースがありません。</div>";
    els.boothList.querySelectorAll("button").forEach(btn => btn.addEventListener("click", e => {
      if (e.ctrlKey || e.metaKey) toggleMultiBooth(btn.dataset.id); else { selectSingleBooth(btn.dataset.id); renderAll(); }
    }));
  }

  function renderBoothForm() {
    const b = getBooth(), fields = [els.boothId, els.boothNewId, els.boothX, els.boothY, els.boothWidth, els.boothHeight];
    els.boothBadge.textContent = b ? b.id : "未選択";
    fields.forEach(x => x.disabled = !b);
    if (!b) { fields.forEach(x => x.value = ""); return; }
    els.boothId.value = b.id; els.boothNewId.value = b.id; els.boothX.value = b.x; els.boothY.value = b.y; els.boothWidth.value = b.width; els.boothHeight.value = b.height;
  }

  function renderExhibitorSelect() {
    const existing = state.exhibitors.map((e,i) => `<option value="e:${i}" ${state.exhibitorIndex===i?"selected":""}>${esc(e.booth_id)} - ${esc(e.shop_name || "名称未入力")} [${locationStatusLabel(e.location_status)}]</option>`);
    const used = new Set(state.exhibitors.filter(e=>e.location_status==="fixed").map(e=>e.booth_id));
    const emptyBooths = state.venue.booths.filter(b=>!used.has(b.id)).map(b=>`<option value="b:${esc(b.id)}">${esc(b.id)} - 未登録ブース</option>`);
    els.exhibitorSelect.innerHTML = '<option value="">-- 出店者を選択 --</option>' + existing.join("") + emptyBooths.join("");
    if (els.facilityAreaList) els.facilityAreaList.innerHTML = state.venue.facilities.map(f=>f.label).filter(Boolean).map(x=>`<option value="${esc(x)}"></option>`).join("");
  }

  function locationStatusLabel(status) { return ({fixed:"固定",area:"エリア",undecided:"未定"})[status] || "固定"; }

  function getInstagramUrls(e) {
    if (!e) return [];
    if (Array.isArray(e.instagram_urls)) return e.instagram_urls.map(x => String(x || "").trim()).filter(Boolean);
    return e.instagram_url ? [String(e.instagram_url).trim()].filter(Boolean) : [];
  }

  function splitLines(value) {
    return String(value || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  }

  function renderExhibitorForm() {
    const e = getExhibitor(), disabled = !e && !getBooth();
    [els.locationStatus, els.exhibitorBoothId, els.locationArea, els.shopName, els.categories, els.keywords, els.tags, els.description, els.instagramUrl, els.shopUrl, els.note].forEach(x => x.disabled = disabled);
    if (!e) {
      els.locationStatus.value = "fixed"; els.exhibitorBoothId.value = getBooth()?.id || ""; els.locationArea.value = "";
      els.shopName.value = ""; els.categories.value = ""; els.keywords.value = ""; els.tags.value = ""; els.description.value = ""; els.instagramUrl.value = ""; els.shopUrl.value = ""; els.note.value = "";
      if (els.locationAreaWrap) els.locationAreaWrap.hidden = true;
      return;
    }
    els.locationStatus.value = e.location_status || "fixed"; els.exhibitorBoothId.value = e.booth_id || ""; els.locationArea.value = e.location_area || "";
    if (els.locationAreaWrap) els.locationAreaWrap.hidden = e.location_status !== "area";
    els.shopName.value = e.shop_name || ""; els.categories.value = (e.categories || []).join(", "); els.keywords.value = (e.keywords || []).join(", "); els.tags.value = (e.tags || []).join(", ");
    els.description.value = e.description || ""; els.instagramUrl.value = getInstagramUrls(e).join("\n"); els.shopUrl.value = e.shop_url || ""; els.note.value = e.note || "";
  }

  function renderFacilityList() {
    els.facilityList.innerHTML = state.venue.facilities.map((f, i) => `<button type="button" data-index="${i}" class="${isPrimary("facility", i) ? "active" : ""}"><strong>${esc(f.label || "設備")}</strong><small>${f.x}, ${f.y}</small></button>`).join("") || "<div class='hint'>設備がありません。</div>";
    els.facilityList.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => { selectOther("facility", Number(btn.dataset.index)); renderAll(); }));
  }

  function renderFacilityForm() {
    const f = getFacility(), fields = [els.facilityType, els.facilityLabel, els.facilityX, els.facilityY, els.facilityWidth, els.facilityHeight];
    els.facilityBadge.textContent = f ? (f.label || "設備") : "未選択"; fields.forEach(x => x.disabled = !f);
    if (!f) { fields.forEach(x => x.value = ""); return; }
    els.facilityType.value = f.type || "facility"; els.facilityLabel.value = f.label || ""; els.facilityX.value = f.x; els.facilityY.value = f.y; els.facilityWidth.value = f.width; els.facilityHeight.value = f.height;
  }

  function renderAisleList() {
    els.aisleList.innerHTML = state.venue.aisles.map((a, i) => `<button type="button" data-index="${i}" class="${isPrimary("aisle", i) ? "active" : ""}"><strong>通路 ${i + 1}</strong><small>${a.x}, ${a.y} / ${a.width}×${a.height}</small></button>`).join("") || "<div class='hint'>通路がありません。</div>";
    els.aisleList.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => { selectOther("aisle", Number(btn.dataset.index)); renderAll(); }));
  }

  function renderAisleForm() {
    const a = getAisle(), fields = [els.aisleX, els.aisleY, els.aisleWidth, els.aisleHeight];
    els.aisleBadge.textContent = a ? `通路 ${state.selection.index + 1}` : "未選択"; fields.forEach(x => x.disabled = !a);
    if (!a) { fields.forEach(x => x.value = ""); return; }
    els.aisleX.value = a.x; els.aisleY.value = a.y; els.aisleWidth.value = a.width; els.aisleHeight.value = a.height;
  }

  function renderSnapButton() {
    const b = $("snapToggleBtn"); b.textContent = `10pxスナップ ${state.snap ? "ON" : "OFF"}`; b.classList.toggle("active", state.snap);
  }

  function renderSelectionInfo() {
    if (state.multiBooths.size > 1) {
      els.selectionInfo.textContent = `ブースを ${state.multiBooths.size} 件選択中。ドラッグでまとめて移動できます。`;
      return;
    }
    if (!state.selection) { els.selectionInfo.textContent = "何も選択されていません"; return; }
    const o = getSelectedObject();
    if (!o) { els.selectionInfo.textContent = "何も選択されていません"; return; }
    if (state.selection.kind === "booth") els.selectionInfo.textContent = `ブース ${o.id}：ドラッグで移動 / 右下ハンドルでリサイズ`;
    else if (state.selection.kind === "facility") els.selectionInfo.textContent = `${o.label || "設備"}：ドラッグで移動 / 右下ハンドルでリサイズ`;
    else els.selectionInfo.textContent = `通路 ${state.selection.index + 1}：ドラッグで移動 / 右下ハンドルでリサイズ`;
  }

  function renderMultiTools() {
    els.multiCountBadge.textContent = `${state.multiBooths.size}件`;
    document.querySelectorAll(".align-btn").forEach(btn => {
      const needsThree = ["distributeX", "distributeY"].includes(btn.dataset.action);
      btn.disabled = needsThree ? state.multiBooths.size < 3 : state.multiBooths.size < 2;
    });
  }

  function syncEventForm() {
    state.eventMeta = normalizeEventMeta({
      event_id: cfg.editorEventId, name: els.eventName.value.trim(), date_start: els.eventDate.value, date_end: els.eventEndDate.value || els.eventDate.value,
      time: els.eventTime.value.trim(), status: els.eventStatus.value, venue_name: els.eventVenue.value.trim(), official_url: els.eventOfficialUrl.value.trim(), description: els.eventDescription.value
    });
    // 旧venue.eventも閲覧互換用に最低限同期
    state.venue.event = { id: cfg.editorEventId, name: state.eventMeta.name, date: state.eventMeta.date_start, time: state.eventMeta.time, venue: state.eventMeta.venue_name };
    markDirty();
  }

  function syncBoothForm() {
    const b = getBooth(); if (!b) return;
    b.x = num(els.boothX.value, b.x); b.y = num(els.boothY.value, b.y);
    b.width = Math.max(30, num(els.boothWidth.value, b.width)); b.height = Math.max(30, num(els.boothHeight.value, b.height));
    markDirty(); renderMap(); renderBoothList(); renderSelectionInfo(); validateData();
  }

  function syncFacilityForm() {
    const f = getFacility(); if (!f) return;
    f.type = els.facilityType.value || "facility"; f.label = els.facilityLabel.value.trim(); f.x = num(els.facilityX.value, f.x); f.y = num(els.facilityY.value, f.y);
    f.width = Math.max(20, num(els.facilityWidth.value, f.width)); f.height = Math.max(20, num(els.facilityHeight.value, f.height));
    markDirty(); renderMap(); renderFacilityList(); renderSelectionInfo(); validateData();
  }

  function syncAisleForm() {
    const a = getAisle(); if (!a) return;
    a.x = num(els.aisleX.value, a.x); a.y = num(els.aisleY.value, a.y); a.width = Math.max(20, num(els.aisleWidth.value, a.width)); a.height = Math.max(20, num(els.aisleHeight.value, a.height));
    markDirty(); renderMap(); renderAisleList(); renderSelectionInfo(); validateData();
  }

  function syncExhibitorForm() {
    let e = getExhibitor();
    const b = getBooth();
    if (!e) {
      if (!b) return;
      e = blankExhibitor(b.id); state.exhibitors.push(e); state.exhibitorIndex = state.exhibitors.length - 1;
    }
    const newId = (els.exhibitorBoothId.value || e.booth_id || nextUnlocatedId()).trim();
    if (newId !== e.booth_id && state.exhibitors.some((x,i)=>i!==state.exhibitorIndex && x.booth_id===newId)) return toast("同じブースID / 管理IDが存在します");
    e.booth_id = newId;
    e.location_status = els.locationStatus.value || "fixed";
    e.location_area = e.location_status === "area" ? els.locationArea.value.trim() : "";
    e.shop_name = els.shopName.value.trim(); e.categories = splitCsv(els.categories.value); e.keywords = splitCsv(els.keywords.value); e.tags = splitCsv(els.tags.value); e.description = els.description.value;
    e.instagram_urls = splitLines(els.instagramUrl.value); e.instagram_url = e.instagram_urls[0] || ""; e.shop_url = els.shopUrl.value.trim(); e.note = els.note.value;
    if (e.location_status === "fixed" && state.venue.booths.some(x=>x.id===e.booth_id)) { state.selection={kind:"booth",id:e.booth_id}; state.multiBooths=new Set([e.booth_id]); }
    markDirty(); validateData(); renderExhibitorSelect(); renderExhibitorForm();
  }

  function addBooth() {
    if (state.layers.booths.locked) return toast("ブースレイヤーはロックされています");
    checkpoint();
    const id = nextUniqueId("N", 1);
    state.venue.booths.push({ id, x: 100, y: 100, width: 130, height: 95 });
    selectSingleBooth(id); markDirty(); renderAll(); toast(`${id} を追加しました`);
  }

  function addFacility(type, label) {
    const i = state.venue.facilities.push({ type, label, x: 100, y: 100, width: 130, height: 70 }) - 1;
    selectOther("facility", i); markDirty(); renderAll(); toast(`${label} を追加しました`);
  }

  function addAisle() {
    if (state.layers.aisles.locked) return toast("通路レイヤーはロックされています");
    checkpoint();
    const i = state.venue.aisles.push({ x: 200, y: 120, width: 300, height: 60 }) - 1;
    selectOther("aisle", i); markDirty(); renderAll(); toast("通路を追加しました");
  }

  function generateBoothGrid() {
    checkpoint();
    const prefix = (els.gridPrefix.value.trim() || "N").replace(/\s+/g, "_");
    const startNo = Math.max(1, int(els.gridStartNo.value, 1));
    const rows = clamp(int(els.gridRows.value, 1), 1, 30), cols = clamp(int(els.gridCols.value, 1), 1, 30);
    const width = Math.max(30, num(els.gridWidth.value, 130)), height = Math.max(30, num(els.gridHeight.value, 95));
    const gapX = Math.max(0, num(els.gridGapX.value, 20)), gapY = Math.max(0, num(els.gridGapY.value, 25));
    const startX = num(els.gridStartX.value, 100), startY = num(els.gridStartY.value, 100);
    const used = new Set(state.venue.booths.map(b => b.id));
    const created = [];
    let candidate = startNo;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let id;
        do { id = `${prefix}${String(candidate++).padStart(2, "0")}`; } while (used.has(id));
        used.add(id); created.push(id);
        state.venue.booths.push({ id, x: startX + c * (width + gapX), y: startY + r * (height + gapY), width, height });
      }
    }
    state.multiBooths = new Set(created);
    state.selection = created.length ? { kind: "booth", id: created[0] } : null;
    markDirty(); renderAll(); toast(`${created.length} ブースを生成しました`);
  }

  function duplicateBooth() {
    checkpoint();
    const b = getBooth(); if (!b) return;
    const id = nextDuplicateId(b.id); const copy = { ...deepCopy(b), id, x: b.x + 20, y: b.y + 20 };
    state.venue.booths.push(copy);
    const e = getExhibitor(); if (e) state.exhibitors.push({ ...deepCopy(e), booth_id: id, shop_name: e.shop_name ? e.shop_name + " copy" : "" });
    selectSingleBooth(id); markDirty(); renderAll();
  }

  function duplicateFacility() {
    checkpoint();
    const f = getFacility(); if (!f) return;
    const i = state.venue.facilities.push({ ...deepCopy(f), x: f.x + 20, y: f.y + 20 }) - 1;
    selectOther("facility", i); markDirty(); renderAll();
  }

  function duplicateAisle() {
    checkpoint();
    const a = getAisle(); if (!a) return;
    const i = state.venue.aisles.push({ ...deepCopy(a), x: a.x + 20, y: a.y + 20 }) - 1;
    selectOther("aisle", i); markDirty(); renderAll();
  }

  function deleteBooth() {
    const targets = state.multiBooths.size > 1 ? [...state.multiBooths] : (getBooth() ? [getBooth().id] : []);
    if (!targets.length) return;
    if (!confirm(`${targets.length}件のブースを削除しますか？\n該当する出店者情報も削除します。`)) return;
    checkpoint();
    const set = new Set(targets);
    state.venue.booths = state.venue.booths.filter(b => !set.has(b.id));
    state.exhibitors = state.exhibitors.filter(e => !set.has(e.booth_id));
    resetToFirstBooth(); markDirty(); renderAll();
  }

  function deleteFacility() {
    const f = getFacility(); if (!f || !confirm(`${f.label || "設備"} を削除しますか？`)) return;
    checkpoint();
    state.venue.facilities.splice(state.selection.index, 1); clearSelection(false); markDirty(); renderAll();
  }

  function deleteAisle() {
    const a = getAisle(); if (!a || !confirm(`通路 ${state.selection.index + 1} を削除しますか？`)) return;
    checkpoint();
    state.venue.aisles.splice(state.selection.index, 1); clearSelection(false); markDirty(); renderAll();
  }

  function renameBooth() {
    checkpoint();
    const b = getBooth(); if (!b) return;
    const newId = els.boothNewId.value.trim();
    if (!newId) return toast("新しい番号を入力してください");
    if (newId !== b.id && state.venue.booths.some(x => x.id === newId)) return toast("同じブース番号が存在します");
    const old = b.id; b.id = newId;
    state.exhibitors.forEach(e => { if (e.booth_id === old) e.booth_id = newId; });
    if (state.multiBooths.has(old)) { state.multiBooths.delete(old); state.multiBooths.add(newId); }
    state.selection = { kind: "booth", id: newId };
    markDirty(); renderAll(); toast(`${old} → ${newId}`);
  }

  function addExhibitor() {
    checkpoint();
    const b = getBooth();
    if (b && state.exhibitors.some(e=>e.location_status==="fixed" && e.booth_id===b.id)) return toast("このブースには既に出店者があります");
    const e = blankExhibitor(b ? b.id : nextUnlocatedId(), b ? "fixed" : "undecided");
    state.exhibitors.push(e); state.exhibitorIndex = state.exhibitors.length - 1;
    if (!b) { state.selection=null; state.multiBooths.clear(); }
    markDirty(); renderAll(); toast(b ? `${b.id} の出店者を追加しました` : "場所未定の出店者を追加しました");
  }

  function addUnlocatedExhibitor() {
    checkpoint();
    const e=blankExhibitor(nextUnlocatedId(), "undecided");
    state.exhibitors.push(e); state.exhibitorIndex=state.exhibitors.length-1; state.selection=null; state.multiBooths.clear();
    markDirty(); renderAll(); toast("場所未定の出店者を追加しました");
  }

  function deleteExhibitor() {
    checkpoint();
    const e = getExhibitor(); if (!e) return;
    if (!confirm(`${e.shop_name || e.booth_id} の出店者情報を削除しますか？`)) return;
    const idx=state.exhibitorIndex;
    if (idx!=null && state.exhibitors[idx]===e) state.exhibitors.splice(idx,1); else state.exhibitors=state.exhibitors.filter(x=>x!==e);
    state.exhibitorIndex = state.exhibitors.length ? Math.min(idx ?? 0, state.exhibitors.length-1) : null;
    markDirty(); renderAll();
  }

  function toggleMultiBooth(id) {
    if (state.multiBooths.has(id)) {
      state.multiBooths.delete(id);
      if (state.selection?.kind === "booth" && state.selection.id === id) {
        const next = [...state.multiBooths][0]; state.selection = next ? { kind: "booth", id: next } : null;
      }
    } else {
      state.multiBooths.add(id); state.selection = { kind: "booth", id };
    }
    renderAll();
  }

  function selectAllBooths() {
    state.multiBooths = new Set(state.venue.booths.map(b => b.id));
    if (state.venue.booths[0]) state.selection = { kind: "booth", id: state.venue.booths[0].id };
    renderAll();
  }

  function selectSingleBooth(id, syncExhibitor = true) {
    state.selection = { kind: "booth", id }; state.multiBooths = new Set([id]);
    if (syncExhibitor) { const i=state.exhibitors.findIndex(e=>e.location_status==="fixed" && e.booth_id===id); state.exhibitorIndex=i>=0?i:null; }
  }

  function selectOther(kind, index) {
    state.selection = { kind, index }; state.multiBooths.clear(); state.exhibitorIndex=null;
  }

  function clearSelection(doRender = true) {
    state.selection = null; state.multiBooths.clear(); if (doRender) renderAll();
  }

  function alignSelectedBooths(action) {
    const boxes = getMultiBooths();
    if (boxes.length < 2) return toast("ブースを2件以上選択してください");
    const minX = Math.min(...boxes.map(b => b.x));
    const maxRight = Math.max(...boxes.map(b => b.x + b.width));
    const minY = Math.min(...boxes.map(b => b.y));
    const maxBottom = Math.max(...boxes.map(b => b.y + b.height));
    const centerX = (minX + maxRight) / 2, centerY = (minY + maxBottom) / 2;
    if (action === "left") boxes.forEach(b => b.x = minX);
    if (action === "right") boxes.forEach(b => b.x = maxRight - b.width);
    if (action === "hcenter") boxes.forEach(b => b.x = Math.round(centerX - b.width / 2));
    if (action === "top") boxes.forEach(b => b.y = minY);
    if (action === "bottom") boxes.forEach(b => b.y = maxBottom - b.height);
    if (action === "vcenter") boxes.forEach(b => b.y = Math.round(centerY - b.height / 2));
    if (action === "sameSize") {
      const base = getBooth() || boxes[0]; boxes.forEach(b => { b.width = base.width; b.height = base.height; });
    }
    if (action === "distributeX") {
      if (boxes.length < 3) return toast("等間隔配置は3件以上必要です");
      const sorted = [...boxes].sort((a, b) => (a.x + a.width / 2) - (b.x + b.width / 2));
      const first = sorted[0].x + sorted[0].width / 2, last = sorted.at(-1).x + sorted.at(-1).width / 2;
      const step = (last - first) / (sorted.length - 1);
      sorted.forEach((b, i) => b.x = Math.round(first + step * i - b.width / 2));
    }
    if (action === "distributeY") {
      if (boxes.length < 3) return toast("等間隔配置は3件以上必要です");
      const sorted = [...boxes].sort((a, b) => (a.y + a.height / 2) - (b.y + b.height / 2));
      const first = sorted[0].y + sorted[0].height / 2, last = sorted.at(-1).y + sorted.at(-1).height / 2;
      const step = (last - first) / (sorted.length - 1);
      sorted.forEach((b, i) => b.y = Math.round(first + step * i - b.height / 2));
    }
    if (state.snap) boxes.forEach(b => { b.x = Math.round(b.x / 10) * 10; b.y = Math.round(b.y / 10) * 10; });
    autoExpandVenue(boxes); markDirty(); renderAll(); toast("配置を更新しました");
  }

  function startMove(e, kind, key) {
    checkpoint();
    e.preventDefault(); e.stopPropagation();
    if (kind === "booth") {
      if (!state.multiBooths.has(key)) selectSingleBooth(key);
      state.selection = { kind: "booth", id: key };
    } else selectOther(kind, key);
    const pt = clientToSvg(e.clientX, e.clientY);
    if (kind === "booth" && state.multiBooths.size > 1) {
      const origins = getMultiBooths().map(b => ({ id: b.id, x: b.x, y: b.y }));
      state.action = { mode: "move-multi", startX: pt.x, startY: pt.y, origins };
    } else {
      const o = getSelectedObject(); if (!o) return;
      state.action = { mode: "move", kind, key, startX: pt.x, startY: pt.y, origX: o.x, origY: o.y };
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    renderAll();
  }

  function startResize(e, kind, key) {
    checkpoint();
    e.preventDefault(); e.stopPropagation();
    if (kind === "booth") selectSingleBooth(key); else selectOther(kind, key);
    const o = getSelectedObject(); if (!o) return;
    const pt = clientToSvg(e.clientX, e.clientY);
    state.action = { mode: "resize", kind, key, startX: pt.x, startY: pt.y, origW: o.width, origH: o.height };
    renderAll();
  }

  function mapPointerMove(e) {
    if (!state.action) return;
    const pt = clientToSvg(e.clientX, e.clientY), dx = pt.x - state.action.startX, dy = pt.y - state.action.startY;
    if (state.action.mode === "marquee") { state.action.x = pt.x; state.action.y = pt.y; renderMarquee(); return; }
    if (state.action.mode === "move-multi") {
      state.action.origins.forEach(origin => {
        const b = state.venue.booths.find(x => x.id === origin.id); if (!b) return;
        b.x = snapValue(origin.x + dx); b.y = snapValue(origin.y + dy);
      });
    } else if (state.action.mode === "move") {
      const o = getSelectedObject(); if (!o) return;
      o.x = snapValue(state.action.origX + dx); o.y = snapValue(state.action.origY + dy);
    } else if (state.action.mode === "resize") {
      const o = getSelectedObject(); if (!o) return;
      const minSize = state.selection.kind === "booth" ? 30 : 20;
      o.width = Math.max(minSize, snapSize(state.action.origW + dx, minSize));
      o.height = Math.max(minSize, snapSize(state.action.origH + dy, minSize));
    }
    const movingObjects = state.action.mode === "move-multi" ? getMultiBooths() : [getSelectedObject()].filter(Boolean);
    autoExpandVenue(movingObjects);
    markDirty(false); renderVenueSizeForm(); renderMap(); renderCurrentFormsAndLists(); renderMultiTools();
  }

  function endPointerAction() {
    if (!state.action) return;
    if (state.action.mode === "marquee") { finishMarquee(); return; }
    state.action = null; markDirty(); validateData(); renderAll();
  }

  function moveSelectionByKey(e) {
    if (!state.selection || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    checkpoint();
    e.preventDefault(); const d = e.shiftKey ? 10 : 1; const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0; const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
    if (state.selection.kind === "booth" && state.multiBooths.size > 1) getMultiBooths().forEach(b => { b.x += dx; b.y += dy; });
    else { const o = getSelectedObject(); if (!o) return; o.x += dx; o.y += dy; }
    const movedObjects = state.selection.kind === "booth" && state.multiBooths.size > 1 ? getMultiBooths() : [getSelectedObject()].filter(Boolean);
    autoExpandVenue(movedObjects);
    markDirty(); renderAll();
  }

  function renderCurrentFormsAndLists() {
    renderBoothList(); renderBoothForm(); renderFacilityList(); renderFacilityForm(); renderAisleList(); renderAisleForm(); renderSelectionInfo();
  }

  function snapshotState() {
    return deepCopy({ eventMeta: state.eventMeta, venue: state.venue, exhibitors: state.exhibitors });
  }

  function checkpoint() {
    if (!state.venue) return;
    const snap = snapshotState();
    const last = state.history[state.history.length - 1];
    if (!last || JSON.stringify(last) !== JSON.stringify(snap)) {
      state.history.push(snap);
      if (state.history.length > 80) state.history.shift();
    }
    state.future = [];
    renderHistoryButtons();
  }

  function restoreSnapshot(snap) {
    if (!snap) return;
    state.eventMeta = normalizeEventMeta(deepCopy(snap.eventMeta || state.eventMeta || {}));
    state.venue = normalizeVenue(deepCopy(snap.venue));
    state.exhibitors = deepCopy(snap.exhibitors || []);
    clearSelection(false);
    renderAll(); markDirty();
  }

  function undo() {
    if (!state.history.length) return toast("戻せる操作がありません");
    state.future.push(snapshotState());
    restoreSnapshot(state.history.pop());
    toast("Undoしました");
  }

  function redo() {
    if (!state.future.length) return toast("やり直せる操作がありません");
    state.history.push(snapshotState());
    restoreSnapshot(state.future.pop());
    toast("Redoしました");
  }

  function renderHistoryButtons() {
    const u = $("undoBtn"), r = $("redoBtn");
    if (u) u.disabled = !state.history.length;
    if (r) r.disabled = !state.future.length;
    const c = $("copyBtn"), p = $("pasteBtn");
    if (c) c.disabled = !state.selection;
    if (p) p.disabled = !state.clipboard;
  }

  function copySelection() {
    if (!state.selection) return toast("コピーするオブジェクトを選択してください");
    if (state.selection.kind === "booth") {
      const ids = state.multiBooths.size ? [...state.multiBooths] : [state.selection.id];
      state.clipboard = { kind: "booths", items: ids.map(id => {
        const booth = state.venue.booths.find(b => b.id === id);
        const exhibitor = state.exhibitors.find(e => e.booth_id === id);
        return { booth: deepCopy(booth), exhibitor: exhibitor ? deepCopy(exhibitor) : null };
      }).filter(x => x.booth) };
    } else if (state.selection.kind === "facility") state.clipboard = { kind: "facility", item: deepCopy(getFacility()) };
    else if (state.selection.kind === "aisle") state.clipboard = { kind: "aisle", item: deepCopy(getAisle()) };
    renderHistoryButtons(); toast("コピーしました");
  }

  function pasteSelection() {
    if (!state.clipboard) return toast("クリップボードが空です");
    checkpoint();
    if (state.clipboard.kind === "booths") {
      const ids = [];
      state.clipboard.items.forEach(entry => {
        const id = nextDuplicateId(entry.booth.id);
        state.venue.booths.push({ ...deepCopy(entry.booth), id, x: entry.booth.x + 30, y: entry.booth.y + 30 });
        if (entry.exhibitor) state.exhibitors.push({ ...deepCopy(entry.exhibitor), booth_id: id });
        ids.push(id);
      });
      state.multiBooths = new Set(ids); state.selection = ids[0] ? { kind: "booth", id: ids[0] } : null;
    } else if (state.clipboard.kind === "facility" && state.clipboard.item) {
      const f = state.clipboard.item; const i = state.venue.facilities.push({ ...deepCopy(f), x: f.x + 30, y: f.y + 30 }) - 1; selectOther("facility", i);
    } else if (state.clipboard.kind === "aisle" && state.clipboard.item) {
      const a = state.clipboard.item; const i = state.venue.aisles.push({ ...deepCopy(a), x: a.x + 30, y: a.y + 30 }) - 1; selectOther("aisle", i);
    }
    markDirty(); renderAll(); toast("貼り付けました");
  }

  function handleGlobalShortcuts(e) {
    const tag = document.activeElement?.tagName?.toLowerCase();
    const editingText = ["input","textarea","select"].includes(tag);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
    if (!editingText && mod && e.key.toLowerCase() === "c") { e.preventDefault(); copySelection(); return; }
    if (!editingText && mod && e.key.toLowerCase() === "v") { e.preventDefault(); pasteSelection(); return; }
    if (!editingText && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); deleteSelectionByKey(); }
  }

  function deleteSelectionByKey() {
    if (!state.selection) return;
    const layer = selectionLayer();
    if (layer && state.layers[layer].locked) return toast("このレイヤーはロックされています");
    if (state.selection.kind === "booth") deleteBooth();
    else if (state.selection.kind === "facility") deleteFacility();
    else if (state.selection.kind === "aisle") deleteAisle();
  }

  function handleFormFocusIn(e) {
    if (!e.target.matches("input,textarea,select")) return;
    if (!state.formCheckpointActive) { checkpoint(); state.formCheckpointActive = true; }
  }

  function loadBackgroundImage(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { state.background.src = String(reader.result || ""); renderBackground(); renderLayerControls(); toast("背景画像を読み込みました"); };
    reader.readAsDataURL(file); e.target.value = "";
  }

  function renderBackground() {
    if (!els.backgroundLayer || !state.venue) return;
    els.backgroundLayer.innerHTML = "";
    els.backgroundOpacity.value = state.background.opacity;
    els.backgroundFit.value = state.background.fit;
    els.backgroundBadge.textContent = state.background.src ? "読込済" : "未読込";
    if (!state.background.src || !state.layers.background.visible) return;
    const [x,y,w,h] = state.venue.viewBox;
    const image = svg("image", { x, y, width:w, height:h, href: state.background.src, opacity: state.background.opacity, class:"background-image", preserveAspectRatio: state.background.fit === "contain" ? "xMidYMid meet" : "none" });
    els.backgroundLayer.appendChild(image);
  }

  function renderLayerControls() {
    document.querySelectorAll(".layer-visible").forEach(el => el.checked = state.layers[el.dataset.layer]?.visible !== false);
    document.querySelectorAll(".layer-lock").forEach(el => el.checked = !!state.layers[el.dataset.layer]?.locked);
  }

  function selectionLayer() {
    if (!state.selection) return null;
    return state.selection.kind === "booth" ? "booths" : state.selection.kind === "facility" ? "facilities" : "aisles";
  }

  function clearLockedSelection(layer) {
    if (selectionLayer() === layer) clearSelection(false);
    if (layer === "booths") state.multiBooths.clear();
  }

  function startMarqueeSelection(e) {
    if (e.button !== 0 || state.layers.booths.locked || !state.layers.booths.visible) return;
    if (e.target.closest(".edit-booth,.edit-facility,.edit-aisle,.resize-handle")) return;
    const pt = clientToSvg(e.clientX,e.clientY);
    state.action = { mode:"marquee", startX:pt.x, startY:pt.y, x:pt.x, y:pt.y, additive:e.ctrlKey||e.metaKey };
    els.viewport.classList.add("selecting");
    e.preventDefault();
  }

  function renderMarquee() {
    if (!els.overlayLayer) return;
    els.overlayLayer.innerHTML = "";
    if (!state.action || state.action.mode !== "marquee") return;
    const a=state.action, x=Math.min(a.startX,a.x), y=Math.min(a.startY,a.y), w=Math.abs(a.x-a.startX), h=Math.abs(a.y-a.startY);
    els.overlayLayer.appendChild(svg("rect",{x,y,width:w,height:h,class:"selection-marquee"}));
  }

  function finishMarquee() {
    const a=state.action; if (!a || a.mode!=="marquee") return;
    const x1=Math.min(a.startX,a.x), y1=Math.min(a.startY,a.y), x2=Math.max(a.startX,a.x), y2=Math.max(a.startY,a.y);
    const ids=state.venue.booths.filter(b => b.x >= x1 && b.y >= y1 && b.x+b.width <= x2 && b.y+b.height <= y2).map(b=>b.id);
    if (!a.additive) state.multiBooths.clear(); ids.forEach(id=>state.multiBooths.add(id));
    const first=ids[0] || [...state.multiBooths][0]; state.selection=first?{kind:"booth",id:first}:null;
    state.action=null; els.viewport.classList.remove("selecting"); renderAll();
  }

  function validateData() {
    if (!state.venue) return false;
    const messages = [], booths = state.venue.booths, ids = booths.map(b => b.id), dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    if (dup.length) messages.push(["error", `重複ブース番号: ${dup.join(", ")}`]);
    const unknown = state.exhibitors.filter(e => (e.location_status || "fixed") === "fixed" && !ids.includes(e.booth_id)); if (unknown.length) messages.push(["error", `固定ブースなのに存在しないブースを参照: ${unknown.map(e => e.booth_id).join(", ")}`]);
    const duplicateExIds=[...new Set(state.exhibitors.map(e=>e.booth_id).filter((id,i,a)=>id && a.indexOf(id)!==i))]; if(duplicateExIds.length) messages.push(["error", `出店者のブースID / 管理ID重複: ${duplicateExIds.join(", ")}`]);
    const emptyShop = state.exhibitors.filter(e => !e.shop_name?.trim()); if (emptyShop.length) messages.push(["warn", `ショップ名未入力: ${emptyShop.map(e => e.booth_id).join(", ")}`]);
    const noEx = booths.filter(b => !state.exhibitors.some(e => (e.location_status || "fixed") === "fixed" && e.booth_id === b.id)); if (noEx.length) messages.push(["warn", `出店者未登録ブース: ${noEx.map(b => b.id).join(", ")}`]);
    const areaNames=new Set(state.venue.facilities.map(f=>String(f.label||"").trim()).filter(Boolean));
    const unknownAreas=state.exhibitors.filter(e=>e.location_status==="area" && e.location_area && !areaNames.has(e.location_area)); if(unknownAreas.length) messages.push(["warn", `マップ上に同名設備がないエリア: ${unknownAreas.map(e=>`${e.booth_id}:${e.location_area}`).join(", ")}`]);
    const badBooths = booths.filter(b => !b.id?.trim() || b.width < 30 || b.height < 30); if (badBooths.length) messages.push(["error", `ブース番号またはサイズを確認してください: ${badBooths.length}件`]);
    const badFacilities = state.venue.facilities.filter(f => !f.label?.trim() || f.width <= 0 || f.height <= 0); if (badFacilities.length) messages.push(["warn", `設備の表示名またはサイズを確認してください: ${badFacilities.length}件`]);
    const badAisles = state.venue.aisles.filter(a => a.width <= 0 || a.height <= 0); if (badAisles.length) messages.push(["error", `通路サイズが不正です: ${badAisles.length}件`]);
    if (!messages.length) messages.push(["ok", "データに大きな問題は見つかりませんでした。"]) ;
    els.validation.innerHTML = messages.map(([c, m]) => `<div class="${c}">● ${esc(m)}</div>`).join("");
    return !messages.some(x => x[0] === "error");
  }

  function markDirty(save = true) {
    state.dirty = true; setSaveState("編集中・自動保存済み"); if (save) saveDraft(); else debounceSave();
  }
  function debounceSave() { clearTimeout(debounceSave.t); debounceSave.t = setTimeout(saveDraft, 350); }
  function saveDraft() {
    if (!state.venue) return;
    localStorage.setItem(cfg.editorDraftKey, JSON.stringify({ eventMeta: state.eventMeta, venue: state.venue, exhibitors: state.exhibitors, savedAt: new Date().toISOString() }));
    setSaveState("編集中・自動保存済み");
  }
  function restoreDraft() {
    try {
      const raw = localStorage.getItem(cfg.editorDraftKey); if (!raw) return toast("自動保存データはありません");
      const d = JSON.parse(raw); state.eventMeta = normalizeEventMeta(d.eventMeta || {}); state.venue = normalizeVenue(d.venue); state.exhibitors = normalizeExhibitors(d.exhibitors || []); resetToFirstBooth(); state.dirty = true; renderAll(); toast("自動保存を復元しました");
    } catch { toast("自動保存の復元に失敗しました"); }
  }
  function downloadJson(name, data) {
    if (!validateData() && name === "venue.json") toast("エラーがあります。データ確認を見てください");
    const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); state.dirty = false; setSaveState(`${name} を保存しました`);
  }
  function readJsonFile(file, onLoad, label) {
    if (!file) return; const r = new FileReader();
    r.onload = () => { try { const data = JSON.parse(r.result); onLoad(data); toast(`${label} を読み込みました`); } catch (err) { toast(`${label} の読込に失敗: ${err.message}`); } };
    r.readAsText(file, "utf-8");
  }

  function getSelectedObject() {
    if (!state.selection) return null;
    if (state.selection.kind === "booth") return getBooth(); if (state.selection.kind === "facility") return getFacility(); if (state.selection.kind === "aisle") return getAisle(); return null;
  }
  function getBooth() { return state.selection?.kind === "booth" ? state.venue.booths.find(b => b.id === state.selection.id) || null : null; }
  function getFacility() { return state.selection?.kind === "facility" ? state.venue.facilities[state.selection.index] || null : null; }
  function getAisle() { return state.selection?.kind === "aisle" ? state.venue.aisles[state.selection.index] || null : null; }
  function getMultiBooths() { return state.venue.booths.filter(b => state.multiBooths.has(b.id)); }
  function getExhibitor() {
    if (state.exhibitorIndex != null && state.exhibitors[state.exhibitorIndex]) return state.exhibitors[state.exhibitorIndex];
    const b = getBooth(); return b ? state.exhibitors.find(e => (e.location_status || "fixed") === "fixed" && e.booth_id === b.id) || null : null;
  }
  function isPrimary(kind, key) { if (!state.selection || state.selection.kind !== kind) return false; return kind === "booth" ? state.selection.id === key : state.selection.index === key; }
  function pruneMultiSelection() { const ids = new Set(state.venue.booths.map(b => b.id)); state.multiBooths = new Set([...state.multiBooths].filter(id => ids.has(id))); }
  function blankExhibitor(id, status="fixed") { return { booth_id: id, location_status: status, location_area: "", shop_name: "", categories: [], description: "", keywords: [], tags: [], instagram_urls: [], instagram_url: "", shop_url: "", note: "" }; }
  function nextUnlocatedId() { const used=new Set(state.exhibitors.map(e=>e.booth_id)); let n=1,id; do{id=`U${String(n++).padStart(2,"0")}`;}while(used.has(id)); return id; }

  function nextUniqueId(prefix, start) {
    const used = new Set(state.venue.booths.map(b => b.id)); let n = start, id;
    do { id = `${prefix}${String(n++).padStart(2, "0")}`; } while (used.has(id)); return id;
  }
  function nextDuplicateId(base) { const used = new Set(state.venue.booths.map(b => b.id)); let n = 1, id; do { id = `${base}_${n++}`; } while (used.has(id)); return id; }
  function snapValue(v) { return Math.round(state.snap ? Math.round(v / 10) * 10 : v); }
  function snapSize(v, min) { return Math.max(min, Math.round(state.snap ? Math.round(v / 10) * 10 : v)); }
  function clientToSvg(cx, cy) { const pt = els.map.createSVGPoint(); pt.x = cx; pt.y = cy; const m = els.map.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 }; }
  function splitCsv(v) { return v.split(/[,、]/).map(x => x.trim()).filter(Boolean); }
  function num(v, fallback) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
  function int(v, fallback) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback; }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function svg(name, attrs = {}) { const el = document.createElementNS("http://www.w3.org/2000/svg", name); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); return el; }
  function esc(v = "") { return String(v).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])); }
  function setSaveState(text, error = false) { els.saveState.textContent = text; els.saveState.style.color = error ? "#a8444e" : ""; }
  function toast(msg) { els.toast.textContent = msg; els.toast.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => els.toast.classList.remove("show"), 1800); }
})();

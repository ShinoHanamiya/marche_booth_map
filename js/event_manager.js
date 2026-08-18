(() => {
  "use strict";

  const cfg = window.APP_CONFIG;
  const $ = id => document.getElementById(id);
  const deepCopy = obj => JSON.parse(JSON.stringify(obj));
  const state = {
    events: [],
    bundles: new Map(),
    selectedId: "",
    rootHandle: null,
    directMode: false
  };
  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    Object.assign(els, {
      modeDescription: $("modeDescription"), folderStatus: $("folderStatus"), eventList: $("eventList"), eventCount: $("eventCount"), eventSearch: $("eventSearch"), statusFilter: $("statusFilter"),
      selectedEventLabel: $("selectedEventLabel"), emptyState: $("emptyState"), eventForm: $("eventForm"), eventId: $("eventId"), eventName: $("eventName"), dateStart: $("dateStart"), dateEnd: $("dateEnd"), eventTime: $("eventTime"), eventStatus: $("eventStatus"), venueName: $("venueName"), officialUrl: $("officialUrl"), eventDescription: $("eventDescription"), eventPathPreview: $("eventPathPreview"),
      openLayoutBtn: $("openLayoutBtn"), openViewBtn: $("openViewBtn"), validationResult: $("validationResult"), newEventDialog: $("newEventDialog"), newEventId: $("newEventId"), newEventName: $("newEventName"), newEventMode: $("newEventMode"), toast: $("toast")
    });
    bindEvents();
    await loadPublished();
  }

  function bindEvents() {
    $("connectFolderBtn").addEventListener("click", connectProjectFolder);
    $("reloadBtn").addEventListener("click", () => state.directMode ? loadFromFolder() : loadPublished());
    $("newEventBtn").addEventListener("click", openNewDialog);
    els.eventSearch.addEventListener("input", renderEventList);
    els.statusFilter.addEventListener("change", renderEventList);
    $("saveEventBtn").addEventListener("click", saveSelectedMetadata);
    $("duplicateEventBtn").addEventListener("click", () => openNewDialog("duplicate"));
    $("deleteEventBtn").addEventListener("click", deleteSelectedEvent);
    $("downloadEventBtn").addEventListener("click", () => downloadSelectedFiles(false));
    $("downloadAllEventFilesBtn").addEventListener("click", () => downloadSelectedFiles(true));
    $("downloadEventsBtn").addEventListener("click", () => downloadJson("events.json", state.events));
    $("validateAllBtn").addEventListener("click", validateAllEvents);
    els.openLayoutBtn.addEventListener("click", () => open(`editor.html?event=${encodeURIComponent(state.selectedId)}`, "_blank"));
    els.openViewBtn.addEventListener("click", () => open(`index.html?event=${encodeURIComponent(state.selectedId)}`, "_blank"));
    els.eventId.addEventListener("input", updatePathPreview);
    $("confirmNewEventBtn").addEventListener("click", e => {
      e.preventDefault();
      createEventFromDialog();
    });
  }

  async function loadPublished() {
    try {
      const r = await fetch(cfg.eventsFile, { cache: "no-store" });
      if (!r.ok) throw new Error(`events.json (${r.status})`);
      const data = await r.json();
      if (!Array.isArray(data)) throw new Error("events.json は配列である必要があります");
      state.events = data.map(normalizeSummary);
      state.bundles.clear();
      state.directMode = false;
      state.rootHandle = null;
      setFolderStatus(false);
      renderEventList();
      if (state.events.length) await selectEvent(state.events[0].event_id);
      else clearSelection();
      toast("公開データを読み込みました");
    } catch (err) {
      els.validationResult.innerHTML = `<div class="error">読込失敗: ${esc(err.message)}</div>`;
      clearSelection();
    }
  }

  async function connectProjectFolder() {
    if (!("showDirectoryPicker" in window)) {
      alert("このブラウザはフォルダ直接編集に対応していません。Chrome / Edge の新しいバージョンを使用するか、JSONダウンロード方式を利用してください。");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      const perm = await verifyPermission(handle, true);
      if (!perm) throw new Error("フォルダへの書き込み許可がありません");
      // プロジェクトルート確認
      await readJsonFile(handle, ["data", "events.json"]);
      state.rootHandle = handle;
      state.directMode = true;
      setFolderStatus(true, handle.name);
      await loadFromFolder();
      toast("プロジェクトフォルダを接続しました");
    } catch (err) {
      if (err?.name === "AbortError") return;
      alert("フォルダを接続できませんでした。\n\n" + err.message + "\n\nmarche_booth_map_v1_9 フォルダそのものを選択してください。");
    }
  }

  async function verifyPermission(handle, readWrite) {
    const options = readWrite ? { mode: "readwrite" } : {};
    if ((await handle.queryPermission(options)) === "granted") return true;
    return (await handle.requestPermission(options)) === "granted";
  }

  function setFolderStatus(connected, name = "") {
    els.folderStatus.textContent = connected ? `接続中: ${name}` : "未接続";
    els.folderStatus.classList.toggle("connected", connected);
    els.modeDescription.textContent = connected
      ? "ローカルのプロジェクトフォルダへ直接保存します。イベント作成・複製・削除も実ファイルへ反映されます。"
      : "公開中のJSONを読み込んでいます。変更はダウンロードしてプロジェクトへ配置してください。";
  }

  async function loadFromFolder() {
    try {
      const data = await readJsonFile(state.rootHandle, ["data", "events.json"]);
      if (!Array.isArray(data)) throw new Error("data/events.json は配列である必要があります");
      state.events = data.map(normalizeSummary);
      state.bundles.clear();
      renderEventList();
      if (state.events.length) await selectEvent(state.events.some(x => x.event_id === state.selectedId) ? state.selectedId : state.events[0].event_id);
      else clearSelection();
    } catch (err) {
      alert("プロジェクトフォルダから読み込めませんでした。\n" + err.message);
    }
  }

  function normalizeSummary(e) {
    return {
      event_id: String(e.event_id || "").trim(),
      name: String(e.name || e.event_id || "名称未設定"),
      date_start: e.date_start || "",
      date_end: e.date_end || e.date_start || "",
      venue_name: e.venue_name || "",
      status: ["upcoming", "ongoing", "past"].includes(e.status) ? e.status : "upcoming",
      description: e.description || ""
    };
  }

  function normalizeMeta(m, id) {
    return {
      event_id: id || m.event_id || "",
      name: m.name || id || "",
      date_start: m.date_start || "",
      date_end: m.date_end || m.date_start || "",
      time: m.time || "",
      venue_name: m.venue_name || "",
      status: ["upcoming", "ongoing", "past"].includes(m.status) ? m.status : "upcoming",
      official_url: m.official_url || "",
      description: m.description || ""
    };
  }

  function blankVenue() {
    return { viewBox: [0, 0, 1000, 700], facilities: [{ type: "entrance", label: "入口", x: 430, y: 22, width: 140, height: 55 }], aisles: [], booths: [] };
  }

  async function loadBundle(id) {
    if (state.bundles.has(id)) return state.bundles.get(id);
    let event, venue, exhibitors;
    if (state.directMode) {
      [event, venue, exhibitors] = await Promise.all([
        readJsonFile(state.rootHandle, ["data", "events", id, "event.json"]),
        readJsonFile(state.rootHandle, ["data", "events", id, "venue.json"]),
        readJsonFile(state.rootHandle, ["data", "events", id, "exhibitors.json"])
      ]);
    } else {
      const base = `${cfg.eventsBasePath}/${encodeURIComponent(id)}`;
      const rs = await Promise.all(["event.json", "venue.json", "exhibitors.json"].map(n => fetch(`${base}/${n}`, { cache: "no-store" })));
      if (rs.some(r => !r.ok)) throw new Error(`${id} のイベントファイルを読み込めません`);
      [event, venue, exhibitors] = await Promise.all(rs.map(r => r.json()));
    }
    const bundle = { event: normalizeMeta(event, id), venue, exhibitors: Array.isArray(exhibitors) ? exhibitors : [] };
    state.bundles.set(id, bundle);
    return bundle;
  }

  async function selectEvent(id) {
    try {
      const bundle = await loadBundle(id);
      state.selectedId = id;
      renderEventList();
      fillForm(bundle.event);
      els.emptyState.hidden = true;
      els.eventForm.hidden = false;
      els.openLayoutBtn.disabled = false;
      els.openViewBtn.disabled = false;
      els.selectedEventLabel.textContent = `${bundle.event.name} / ${id}`;
    } catch (err) {
      alert("イベントを読み込めませんでした。\n" + err.message);
    }
  }

  function clearSelection() {
    state.selectedId = "";
    els.eventForm.hidden = true;
    els.emptyState.hidden = false;
    els.openLayoutBtn.disabled = true;
    els.openViewBtn.disabled = true;
    els.selectedEventLabel.textContent = "イベントを選択してください";
    renderEventList();
  }

  function fillForm(meta) {
    els.eventId.value = meta.event_id;
    els.eventId.readOnly = true;
    els.eventName.value = meta.name;
    els.dateStart.value = meta.date_start;
    els.dateEnd.value = meta.date_end;
    els.eventTime.value = meta.time;
    els.eventStatus.value = meta.status;
    els.venueName.value = meta.venue_name;
    els.officialUrl.value = meta.official_url || "";
    els.eventDescription.value = meta.description;
    updatePathPreview();
  }

  function readFormMeta() {
    return normalizeMeta({
      event_id: els.eventId.value.trim(), name: els.eventName.value.trim(), date_start: els.dateStart.value, date_end: els.dateEnd.value,
      time: els.eventTime.value.trim(), status: els.eventStatus.value, venue_name: els.venueName.value.trim(), official_url: els.officialUrl.value.trim(), description: els.eventDescription.value.trim()
    }, els.eventId.value.trim());
  }

  function updatePathPreview() {
    els.eventPathPreview.textContent = `data/events/${els.eventId.value.trim() || "<event_id>"}/`;
  }

  function renderEventList() {
    const q = els.eventSearch.value.trim().toLowerCase();
    const status = els.statusFilter.value;
    const list = state.events.filter(e => {
      if (status !== "all" && e.status !== status) return false;
      if (!q) return true;
      return [e.event_id, e.name, e.venue_name, e.description].join(" ").toLowerCase().includes(q);
    });
    els.eventCount.textContent = `${state.events.length}件`;
    els.eventList.innerHTML = "";
    if (!list.length) {
      els.eventList.innerHTML = '<div class="empty-state" style="min-height:180px">該当するイベントがありません。</div>';
      return;
    }
    list.forEach(e => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "event-card" + (e.event_id === state.selectedId ? " active" : "");
      btn.innerHTML = `<strong>${esc(e.name)}</strong><small>${esc(dateLabel(e))}${e.venue_name ? ` / ${esc(e.venue_name)}` : ""}</small><small>${esc(e.event_id)}</small><div class="meta-row"><span class="chip">${esc(statusLabel(e.status))}</span></div>`;
      btn.addEventListener("click", () => selectEvent(e.event_id));
      els.eventList.appendChild(btn);
    });
  }

  function openNewDialog(mode = "blank") {
    els.newEventId.value = "";
    els.newEventName.value = "";
    els.newEventMode.value = mode === "duplicate" ? "duplicate" : "blank";
    if (!state.selectedId) els.newEventMode.value = "blank";
    els.newEventMode.querySelector('option[value="duplicate"]').disabled = !state.selectedId;
    els.newEventDialog.showModal();
    setTimeout(() => els.newEventId.focus(), 30);
  }

  async function createEventFromDialog() {
    const id = els.newEventId.value.trim();
    const name = els.newEventName.value.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return alert("イベントIDは英数字・_・- で入力してください。");
    if (!name) return alert("イベント名を入力してください。");
    if (state.events.some(e => e.event_id === id)) return alert("同じイベントIDが既に存在します。");

    let bundle;
    if (els.newEventMode.value === "duplicate" && state.selectedId) {
      const source = await loadBundle(state.selectedId);
      bundle = deepCopy(source);
      bundle.event = { ...bundle.event, event_id: id, name };
    } else {
      bundle = { event: normalizeMeta({ event_id: id, name, status: "upcoming" }, id), venue: blankVenue(), exhibitors: [] };
    }
    state.bundles.set(id, bundle);
    upsertSummary(bundle.event);
    if (state.directMode) await persistBundle(id, bundle, true);
    renderEventList();
    els.newEventDialog.close();
    await selectEvent(id);
    toast(state.directMode ? "新しいイベントを作成して保存しました" : "新しいイベントを作成しました。JSONを保存して配置してください");
  }

  async function saveSelectedMetadata() {
    if (!state.selectedId) return;
    const meta = readFormMeta();
    if (!meta.name) return alert("イベント名を入力してください。");
    const bundle = await loadBundle(state.selectedId);
    bundle.event = meta;
    state.bundles.set(state.selectedId, bundle);
    upsertSummary(meta);
    if (state.directMode) {
      await writeJsonFile(state.rootHandle, ["data", "events", state.selectedId, "event.json"], meta, true);
      await writeJsonFile(state.rootHandle, ["data", "events.json"], state.events, true);
      toast("event.json と events.json を保存しました");
    } else {
      toast("編集内容を反映しました。event.json / events.json をダウンロードして更新してください");
    }
    els.selectedEventLabel.textContent = `${meta.name} / ${state.selectedId}`;
    renderEventList();
  }

  async function deleteSelectedEvent() {
    if (!state.selectedId) return;
    const id = state.selectedId;
    const meta = (await loadBundle(id)).event;
    const message = state.directMode
      ? `「${meta.name}」を削除します。\nイベントフォルダ内の event.json / venue.json / exhibitors.json も削除されます。\n\n元に戻せません。よろしいですか？`
      : `「${meta.name}」を一覧から削除します。\n\n公開ファイルは自動削除できないため、events.json更新後に data/events/${id}/ フォルダを手動で削除してください。`;
    if (!confirm(message)) return;
    if (state.directMode) {
      const eventsDir = await getDirHandle(state.rootHandle, ["data", "events"], false);
      await eventsDir.removeEntry(id, { recursive: true });
    }
    state.events = state.events.filter(e => e.event_id !== id);
    state.bundles.delete(id);
    if (state.directMode) await writeJsonFile(state.rootHandle, ["data", "events.json"], state.events, true);
    clearSelection();
    if (state.events.length) await selectEvent(state.events[0].event_id);
    toast(state.directMode ? "イベントを削除しました" : "events.jsonから削除しました。イベントフォルダは手動で削除してください");
  }

  async function downloadSelectedFiles(all) {
    if (!state.selectedId) return;
    const b = await loadBundle(state.selectedId);
    downloadJson("event.json", b.event);
    if (all) {
      setTimeout(() => downloadJson("venue.json", b.venue), 180);
      setTimeout(() => downloadJson("exhibitors.json", b.exhibitors), 360);
    }
  }

  function upsertSummary(meta) {
    const summary = normalizeSummary(meta);
    const i = state.events.findIndex(e => e.event_id === meta.event_id);
    if (i >= 0) state.events[i] = summary;
    else state.events.push(summary);
    state.events.sort((a,b) => (a.date_start || "9999").localeCompare(b.date_start || "9999") || a.name.localeCompare(b.name, "ja"));
  }

  async function persistBundle(id, bundle, includeIndex) {
    await Promise.all([
      writeJsonFile(state.rootHandle, ["data", "events", id, "event.json"], bundle.event, true),
      writeJsonFile(state.rootHandle, ["data", "events", id, "venue.json"], bundle.venue, true),
      writeJsonFile(state.rootHandle, ["data", "events", id, "exhibitors.json"], bundle.exhibitors, true)
    ]);
    if (includeIndex) await writeJsonFile(state.rootHandle, ["data", "events.json"], state.events, true);
  }

  async function validateAllEvents() {
    const rows = [];
    const seen = new Set();
    for (const e of state.events) {
      if (!e.event_id) rows.push(["error", "event_id が空のイベントがあります"]);
      if (seen.has(e.event_id)) rows.push(["error", `イベントID重複: ${e.event_id}`]);
      seen.add(e.event_id);
      try {
        const b = await loadBundle(e.event_id);
        if (!Array.isArray(b.venue?.booths)) rows.push(["error", `${e.event_id}: venue.json の booths が不正です`]);
        if (!Array.isArray(b.exhibitors)) rows.push(["error", `${e.event_id}: exhibitors.json が配列ではありません`]);
        const boothIds = new Set((b.venue.booths || []).map(x => x.id));
        const unknown = b.exhibitors.filter(x => !boothIds.has(x.booth_id));
        if (unknown.length) rows.push(["warn", `${e.event_id}: 存在しないブース参照 ${unknown.map(x => x.booth_id).join(", ")}`]);
      } catch (err) {
        rows.push(["error", `${e.event_id}: ${err.message}`]);
      }
    }
    if (!rows.length) rows.push(["ok", `全${state.events.length}イベントの基本構造に問題は見つかりませんでした`]);
    els.validationResult.innerHTML = rows.map(([kind,msg]) => `<div class="${kind}">${esc(msg)}</div>`).join("");
  }

  async function readJsonFile(root, parts) {
    let dir = root;
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
    const fileHandle = await dir.getFileHandle(parts.at(-1));
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text());
  }

  async function getDirHandle(root, parts, create) {
    let dir = root;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
    return dir;
  }

  async function writeJsonFile(root, parts, data, create) {
    const dir = await getDirHandle(root, parts.slice(0, -1), create);
    const fh = await dir.getFileHandle(parts.at(-1), { create });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(data, null, 2) + "\n");
    await w.close();
  }

  function downloadJson(name, data) {
    const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function statusLabel(s) { return s === "ongoing" ? "開催中" : s === "past" ? "過去" : "開催予定"; }
  function dateLabel(e) { return !e.date_start ? "日付未設定" : e.date_end && e.date_end !== e.date_start ? `${e.date_start} ～ ${e.date_end}` : e.date_start; }
  function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  let toastTimer;
  function toast(msg) { clearTimeout(toastTimer); els.toast.textContent = msg; els.toast.classList.add("show"); toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600); }
})();

(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const requestedEventId = (params.get("event") || "").trim();
  const defaultEditorEventId = "sample_flower_marche_2026";
  const editorEventId = requestedEventId || defaultEditorEventId;
  const eventsBasePath = "data/events";
  const eventBasePath = `${eventsBasePath}/${encodeURIComponent(editorEventId)}`;

  window.APP_CONFIG = {
    name: "Marche Booth Map",
    version: "v1.11",
    eventsFile: "data/events.json",
    venueTemplatesFile: "data/venue_templates.json",
    venueTemplatesBasePath: "data/venue_templates",
    eventsBasePath,
    defaultEditorEventId,
    editorEventId,
    eventFile: `${eventBasePath}/event.json`,
    venueFile: `${eventBasePath}/venue.json`,
    dataFile: `${eventBasePath}/exhibitors.json`,
    favoriteStoragePrefix: "marche_booth_map_v1_11_favorites_",
    visitedStoragePrefix: "marche_booth_map_v1_11_visited_",
    legacyFavoriteStoragePrefixes: ["marche_booth_map_v1_10_favorites_", "marche_booth_map_v1_9_favorites_", "marche_booth_map_v1_8_favorites_"],
    legacyVisitedStoragePrefixes: ["marche_booth_map_v1_10_visited_", "marche_booth_map_v1_9_visited_", "marche_booth_map_v1_8_visited_"],
    legacyFavoriteStorageKeys: [
      "marche_booth_map_favorites",
      "marche_booth_map_v1_4_favorites",
      "marche_booth_map_v1_3_favorites",
      "marche_booth_map_v1_2_favorites"
    ],
    legacyVisitedStorageKeys: ["marche_booth_map_visited"],
    editorDraftKey: `marche_booth_map_v1_11_editor_draft_${editorEventId}`
  };
})();

window.APP_CONFIG = {
  name: "Marche Booth Map",
  version: "v1.8",
  eventsFile: "data/events.json",
  eventsBasePath: "data/events",
  defaultEditorEventId: "sample_flower_marche_2026",
  // Editor v1.8 は1イベントずつ編集。v1.9でイベント管理GUIを予定。
  venueFile: "data/events/sample_flower_marche_2026/venue.json",
  dataFile: "data/events/sample_flower_marche_2026/exhibitors.json",
  favoriteStoragePrefix: "marche_booth_map_v1_8_favorites_",
  visitedStoragePrefix: "marche_booth_map_v1_8_visited_",
  legacyFavoriteStorageKeys: [
    "marche_booth_map_favorites",
    "marche_booth_map_v1_4_favorites",
    "marche_booth_map_v1_3_favorites",
    "marche_booth_map_v1_2_favorites"
  ],
  legacyVisitedStorageKeys: ["marche_booth_map_visited"],
  editorDraftKey: "marche_booth_map_v1_8_editor_draft_sample_flower_marche_2026"
};

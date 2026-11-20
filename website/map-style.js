/*
 * Shared map look for centrix: white land, lavender water, purple roads.
 * Uses the free OpenFreeMap "positron" vector style (no API key) and recolours it.
 * Used by partner.js and tenant.js.
 */
window.CentrixMap = {
  styleUrl: "https://tiles.openfreemap.org/styles/positron",

  restyle(map) {
    const set = (layer, prop, value) => {
      if (!map.getLayer(layer)) return;
      try { map.setPaintProperty(layer, prop, value); } catch (e) { /* layer type has no such property */ }
    };
    const width = (stops) => ["interpolate", ["exponential", 1.5], ["zoom"], ...stops.flat()];

    set("background", "background-color", "#ffffff");
    set("landuse_residential", "fill-color", "#fbf9fd");
    set("park", "fill-color", "#eef4ec");
    set("landcover_wood", "fill-color", "#e9f1e6");
    set("water", "fill-color", "#d9d2f0");
    set("waterway", "line-color", "#d9d2f0");
    set("building", "fill-color", "#f2eef6");
    set("building", "fill-outline-color", "#e4dcec");

    ["highway_path", "road_pier"].forEach((id) => set(id, "line-color", "#ddd0ee"));
    set("highway_minor", "line-color", "#e4d8f4");
    set("highway_minor", "line-width", width([[12, 0.6], [14, 2.4], [16, 7], [18, 18]]));

    set("highway_major_casing", "line-color", "#b897e2");
    set("highway_major_casing", "line-width", width([[10, 1.2], [14, 5.5], [16, 12], [18, 24]]));
    ["highway_major_inner", "highway_major_subtle"].forEach((id) => {
      set(id, "line-color", "#d3bdf1");
      set(id, "line-width", width([[10, 0.8], [14, 3.8], [16, 9.5], [18, 20]]));
    });

    ["highway_motorway_casing", "tunnel_motorway_casing", "highway_motorway_bridge_casing"].forEach((id) => {
      set(id, "line-color", "#7a3fbf");
      set(id, "line-width", width([[6, 1], [12, 4], [16, 14], [18, 28]]));
    });
    ["highway_motorway_inner", "highway_motorway_subtle", "tunnel_motorway_inner", "highway_motorway_bridge_inner"].forEach((id) => {
      set(id, "line-color", "#9d6ad8");
      set(id, "line-width", width([[6, 0.6], [12, 2.6], [16, 11], [18, 24]]));
    });

    ["railway", "railway_transit", "railway_service"].forEach((id) => set(id, "line-color", "#cfc4dc"));

    map.getStyle().layers.forEach((layer) => {
      if (layer.type !== "symbol") return;
      set(layer.id, "text-color", layer.id.startsWith("label_") ? "#3b1a40" : "#6b4a7a");
      set(layer.id, "text-halo-color", "#ffffff");
      set(layer.id, "text-halo-width", 1.4);
    });
  }
};

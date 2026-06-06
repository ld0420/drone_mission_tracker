/* ===================================================================
   MapView — Leaflet over Esri World Imagery.
   (Prototype renderer: the preview sandbox blocks MapLibre's worker;
    Leaflet renders raster tiles + SVG overlays reliably. Production
    target is MapLibre GL — this wrapper exposes the same API.)
   Detail: planned path + dock + directional capture cones + selection.
   Live (imperative ref): moving drone + actual trail breadcrumb.
   =================================================================== */
(function () {
  const { useRef, useEffect, forwardRef, useImperativeHandle } = React;
  const SITE = [33.252968, -91.664321];

  function coneHTML({ heading, sel, seq, aborted }) {
    const col = aborted ? "#ff6b5e" : "#4fe3a1";
    const S = sel ? 54 : 36, c = S / 2;
    const apex = c, top = 5;
    const spread = sel ? 12 : 8;
    const wedge = `M${apex} ${apex} L${apex - spread} ${top} L${apex + spread} ${top} Z`;
    const dot = sel
      ? `<circle cx="${apex}" cy="${apex}" r="6.5" fill="${col}" fill-opacity="0.25"/><circle cx="${apex}" cy="${apex}" r="4" fill="#fff"/><circle cx="${apex}" cy="${apex}" r="4" fill="none" stroke="${col}" stroke-width="2"/>`
      : `<circle cx="${apex}" cy="${apex}" r="3.2" fill="${col}"/>`;
    const halo = sel ? `<circle cx="${apex}" cy="${apex}" r="${c - 2}" fill="${col}" fill-opacity="0.08" stroke="${col}" stroke-opacity="0.4" stroke-width="1"/>` : "";
    const label = sel ? `<div class="cone-seq" style="--cc:${col}">#${seq}</div>` : "";
    return `<div class="cone-wrap" style="transform:rotate(${heading}deg)">
      <svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
        ${halo}
        <path d="${wedge}" fill="${col}" fill-opacity="${sel ? 0.5 : 0.3}" stroke="${col}" stroke-opacity="${sel ? 1 : 0.85}" stroke-width="${sel ? 2 : 1.4}" stroke-linejoin="round"/>
        <circle cx="${apex}" cy="${apex}" r="13" fill="#000" fill-opacity="0.001"/>
        ${dot}
      </svg>${label}</div>`;
  }

  function makeConeIcon(opts) {
    const S = opts.sel ? 54 : 36;
    return L.divIcon({ html: coneHTML(opts), className: "cone-icon" + (opts.sel ? " sel" : ""), iconSize: [S, S], iconAnchor: [S / 2, S / 2] });
  }
  function droneIcon(heading) {
    return L.divIcon({
      className: "drone-icon", iconSize: [34, 34], iconAnchor: [17, 17],
      html: `<div class="drone-wrap" style="transform:rotate(${heading}deg)">
        <svg width="34" height="34" viewBox="0 0 34 34"><path d="M17 4 L26 28 L17 22 L8 28 Z" fill="#f5b13b"/><circle cx="17" cy="18" r="2.4" fill="#1a1205"/></svg>
      </div>`,
    });
  }
  function dockIcon() {
    return L.divIcon({
      className: "dock-icon", iconSize: [28, 28], iconAnchor: [14, 14],
      html: `<svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="rgba(11,13,14,0.9)" stroke="#fff" stroke-width="1.6"/><path d="M8 15 L14 8 L20 15 M10.5 13.5 V19 H17.5 V13.5" fill="none" stroke="#eef2f3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    });
  }

  const MapView = forwardRef(function MapView(props, ref) {
    const { planned, captures, selectedSeq, onSelectCapture, mode = "detail", follow, onReady } = props;
    const elRef = useRef(null);
    const mapRef = useRef(null);
    const layers = useRef({});
    const coneMarkers = useRef(new Map()); // seq -> marker
    const selMarker = useRef(null);
    const droneMarker = useRef(null);
    const trailLine = useRef(null);
    const followRef = useRef(follow);
    const onSelRef = useRef(onSelectCapture);
    const didFit = useRef(false);
    followRef.current = follow;
    onSelRef.current = onSelectCapture;

    // init
    useEffect(() => {
      const map = L.map(elRef.current, {
        center: planned ? [planned.dock[1], planned.dock[0]] : SITE,
        zoom: 16, zoomControl: false, attributionControl: false, fadeAnimation: false,
        zoomSnap: 0.25, preferCanvas: false,
      });
      mapRef.current = map;
      window.__map = map;
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19, maxNativeZoom: 19, crossOrigin: true, keepBuffer: 3,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      setTimeout(() => map.invalidateSize(), 180);

      layers.current.coneGroup = L.layerGroup().addTo(map);
      ready();
      onReady && onReady();
      return () => { map.remove(); coneMarkers.current.clear(); };
      // eslint-disable-next-line
    }, []);

    function ready() {}

    // planned path + dock + cones
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !planned) return;
      const latlngs = planned.path.map((p) => [p[1], p[0]]);
      const aborted = planned.status === "aborted";
      const col = aborted ? "#ff6b5e" : "#4fe3a1";

      if (layers.current.glow) layers.current.glow.remove();
      if (layers.current.path) layers.current.path.remove();
      layers.current.glow = L.polyline(latlngs, { color: col, weight: 8, opacity: 0.16, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
      layers.current.path = L.polyline(latlngs, { color: col, weight: 2.4, opacity: 0.92, lineCap: "round", lineJoin: "round", dashArray: mode === "live" ? "3 4" : null, interactive: false }).addTo(map);
      if (mode === "live") layers.current.glow.setStyle({ opacity: 0.06 });

      if (!layers.current.dock) layers.current.dock = L.marker([planned.dock[1], planned.dock[0]], { icon: dockIcon(), interactive: false }).addTo(map);

      if (!didFit.current && latlngs.length > 1) {
        map.fitBounds(L.latLngBounds(latlngs), { padding: [70, 70], maxZoom: 18 });
        didFit.current = true;
      }
      // eslint-disable-next-line
    }, [planned, mode]);

    // add cone markers progressively as captures arrive
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !layers.current.coneGroup) return;
      const aborted = planned && planned.status === "aborted";
      (captures || []).forEach((c) => {
        if (coneMarkers.current.has(c.seq)) return;
        const mk = L.marker([c.lat, c.lon], { icon: makeConeIcon({ heading: c.heading, seq: c.seq, aborted }), riseOnHover: true });
        mk.on("click", () => onSelRef.current && onSelRef.current(c.seq, true));
        mk.addTo(layers.current.coneGroup);
        coneMarkers.current.set(c.seq, mk);
      });
      // eslint-disable-next-line
    }, [captures, planned]);

    // selection highlight + pan-if-offscreen
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      const cap = (captures || []).find((c) => c.seq === selectedSeq);
      if (selMarker.current) { selMarker.current.remove(); selMarker.current = null; }
      if (!cap) return;
      const aborted = planned && planned.status === "aborted";
      selMarker.current = L.marker([cap.lat, cap.lon], { icon: makeConeIcon({ heading: cap.heading, seq: cap.seq, sel: true, aborted }), zIndexOffset: 1000, interactive: false }).addTo(map);
      if (!map.getBounds().pad(-0.18).contains([cap.lat, cap.lon])) {
        map.panTo([cap.lat, cap.lon], { animate: true, duration: 0.4 });
      }
      // eslint-disable-next-line
    }, [selectedSeq, captures]);

    useImperativeHandle(ref, () => ({
      getMap: () => mapRef.current,
      setDrone(pose) {
        const map = mapRef.current; if (!map) return;
        if (!droneMarker.current) droneMarker.current = L.marker([pose.lat, pose.lon], { icon: droneIcon(pose.heading), zIndexOffset: 2000, interactive: false }).addTo(map);
        else { droneMarker.current.setLatLng([pose.lat, pose.lon]); droneMarker.current.setIcon(droneIcon(pose.heading)); }
        if (followRef.current) map.panTo([pose.lat, pose.lon], { animate: true, duration: 0.18, easeLinearity: 1 });
      },
      setTrail(coords) {
        const map = mapRef.current; if (!map) return;
        const ll = coords.map((c) => [c[1], c[0]]);
        if (!trailLine.current) trailLine.current = L.polyline(ll, { color: "#f5b13b", weight: 2.6, opacity: 0.95, lineCap: "round", interactive: false }).addTo(map);
        else trailLine.current.setLatLngs(ll);
      },
      addCapture(cap) {
        if (coneMarkers.current.has(cap.seq)) return;
        const mk = L.marker([cap.lat, cap.lon], { icon: makeConeIcon({ heading: cap.heading, seq: cap.seq }) });
        mk.on("click", () => onSelRef.current && onSelRef.current(cap.seq, true));
        mk.addTo(layers.current.coneGroup);
        coneMarkers.current.set(cap.seq, mk);
      },
      flyTo(center, zoom) { mapRef.current && mapRef.current.flyTo([center[1], center[0]], zoom, { duration: 0.8 }); },
      fit(coords) { if (mapRef.current && coords.length) mapRef.current.fitBounds(L.latLngBounds(coords.map((c) => [c[1], c[0]])), { padding: [80, 80], maxZoom: 18 }); },
      resize() { mapRef.current && mapRef.current.invalidateSize(); },
    }));

    return React.createElement("div", { className: "map-root" },
      React.createElement("div", { ref: elRef, className: "map-canvas" }),
      React.createElement("div", { className: "map-vignette" }));
  });

  window.MapView = MapView;
})();

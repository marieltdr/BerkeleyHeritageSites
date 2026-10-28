mapboxgl.accessToken = 'pk.eyJ1IjoibWFyaWVsdGRyIiwiYSI6ImNtaDljY3lnNjA1NzIya3Bwbmw4YThndHMifQ.8xjaPLZ8qauEqwsk7tsrLw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/marieltdr/cmh9cfchm009g01ra3lh24uro', 
  zoom: 12, 
  center: [-122.275, 37.871],
  touchZoomRotate: true 
});

map.addControl(new mapboxgl.NavigationControl());

  let rawGeoJson = null;

  function extractYear(feature) {
  const props = feature.properties;
  
  const dateStr = 
    props["original_*  Designated  *"] || 
    props["Designated"] || 
    props["original_*Designated*"] || 
    "";

  const match = String(dateStr).match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}
  

map.on('load', async function() {
  const response = await fetch('https://raw.githubusercontent.com/marieltdr/183geodata/refs/heads/main/183data.geojson');
  rawGeoJson = await response.json();

  map.addSource('points-data', {
    type: 'geojson',
    data: rawGeoJson,
    generateId: true,
    cluster: true,
    clusterMaxZoom: 12,
    clusterRadius: 50
  });

  
  // Cluster Circles
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'points-data',
    filter: ['has', 'point_count'], 
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#F7DF7C', 
        5, '#E8C94D', 
        20, '#E8C21C' 
      ],
      'circle-opacity': 1, 
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        18, 
        5, 24, 
        15, 30 
      ],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-opacity': 1
    }
  });

  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'points-data',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12
    }
  });

  map.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'points-data',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#FFFF00',
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        10, // Size when hovered
        6   // Default size
      ],
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#FFFFFF',
    'circle-stroke-opacity': 1    
    }
  });

  // Zoom into clusters on click
  map.on('click', 'clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    const clusterId = features[0].properties.cluster_id;
    
    map.getSource('points-data').getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      map.easeTo({
        center: features[0].geometry.coordinates,
        zoom: zoom
      });
    });
  });

  // Popup on unclustered point click
  map.on('click', 'unclustered-point', (e) => {
    const coordinates = e.features[0].geometry.coordinates.slice();
    const properties = e.features[0].properties;

    // Fallbacks handle keys with or without asterisks from GeoJSON conversion
    const landmark = properties["original_*Landmark*"] || properties["Landmark"] || "Heritage Site";
    const address = properties["original_*Address*"] || properties["Address"] || "N/A";
    const archDate = properties["original_*Architect & Date*"] || properties["Architect & Date"] || "N/A";
    const designated = properties["original_*  Designated  *"] || properties["Designated"] || "N/A";
    const notes = properties["original_*Notes*"] || properties["Notes"];
    const link = properties.Link;

    const popupContent = `
      <div style="font-family: sans-serif; padding: 5px;">
        <h3 style="margin: 0 0 5px 0; font-size: 14px;">${landmark}</h3>
        <p style="margin: 3px 0; font-size: 12px;"><strong>Address:</strong> ${address}</p>
        <p style="margin: 3px 0; font-size: 12px;"><strong>Architect & Date:</strong> ${archDate}</p>
        <p style="margin: 3px 0; font-size: 12px;"><strong>Designated:</strong> ${designated}</p>
        ${notes ? `<p style="margin: 3px 0; font-size: 12px;"><strong>Notes:</strong> \${notes}</p>` : ''}
        ${link ? `<p style="margin: 5px 0 0 0;"><a href="\${link}" target="_blank" style="font-size: 12px; color: #0078A8;">More Info</a></p>` : ''}
      </div>
    `;

    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    new mapboxgl.Popup()
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(map);
  });

  // Cursor pointer & feature state hover effects
  let hoveredStateId = null;

  map.on('mouseenter', 'unclustered-point', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mousemove', 'unclustered-point', (e) => {
    if (e.features.length > 0) {
      if (hoveredStateId !== null) {
        map.setFeatureState({ source: 'points-data', id: hoveredStateId }, { hover: false });
      }
      hoveredStateId = e.features[0].id;
      map.setFeatureState({ source: 'points-data', id: hoveredStateId }, { hover: true });
    }
  });

  map.on('mouseleave', 'unclustered-point', () => {
    map.getCanvas().style.cursor = '';
    if (hoveredStateId !== null) {
      map.setFeatureState({ source: 'points-data', id: hoveredStateId }, { hover: false });
    }
    hoveredStateId = null;
  });
// FILTERING
const filterSelect = document.getElementById('date-filter');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      const range = e.target.value;

      if (!rawGeoJson) return;

      if (range === 'all') {
        map.getSource('points-data').setData(rawGeoJson);
        return;
      }

      const filteredFeatures = rawGeoJson.features.filter((feature) => {
        const year = extractYear(feature);
        if (!year) return false;

        if (range === 'before-2000') return year < 2000;
        if (range === '2000-2005') return year >= 2000 && year <= 2005;
        if (range === 'after-2005') return year > 2005;
        return true;
      });

      // Updates points and forces cluster recalculation
      map.getSource('points-data').setData({
        type: 'FeatureCollection',
        features: filteredFeatures
      });
    });
  }
  // FILTERING ENDS
});

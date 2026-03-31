import { useEffect, useMemo, useRef, useState, memo } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const GEO_URL =
  'https://cdn.jsdelivr.net/gh/gregoiredavid/france-geojson@master/regions.geojson'

let geoCache = null

function norm(s = '') {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function potentialColor(val) {
  if (val == null || isNaN(Number(val))) return '#ddd4bd'
  const v = Math.max(0, Math.min(100, Number(val)))
  if (v >= 70) return '#1a5248'
  if (v >= 50) return '#1f6d64'
  if (v >= 30) return '#2d9085'
  if (v >= 15) return '#7ab8b2'
  if (v >= 5) return '#b8d9d6'
  return '#e8f5f3'
}

const LEGEND = [
  { label: '≥ 70 %', color: '#1a5248' },
  { label: '50 – 70 %', color: '#1f6d64' },
  { label: '30 – 50 %', color: '#2d9085' },
  { label: '15 – 30 %', color: '#7ab8b2' },
  { label: '5 – 15 %', color: '#b8d9d6' },
  { label: '< 5 %', color: '#e8f5f3' },
  { label: 'N/A', color: '#ddd4bd' },
]

const OVERSEAS = ['Guadeloupe', 'Martinique', 'Guyane', 'La Réunion', 'Mayotte']

export default memo(function FranceMap({ regions }) {
  const [geoData, setGeoData] = useState(geoCache)
  const [loadError, setLoadError] = useState(false)
  const geoRef = useRef(null)
  const lookupRef = useRef({})

  useEffect(() => {
    if (geoCache) return
    fetch(GEO_URL)
      .then((r) => {
        if (!r.ok) throw new Error('Échec du chargement GeoJSON')
        return r.json()
      })
      .then((d) => { geoCache = d; setGeoData(d) })
      .catch(() => setLoadError(true))
  }, [])

  const lookup = useMemo(() => {
    const m = {}
    for (const r of regions) {
      const key = norm(r.region_name || r.region_code || '')
      if (key)
        m[key] =
          r.overall_commercial_potential != null
            ? Number(r.overall_commercial_potential)
            : null
    }
    return m
  }, [regions])

  useEffect(() => {
    lookupRef.current = lookup
    const layer = geoRef.current
    if (!layer) return
    layer.eachLayer((l) => {
      if (!l.feature) return
      const val = lookup[norm(l.feature.properties.nom)]
      l.setStyle({
        fillColor: potentialColor(val ?? null),
        weight: 1,
        color: '#8a7a65',
        fillOpacity: val != null ? 0.82 : 0.25,
      })
      const valStr = val != null ? `${Number(val).toFixed(1)} %` : 'Données manquantes'
      l.setTooltipContent(
        `<div style="font-family:Outfit,sans-serif;padding:2px 4px">
          <strong>${l.feature.properties.nom}</strong><br/>
          Potentiel commercial : <b>${valStr}</b>
        </div>`
      )
    })
  }, [lookup])

  const overseasData = useMemo(() => {
    return OVERSEAS.map((name) => ({
      name,
      val: lookup[norm(name)] ?? null,
    })).filter((o) => o.val !== null)
  }, [lookup])

  function styleFeature(feature) {
    const val = lookupRef.current[norm(feature.properties.nom)]
    return {
      fillColor: potentialColor(val ?? null),
      weight: 1,
      color: '#8a7a65',
      fillOpacity: val != null ? 0.82 : 0.25,
    }
  }

  function onEachFeature(feature, layer) {
    const val = lookupRef.current[norm(feature.properties.nom)]
    const valStr = val != null ? `${Number(val).toFixed(1)} %` : 'Données manquantes'
    layer.bindTooltip(
      `<div style="font-family:Outfit,sans-serif;padding:2px 4px">
        <strong>${feature.properties.nom}</strong><br/>
        Potentiel commercial : <b>${valStr}</b>
      </div>`,
      { sticky: true }
    )
    layer.on({
      mouseover(e) {
        e.target.setStyle({ weight: 2.5, fillOpacity: 0.95 })
      },
      mouseout(e) {
        const v = lookupRef.current[norm(feature.properties.nom)]
        e.target.setStyle({
          weight: 1,
          fillOpacity: v != null ? 0.82 : 0.25,
        })
      },
    })
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[#ddd4bd]"
      style={{ height: 420 }}
    >
      {!geoData && !loadError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#fffdf7]/80 text-sm text-[#6f6759]">
          Chargement de la carte…
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#fff8f8]/90 text-sm text-[#8a3030]">
          Impossible de charger les données cartographiques.
        </div>
      )}

      <MapContainer
        center={[46.0, 3.0]}
        zoom={5}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          opacity={0.45}
        />
        {geoData && (
          <GeoJSON
            ref={geoRef}
            data={geoData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>

      <div className="absolute bottom-3 left-3 z-[1000] rounded-xl border border-[#ddd4bd] bg-[#fffdf7]/95 px-3 py-2 text-xs shadow-md">
        <p className="mb-1.5 font-semibold text-[#3d3028]">Potentiel</p>
        {LEGEND.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 leading-5">
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: 2,
                background: s.color,
                display: 'inline-block',
                border: '1px solid #b8a98a',
                flexShrink: 0,
              }}
            />
            <span className="text-[#5f5850]">{s.label}</span>
          </div>
        ))}
      </div>

      {overseasData.length > 0 && (
        <div className="absolute bottom-3 right-3 z-[1000] rounded-xl border border-[#ddd4bd] bg-[#fffdf7]/95 px-3 py-2 text-xs shadow-md">
          <p className="mb-1.5 font-semibold text-[#3d3028]">Outre-mer</p>
          {overseasData.map((o) => (
            <div key={o.name} className="flex items-center gap-1.5 leading-5">
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 2,
                  background: potentialColor(o.val),
                  display: 'inline-block',
                  border: '1px solid #b8a98a',
                  flexShrink: 0,
                }}
              />
              <span className="text-[#5f5850]">
                {o.name}{' '}
                <strong style={{ color: '#1a5248' }}>
                  {o.val != null ? `${o.val.toFixed(1)}%` : '–'}
                </strong>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

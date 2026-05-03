import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css'
import L from 'leaflet'
import 'leaflet-routing-machine'
import './App.css'

const FALLBACK_STATIONS = [
  { id: 1, name: 'OMV Ljubljana Center', brand: 'OMV', price: 1.489, fuel: 'gazole', lng: 14.5058, lat: 46.0569, city: 'Ljubljana', distance: 0.5, country: 'Slovenia' },
  { id: 2, name: 'Petrol Tivoli', brand: 'Petrol', price: 1.439, fuel: 'gazole', lng: 14.4986, lat: 46.0614, city: 'Ljubljana', distance: 1.2, country: 'Slovenia' },
  { id: 3, name: 'Shell Siska', brand: 'Shell', price: 1.519, fuel: 'gazole', lng: 14.4879, lat: 46.0721, city: 'Ljubljana', distance: 2.1, country: 'Slovenia' },
  { id: 4, name: 'MOL Bezigrad', brand: 'MOL', price: 1.469, fuel: 'gazole', lng: 14.5123, lat: 46.0678, city: 'Ljubljana', distance: 2.8, country: 'Slovenia' },
  { id: 5, name: 'Petrol Vic', brand: 'Petrol', price: 1.429, fuel: 'gazole', lng: 14.4801, lat: 46.0489, city: 'Ljubljana', distance: 3.4, country: 'Slovenia' },
]

const FUEL_TABS = [
  { label: 'Diesel', value: 'gazole' },
  { label: '95', value: 'sp95' },
  { label: '98', value: 'sp98' },
  { label: 'LPG', value: 'gplc' },
  { label: 'E10', value: 'e10' },
]

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://gasify-api.onrender.com'

const BRAND_LOGOS = {
  shell: 'SH', omv: 'OM', petrol: 'PT', mol: 'ML',
  bp: 'BP', total: 'TT', avia: 'AV', default: 'GS',
}

const FUEL_NEWS = {
  gazole: [
    { region: 'Northern Europe', trend: 'up',   title: 'Diesel demand rises before weekend logistics wave.' },
    { region: 'Central Europe',  trend: 'down', title: 'Refinery throughput improved, softening diesel prices.' },
    { region: 'Southern Europe', trend: 'up',   title: 'Port maintenance causes temporary diesel supply pressure.' },
  ],
  sp95: [
    { region: 'Northern Europe', trend: 'down', title: 'Mild demand and stable imports cool SP95 prices.' },
    { region: 'Central Europe',  trend: 'up',   title: 'Short wholesale spikes push SP95 slightly higher.' },
    { region: 'Southern Europe', trend: 'up',   title: 'Tourism traffic begins lifting petrol consumption.' },
  ],
  sp98: [
    { region: 'Northern Europe', trend: 'up',   title: 'Premium fuel inventories tighten across metro corridors.' },
    { region: 'Central Europe',  trend: 'down', title: 'Premium spread narrows after procurement reset.' },
    { region: 'Southern Europe', trend: 'up',   title: 'Higher driving season demand lifts SP98 rates.' },
  ],
  gplc: [
    { region: 'Northern Europe', trend: 'down', title: 'LPG shipping flows recover, easing pressure.' },
    { region: 'Central Europe',  trend: 'up',   title: 'Spot market volatility affects LPG station pricing.' },
    { region: 'Southern Europe', trend: 'down', title: 'Storage levels remain healthy, supporting lower LPG.' },
  ],
  e10: [
    { region: 'Northern Europe', trend: 'up',   title: 'Bio-blend input costs edge higher for E10.' },
    { region: 'Central Europe',  trend: 'down', title: 'Ethanol blending costs stabilize this week.' },
    { region: 'Southern Europe', trend: 'up',   title: 'Transport bottlenecks keep E10 slightly elevated.' },
  ],
}

function priceColor(p) {
  if (p <= 1.60) return 'var(--green)'
  if (p <= 1.90) return 'var(--orange)'
  return 'var(--red)'
}

function priceHex(p) {
  if (p <= 1.60) return '#30d158'
  if (p <= 1.90) return '#ff9f0a'
  return '#ff453a'
}

function brandAbbr(brand = '') {
  return BRAND_LOGOS[brand.toLowerCase()] || BRAND_LOGOS.default
}

function countryCode(country = '') {
  return country ? country.slice(0, 2).toUpperCase() : 'EU'
}

function stationIcon(station, selected) {
  const c = priceHex(station.price)
  const bg = selected ? 'rgba(10,132,255,0.14)' : 'rgba(20,20,22,0.97)'
  const bd = selected ? 'rgba(10,132,255,0.7)' : c
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;gap:5px;padding:4px 9px;border-radius:20px;border:1.5px solid ${bd};background:${bg};font-family:-apple-system,'SF Pro Text','Inter',sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.55)">
      <span style="width:5px;height:5px;border-radius:50%;background:${c};display:inline-block;flex-shrink:0"></span>
      <span style="color:${c};font-size:11px;font-weight:700;white-space:nowrap;letter-spacing:-0.4px">€${station.price.toFixed(3)}</span>
    </div>`,
    iconAnchor: [46, 14],
    iconSize: [92, 26],
  })
}

function userIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:#0a84ff;border-radius:50%;border:2.5px solid white;box-shadow:0 0 0 4px rgba(10,132,255,0.28),0 2px 10px rgba(0,0,0,0.5)"></div>`,
    iconAnchor: [7, 7],
  })
}

function FlyTo({ target, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, zoom || 9, { duration: 0.9, easeLinearity: 0.3 })
  }, [target, zoom])
  return null
}

function RouteMachine({ userLocation, destination, onRouteUpdate }) {
  const map = useMap()
  useEffect(() => {
    if (!map) return undefined
    if (!userLocation || !destination) { onRouteUpdate(null); return undefined }

    const ctrl = L.Routing.control({
      waypoints: [
        L.latLng(userLocation.lat, userLocation.lng),
        L.latLng(destination.lat, destination.lng),
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      fitSelectedRoutes: true,
      show: false,
      lineOptions: {
        styles: [
          { color: '#1a4a7a', opacity: 0.9, weight: 8 },
          { color: '#0a84ff', opacity: 1, weight: 4 },
        ],
      },
      createMarker: () => null,
    }).addTo(map)

    ctrl.on('routesfound', (e) => {
      const r = e.routes?.[0]
      if (!r) return
      onRouteUpdate({
        distanceKm: r.summary.totalDistance / 1000,
        durationMin: r.summary.totalTime / 60,
        instructions: r.instructions.slice(0, 5).map((s) => s.text),
      })
    })

    ctrl.on('routingerror', () => {
      onRouteUpdate({ distanceKm: null, durationMin: null, instructions: ['Unable to compute route.'] })
    })

    return () => { map.removeControl(ctrl) }
  }, [map, userLocation, destination, onRouteUpdate])

  return null
}

async function geocodeCity(city) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'Gasify/1.0' } })
    const data = await res.json()
    if (!data.length) return null
    const r = data[0]
    const bb = r.boundingbox // [south, north, west, east]
    const bbox = bb?.length === 4 ? {
      minLat: parseFloat(bb[0]),
      maxLat: parseFloat(bb[1]),
      minLng: parseFloat(bb[2]),
      maxLng: parseFloat(bb[3]),
    } : null
    return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), bbox }
  } catch { return null }
}

async function fetchStations(fuel, lat, lng, bbox = null) {
  try {
    let url = `${API_URL}/api/stations?fuel=${fuel}`
    if (lat && lng) url += `&lat=${lat}&lng=${lng}`
    if (bbox) url += `&bbox=${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch { return [] }
}

export default function App() {
  const [selected, setSelected]           = useState(null)
  const [activeTab, setActiveTab]         = useState('gazole')
  const [stations, setStations]           = useState(FALLBACK_STATIONS)
  const [loading, setLoading]             = useState(true)
  const [dataSource, setDataSource]       = useState('demo')
  const [userLocation, setUserLocation]   = useState(null)
  const [locationStatus, setLocationStatus] = useState('idle')
  const [mapTarget, setMapTarget]         = useState([46.1512, 14.9955])
  const [mapZoom, setMapZoom]             = useState(9)
  const [sortBy, setSortBy]               = useState('distance')
  const [searchQuery, setSearchQuery]     = useState('')
  const [activeLocation, setActiveLocation] = useState(null)
  const [alertsOn, setAlertsOn]           = useState(false)
  const [priceAlerts, setPriceAlerts]     = useState([])
  const [navQuery, setNavQuery]           = useState('')
  const [navNote, setNavNote]             = useState('')
  const [routeDest, setRouteDest]         = useState(null)
  const [routeInfo, setRouteInfo]         = useState(null)
  const [open, setOpen]                   = useState({ insights: false, news: false })
  const [isNavigating, setIsNavigating]   = useState(false)
  const [sheetOpen, setSheetOpen]         = useState(false)
  const [regionBbox, setRegionBbox]       = useState(null)
  const [regionName, setRegionName]       = useState(null)

  useEffect(() => {
    getUserLocation()
    const t = setInterval(() => {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition((pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        setActiveLocation(loc)
      }, () => {})
    }, 120_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (locationStatus === 'granted' || locationStatus === 'denied') {
      loadStations(activeLocation, regionBbox)
    }
  }, [activeTab, activeLocation, locationStatus, regionBbox])

  useEffect(() => {
    if (!stations.length) return
    const avg = stations.reduce((s, x) => s + x.price, 0) / stations.length
    const cheap = [...stations].sort((a, b) => a.price - b.price)[0]
    const pricey = [...stations].sort((a, b) => b.price - a.price)[0]
    setPriceAlerts([
      { id: 'avg',   type: 'Market pulse', text: `Average ${activeTab.toUpperCase()} in your area: €${avg.toFixed(3)}/L` },
      { id: 'cheap', type: 'Best deal',    text: `${cheap?.name} — cheapest at €${cheap?.price.toFixed(3)}/L` },
      { id: 'high',  type: 'Watchlist',    text: `${pricey?.name} — highest at €${pricey?.price.toFixed(3)}/L` },
    ])
  }, [stations, activeTab])

  function getUserLocation() {
    setLocationStatus('asking')
    if (!navigator.geolocation) { setLocationStatus('denied'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        setActiveLocation(loc)
        setMapTarget([loc.lat, loc.lng])
        setMapZoom(12)
        setLocationStatus('granted')
      },
      () => {
        setLocationStatus('denied')
        setMapTarget([46.1512, 14.9955])
        setMapZoom(9)
      }
    )
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setLoading(true)
    const r = await geocodeCity(searchQuery)
    if (r) {
      setActiveLocation({ lat: r.lat, lng: r.lng })
      setMapTarget([r.lat, r.lng])
      setMapZoom(12)
      setRegionBbox(r.bbox)
      setRegionName(searchQuery.trim())
    } else {
      alert('City not found.')
      setLoading(false)
    }
  }

  function clearRegion() {
    setRegionBbox(null)
    setRegionName(null)
    setSearchQuery('')
  }

  async function handleNavGo() {
    if (!navQuery.trim()) return
    const r = await geocodeCity(navQuery.trim())
    if (!r) { setNavNote('Destination not found.'); return }
    setMapTarget([r.lat, r.lng])
    setMapZoom(13)
    setRouteDest({ lat: r.lat, lng: r.lng, label: navQuery.trim() })
    setNavNote(`Route set to ${navQuery.trim()}.`)
  }

  function handleCheapestNearby() {
    if (!stations.length) return
    const pool = stations.filter((s) => s.distance != null && s.distance <= 25)
    const src = pool.length ? pool : stations
    const cheapest = [...src].sort((a, b) => a.price - b.price)[0]
    if (!cheapest) return
    setSelected(cheapest)
    setSortBy('price')
    setMapTarget([cheapest.lat, cheapest.lng])
    setMapZoom(15)
    setRouteDest({ lat: cheapest.lat, lng: cheapest.lng, label: cheapest.name })
    setNavNote(`Route set to ${cheapest.name}.`)
  }

  async function loadStations(location, bbox = null) {
    setLoading(true)
    setSelected(null)
    const data = await fetchStations(activeTab, location?.lat || null, location?.lng || null, bbox)
    if (data.length > 0) {
      setStations(data)
      setDataSource('live')
    } else {
      setStations(FALLBACK_STATIONS)
      setDataSource('demo')
    }
    setLoading(false)
  }

  function startNav() {
    if (!routeDest && !selected) return
    setIsNavigating(true)
    if (routeDest) { setMapTarget([routeDest.lat, routeDest.lng]); setMapZoom(14) }
  }

  function endNav() {
    setIsNavigating(false)
    setRouteDest(null)
    setRouteInfo(null)
    setSelected(null)
    setNavNote('')
    setNavQuery('')
  }

  function selectStation(station) {
    setSelected(station)
    setMapTarget([station.lat, station.lng])
    setMapZoom(15)
    setRouteDest({ lat: station.lat, lng: station.lng, label: station.name })
    setSheetOpen(false) // collapse sheet on mobile after selecting
  }

  const sorted = [...stations].sort((a, b) =>
    sortBy === 'distance'
      ? (a.distance ?? 999) - (b.distance ?? 999)
      : a.price - b.price
  )

  const cheapestPrice    = sorted[0]?.price
  const nearestStation   = sorted.find((s) => s.distance != null)
  const resolvedDistance = selected?.distance ?? nearestStation?.distance
  const estDuration      = resolvedDistance ? Math.max(4, Math.round((resolvedDistance / 55) * 60)) : null
  const fuelNews         = FUEL_NEWS[activeTab] || []
  const fuelLabel        = FUEL_TABS.find((f) => f.value === activeTab)?.label
  const hasRoute         = !!(routeDest || selected)

  const toggle = (k) => setOpen((p) => ({ ...p, [k]: !p[k] }))

  return (
    <div className="app">

      {/* ── MAP (full screen behind everything) ── */}
      <div className="map-wrap">

        {/* Google/Apple-style navigation overlay */}
        {isNavigating && (
          <div className={`nav-overlay ${sheetOpen ? 'sheet-up' : ''}`}>
            <div className="nav-ov-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
            </div>
            <div className="nav-ov-body">
              <div className="nav-ov-step">
                {routeInfo?.instructions?.[0] || 'Follow the route on the map'}
              </div>
              <div className="nav-ov-meta">
                {routeInfo?.distanceKm ? `${routeInfo.distanceKm.toFixed(1)} km` : '—'}
                {' · '}
                {routeInfo?.durationMin ? `~${Math.round(routeInfo.durationMin)} min` : '—'}
                {routeDest?.label ? ` · ${routeDest.label}` : ''}
              </div>
            </div>
            <button className="nav-ov-end" onClick={endNav}>End</button>
          </div>
        )}

        <MapContainer
          center={[50.3, 9.7]}
          zoom={6}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          maxBounds={[[35, -11], [71, 33]]}
          minZoom={4}
          maxZoom={18}
        >
          <TileLayer
            attribution='&copy; CartoDB'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <FlyTo target={mapTarget} zoom={mapZoom} />
          <RouteMachine userLocation={userLocation} destination={routeDest} onRouteUpdate={setRouteInfo} />

          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon()}>
              <Popup><div className="popup-name">Your location</div></Popup>
            </Marker>
          )}

          {stations.map((s) => (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={stationIcon(s, selected?.id === s.id)}
              eventHandlers={{ click: () => selectStation(s) }}
            >
              <Popup>
                <div>
                  <div className="popup-name">{s.name}</div>
                  <div className="popup-meta">
                    {countryCode(s.country)} · {s.city}
                    {s.distance != null && ` · ${s.distance.toFixed(1)} km`}
                  </div>
                  <div className="popup-prices">
                    {s.gazole && <div className="popup-row"><span className="popup-fuel">Diesel</span><span className="popup-price" style={{ color: priceHex(s.gazole) }}>€{s.gazole.toFixed(3)}</span></div>}
                    {s.sp95   && <div className="popup-row"><span className="popup-fuel">95</span>    <span className="popup-price">€{s.sp95.toFixed(3)}</span></div>}
                    {s.sp98   && <div className="popup-row"><span className="popup-fuel">98</span>    <span className="popup-price">€{s.sp98.toFixed(3)}</span></div>}
                    {s.gplc   && <div className="popup-row"><span className="popup-fuel">LPG</span>   <span className="popup-price">€{s.gplc.toFixed(3)}</span></div>}
                    {s.e10    && <div className="popup-row"><span className="popup-fuel">E10</span>   <span className="popup-price">€{s.e10.toFixed(3)}</span></div>}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* ── PANEL (sidebar on desktop, bottom sheet on mobile) ── */}
      <div className={`panel ${sheetOpen ? 'sheet-open' : ''}`}>

        {/* Mobile drag handle */}
        <div className="sheet-handle-bar" onClick={() => setSheetOpen((v) => !v)}>
          <div className="sheet-handle" />
        </div>

        {/* Header */}
        <div className="panel-header">
          <div className="logo">
            <div className="logo-mark">G</div>
            GASIFY
          </div>
          <button
            className="icon-btn"
            title="Sign in"
            onClick={() => setSheetOpen(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="search-wrap">
          <div className="search-bar">
            <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="search-input"
              type="text"
              placeholder="Search city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSheetOpen(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            {searchQuery && (
              <button className="search-btn" onClick={handleSearch}>Go</button>
            )}
          </div>
        </div>

        {/* Status row */}
        <div className="status-row">
          <div className="status-live">
            <div className={`live-dot ${dataSource === 'live' ? 'on' : 'off'}`} />
            <span>
              {dataSource === 'live'
                ? `Live · ${regionName || 'Europe'}`
                : 'Demo data'}
            </span>
            <span style={{ margin: '0 2px', opacity: 0.3 }}>·</span>
            <span>{loading ? '…' : `${stations.length} stations`}</span>
            {regionName && (
              <button className="region-clear" onClick={clearRegion} title="Clear region filter">✕</button>
            )}
          </div>
          <div className="status-pills">
            <button
              className={`pill-btn ${locationStatus === 'granted' && !regionName ? 'on' : ''}`}
              onClick={() => {
                clearRegion()
                setActiveLocation(userLocation)
                if (userLocation) { setMapTarget([userLocation.lat, userLocation.lng]); setMapZoom(12) }
                getUserLocation()
              }}
            >
              {locationStatus === 'asking' ? 'Locating…' : 'Near me'}
            </button>
            <button
              className={`pill-btn ${alertsOn ? 'on' : ''}`}
              onClick={() => {
                setAlertsOn((v) => !v)
                if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
              }}
            >
              Alerts
            </button>
          </div>
        </div>

        {/* Fuel chips */}
        <div className="fuel-chips">
          {FUEL_TABS.map((tab) => (
            <button
              key={tab.value}
              className={`chip ${activeTab === tab.value ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="sep" />

        {/* Navigation card */}
        <div className="nav-card">
          <div className="card-label">Navigate to</div>
          <div className="input-row">
            <input
              className="field-input"
              type="text"
              placeholder="City or destination…"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNavGo()}
            />
            <button className="btn-blue" onClick={handleNavGo}>Go</button>
          </div>
          <button className="btn-muted" onClick={handleCheapestNearby}>
            Cheapest station nearby →
          </button>
          {navNote && <div className="nav-note">{navNote}</div>}
        </div>

        {/* Route / GO / END card */}
        <div className={`route-card ${isNavigating ? 'active' : ''}`}>
          {isNavigating ? (
            <>
              <div className="nav-active-badge">Navigating</div>
              <div className="nav-active-dest">{routeDest?.label || selected?.name || 'Destination'}</div>
              <div className="nav-active-stats">
                {routeInfo?.distanceKm ? `${routeInfo.distanceKm.toFixed(1)} km` : resolvedDistance ? `${resolvedDistance.toFixed(1)} km` : '—'}
                {' · '}
                {routeInfo?.durationMin ? `~${Math.round(routeInfo.durationMin)} min` : estDuration ? `~${estDuration} min` : '—'}
                {' · '}
                {fuelLabel}
              </div>
              <button className="btn-end" onClick={endNav}>End navigation</button>
            </>
          ) : (
            <>
              <div className="card-label">Route</div>
              <div className="route-dest">
                {routeDest ? `To ${routeDest.label || 'destination'}` : selected ? `To ${selected.name}` : 'Select a station or set a destination'}
              </div>
              <div className="stats-grid">
                <div className="stat-box">
                  <span className="stat-label">Distance</span>
                  <span className="stat-val">
                    {routeInfo?.distanceKm ? `${routeInfo.distanceKm.toFixed(1)} km` : resolvedDistance ? `${resolvedDistance.toFixed(1)} km` : '—'}
                  </span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">ETA</span>
                  <span className="stat-val">
                    {routeInfo?.durationMin ? `${Math.round(routeInfo.durationMin)} min` : estDuration ? `${estDuration} min` : '—'}
                  </span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Fuel</span>
                  <span className="stat-val">{fuelLabel}</span>
                </div>
              </div>
              {routeInfo?.instructions?.length > 0 && (
                <div className="route-steps">
                  {routeInfo.instructions.map((step, i) => (
                    <div key={`${step}-${i}`} className="route-step">{i + 1}. {step}</div>
                  ))}
                </div>
              )}
              <button className="btn-go" disabled={!hasRoute} onClick={startNav}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                GO
              </button>
            </>
          )}
        </div>

        <div className="sep" />

        {/* Station list */}
        <div className="list-header">
          <span className="list-title">Stations</span>
          <div className="sort-seg">
            <button className={`sort-btn ${sortBy === 'distance' ? 'on' : ''}`} onClick={() => setSortBy('distance')}>Nearest</button>
            <button className={`sort-btn ${sortBy === 'price'    ? 'on' : ''}`} onClick={() => setSortBy('price')}>Cheapest</button>
          </div>
        </div>

        <div className="stations-list">
          {loading ? (
            <div className="loading-wrap">
              <div className="spinner" />
              <span>Fetching stations…</span>
            </div>
          ) : sorted.map((station, i) => (
            <div
              key={station.id}
              className={`station-card ${selected?.id === station.id ? 'selected' : ''}`}
              style={{ animationDelay: `${i * 0.035}s` }}
              onClick={() => selectStation(station)}
            >
              <span className="stn-rank">{i + 1}</span>
              <div className="brand-box">{brandAbbr(station.brand)}</div>
              <div className="stn-info">
                <div className="stn-name">{station.name}</div>
                <div className="stn-meta">
                  <span>{countryCode(station.country)}</span>
                  <span className="meta-dot">·</span>
                  <span>{station.city}</span>
                  {station.distance != null && (
                    <><span className="meta-dot">·</span><span>{station.distance.toFixed(1)} km</span></>
                  )}
                </div>
              </div>
              <div className="price-col">
                <div className="price-num" style={{ color: priceColor(station.price) }}>
                  €{station.price.toFixed(3)}
                </div>
                <div className="price-lbl">/L</div>
              </div>
            </div>
          ))}
        </div>

        <div className="sep" style={{ marginTop: 14 }} />

        {/* Insights collapsible */}
        <div className="collapsible">
          <button className="coll-btn" onClick={() => toggle('insights')}>
            Europe fuel updates
            <svg className={`caret ${open.insights ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {open.insights && (
            <div className="coll-body">
              {priceAlerts.map((a) => (
                <div className="insight-item" key={a.id}>
                  <div className="insight-tag">{a.type}</div>
                  <div className="insight-text">{a.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trend signals collapsible */}
        <div className="collapsible">
          <button className="coll-btn" onClick={() => toggle('news')}>
            Trend signals · {fuelLabel}
            <svg className={`caret ${open.news ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {open.news && (
            <div className="coll-body">
              {fuelNews.map((item) => (
                <div className="news-item" key={item.region}>
                  <span className={`trend-tag ${item.trend}`}>
                    {item.trend === 'up' ? '↑ Rising' : '↓ Falling'}
                  </span>
                  <div>
                    <div className="news-region">{item.region}</div>
                    <div className="news-body">{item.title}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="legend">
          <div className="legend-item"><div className="ldot" style={{ background: 'var(--green)' }} />Cheap</div>
          <div className="legend-item"><div className="ldot" style={{ background: 'var(--orange)' }} />Average</div>
          <div className="legend-item"><div className="ldot" style={{ background: 'var(--red)' }} />Expensive</div>
          {cheapestPrice && <span className="best-price">Best: €{cheapestPrice.toFixed(3)}</span>}
        </div>

      </div>
    </div>
  )
}

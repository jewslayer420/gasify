import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import './App.css'

const FALLBACK_STATIONS = [
  { id: 1, name: 'OMV Ljubljana Center', brand: 'OMV', price: 1.49, fuel: 'gazole', lng: 14.5058, lat: 46.0569, city: 'Ljubljana', distance: 0.5 },
  { id: 2, name: 'Petrol Tivoli', brand: 'Petrol', price: 1.44, fuel: 'gazole', lng: 14.4986, lat: 46.0614, city: 'Ljubljana', distance: 1.2 },
  { id: 3, name: 'Shell Šiška', brand: 'Shell', price: 1.52, fuel: 'gazole', lng: 14.4879, lat: 46.0721, city: 'Ljubljana', distance: 2.1 },
  { id: 4, name: 'MOL Bežigrad', brand: 'MOL', price: 1.47, fuel: 'gazole', lng: 14.5123, lat: 46.0678, city: 'Ljubljana', distance: 2.8 },
  { id: 5, name: 'Petrol Vič', brand: 'Petrol', price: 1.43, fuel: 'gazole', lng: 14.4801, lat: 46.0489, city: 'Ljubljana', distance: 3.4 },
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

function getPriceColor(price) {
  if (price <= 1.60) return '#22c55e'
  if (price <= 1.90) return '#f59e0b'
  return '#ef4444'
}

function createPriceIcon(price, selected) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: ${getPriceColor(price)};
      color: white;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      border: ${selected ? '3px solid white' : '2px solid rgba(255,255,255,0.6)'};
      box-shadow: 0 2px 12px rgba(0,0,0,0.5);
      font-family: sans-serif;
      white-space: nowrap;
    ">€${price.toFixed(2)}</div>`,
    iconAnchor: [30, 15],
  })
}

function createUserIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 18px;
      height: 18px;
      background: #3b82f6;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 0 3px rgba(59,130,246,0.4);
    "></div>`,
    iconAnchor: [9, 9],
  })
}

function FlyTo({ target, zoom }) {
  const map = useMap()
  if (target) map.flyTo(target, zoom || 13, { duration: 1.2 })
  return null
}

async function geocodeCity(city) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Gasify/1.0' }
    })
    const data = await res.json()
    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        name: data[0].display_name.split(',')[0]
      }
    }
    return null
  } catch (e) {
    return null
  }
}

async function fetchStations(fuel, lat, lng) {
  try {
    let url = `${API_URL}/api/stations?fuel=${fuel}`
    if (lat && lng) url += `&lat=${lat}&lng=${lng}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch (e) {
    console.log('API error:', e)
    return []
  }
}

export default function App() {
  const [selected, setSelected] = useState(null)
  const [activeTab, setActiveTab] = useState('gazole')
  const [stations, setStations] = useState(FALLBACK_STATIONS)
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState('demo')
  const [userLocation, setUserLocation] = useState(null)
  const [locationStatus, setLocationStatus] = useState('idle')
  const [mapTarget, setMapTarget] = useState(null)
  const [mapZoom, setMapZoom] = useState(6)
  const [sortBy, setSortBy] = useState('distance')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLocation, setSearchLocation] = useState(null)
  const [activeLocation, setActiveLocation] = useState(null)

 useEffect(() => {
  getUserLocation()

  // Auto refresh location every 2 minutes
  const interval = setInterval(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setUserLocation(loc)
          setActiveLocation(loc)
        },
        () => {}
      )
    }
  }, 2 * 60 * 1000)

  return () => clearInterval(interval)
}, [])

  useEffect(() => {
    if (locationStatus === 'granted' || locationStatus === 'denied') {
      loadStations(activeLocation)
    }
  }, [activeTab, activeLocation, locationStatus])

  function getUserLocation() {
    setLocationStatus('asking')
    if (!navigator.geolocation) {
      setLocationStatus('denied')
      return
    }
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
        setMapTarget([46.0569, 14.5058])
        setMapZoom(10)
      }
    )
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setLoading(true)
    const result = await geocodeCity(searchQuery)
    if (result) {
      const loc = { lat: result.lat, lng: result.lng }
      setSearchLocation(loc)
      setActiveLocation(loc)
      setMapTarget([loc.lat, loc.lng])
      setMapZoom(12)
    } else {
      alert('City not found. Try again!')
      setLoading(false)
    }
  }

  async function loadStations(location) {
    setLoading(true)
    setSelected(null)
    const lat = location?.lat || null
    const lng = location?.lng || null
    const real = await fetchStations(activeTab, lat, lng)
    if (real.length > 0) {
      setStations(real)
      setDataSource('live')
    } else {
      setStations(FALLBACK_STATIONS)
      setDataSource('demo')
    }
    setLoading(false)
  }

  const sorted = [...stations].sort((a, b) => {
    if (sortBy === 'distance') return (a.distance || 999) - (b.distance || 999)
    return a.price - b.price
  })

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo">GAS<span>IFY</span></div>
          <span style={{ fontSize: 11, color: '#555' }}>
            {loading ? 'Loading...' : `${stations.length} stations`}
          </span>
        </div>

        {/* Search bar */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid #222',
          display: 'flex',
          gap: 8
        }}>
          <input
            type="text"
            placeholder="Search city... (e.g. Koper)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{
              flex: 1,
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#f0f0f0',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              background: '#e8ff47',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >Go</button>
        </div>

        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid #222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: dataSource === 'live' ? '#22c55e' : '#f59e0b',
              boxShadow: dataSource === 'live' ? '0 0 6px #22c55e' : 'none'
            }} />
            <span style={{ fontSize: 11, color: '#555' }}>
              {dataSource === 'live' ? '🇫🇷🇸🇮 Live data' : 'Demo data'}
            </span>
          </div>
          <button
            onClick={() => {
              setSearchQuery('')
              setSearchLocation(null)
              setActiveLocation(userLocation)
              setMapTarget(userLocation ? [userLocation.lat, userLocation.lng] : [46.0569, 14.5058])
              setMapZoom(12)
            }}
            style={{
              background: locationStatus === 'granted' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
              border: '1px solid',
              borderColor: locationStatus === 'granted' ? 'rgba(59,130,246,0.4)' : '#333',
              color: locationStatus === 'granted' ? '#3b82f6' : '#888',
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {locationStatus === 'granted' ? '📍 Near me' : '📍 Use my location'}
          </button>
        </div>

        <div className="fuel-tabs">
          {FUEL_TABS.map(tab => (
            <button
              key={tab.value}
              className={`tab ${activeTab === tab.value ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.value)}
            >{tab.label}</button>
          ))}
        </div>

        <div style={{
          display: 'flex',
          gap: 8,
          padding: '8px 16px',
          borderBottom: '1px solid #222'
        }}>
          {['distance', 'price'].map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              style={{
                flex: 1,
                padding: '5px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: sortBy === s ? '#e8ff47' : '#333',
                background: sortBy === s ? 'rgba(232,255,71,0.08)' : 'transparent',
                color: sortBy === s ? '#e8ff47' : '#666',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >{s === 'distance' ? '📍 Nearest first' : '💰 Cheapest first'}</button>
          ))}
        </div>

        <div className="stations-list">
          {loading ? (
            <div style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
              Fetching stations...
            </div>
          ) : sorted.map((station, i) => (
            <div
              key={station.id}
              className={`station-card ${selected?.id === station.id ? 'selected' : ''}`}
              onClick={() => {
                setSelected(station)
                setMapTarget([station.lat, station.lng])
                setMapZoom(15)
              }}
            >
              <div className="rank">#{i + 1}</div>
              <div className="station-info">
                <div className="station-name">{station.name}</div>
                <div className="station-brand">
                  {station.flag && <span>{station.flag} </span>}
                  {station.city}
                  {station.distance ? ` · ${station.distance.toFixed(1)} km` : ''}
                </div>
              </div>
              <div>
                <div className="station-price" style={{ color: getPriceColor(station.price) }}>
                  €{station.price.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: '#666', textAlign: 'right' }}>/litre</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="map-wrap">
        <MapContainer
          center={[46.0569, 14.5058]}
          zoom={10}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FlyTo target={mapTarget} zoom={mapZoom} />
          {userLocation && (
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={createUserIcon()}
            >
              <Popup>
                <div style={{ fontFamily: 'sans-serif' }}>
                  <strong>📍 Your location</strong>
                </div>
              </Popup>
            </Marker>
          )}
          {stations.map(station => (
            <Marker
              key={station.id}
              position={[station.lat, station.lng]}
              icon={createPriceIcon(station.price, selected?.id === station.id)}
              eventHandlers={{ click: () => {
                setSelected(station)
                setMapTarget([station.lat, station.lng])
                setMapZoom(15)
              }}}
            >
              <Popup>
                <div style={{ fontFamily: 'sans-serif', minWidth: 160 }}>
                  <strong style={{ fontSize: 14 }}>{station.name}</strong><br />
                  <span style={{ color: '#888', fontSize: 12 }}>
                    {station.flag} {station.city}
                  </span>
                  {station.distance && <span style={{ color: '#888', fontSize: 12 }}> · {station.distance.toFixed(1)} km away</span>}
                  <br /><br />
                  {station.gazole && <div>⛽ Diesel: <strong style={{ color: getPriceColor(station.gazole) }}>€{station.gazole.toFixed(2)}</strong></div>}
                  {station.sp95 && <div>⛽ SP95: <strong>€{station.sp95.toFixed(2)}</strong></div>}
                  {station.sp98 && <div>⛽ SP98: <strong>€{station.sp98.toFixed(2)}</strong></div>}
                  {station.e10 && <div>⛽ E10: <strong>€{station.e10.toFixed(2)}</strong></div>}
                  {station.gplc && <div>⛽ LPG: <strong>€{station.gplc.toFixed(2)}</strong></div>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
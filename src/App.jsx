import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import './App.css'

const FALLBACK_STATIONS = [
  { id: 1, name: 'OMV Ljubljana Center', brand: 'OMV', price: 1.49, fuel: 'gazole', lng: 14.5058, lat: 46.0569, city: 'Ljubljana' },
  { id: 2, name: 'Petrol Tivoli', brand: 'Petrol', price: 1.44, fuel: 'gazole', lng: 14.4986, lat: 46.0614, city: 'Ljubljana' },
  { id: 3, name: 'Shell Šiška', brand: 'Shell', price: 1.52, fuel: 'gazole', lng: 14.4879, lat: 46.0721, city: 'Ljubljana' },
  { id: 4, name: 'MOL Bežigrad', brand: 'MOL', price: 1.47, fuel: 'gazole', lng: 14.5123, lat: 46.0678, city: 'Ljubljana' },
  { id: 5, name: 'Petrol Vič', brand: 'Petrol', price: 1.43, fuel: 'gazole', lng: 14.4801, lat: 46.0489, city: 'Ljubljana' },
]

const FUEL_TABS = [
  { label: 'Diesel', value: 'gazole' },
  { label: '95', value: 'sp95' },
  { label: '98', value: 'sp98' },
  { label: 'LPG', value: 'gplc' },
  { label: 'E10', value: 'e10' },
]

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

function FlyTo({ station }) {
  const map = useMap()
  if (station) map.flyTo([station.lat, station.lng], 15, { duration: 1 })
  return null
}

async function fetchStations(fuel) {
  try {
    const res = await fetch(`http://localhost:3001/api/stations?fuel=${fuel}`)
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
  const [mapCenter] = useState([46.6034, 1.8883])
  const [mapZoom] = useState(6)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setSelected(null)
      const real = await fetchStations(activeTab)
      if (real.length > 0) {
        setStations(real)
        setDataSource('live')
      } else {
        setStations(FALLBACK_STATIONS)
        setDataSource('demo')
      }
      setLoading(false)
    }
    loadData()
  }, [activeTab])

  const sorted = [...stations].sort((a, b) => a.price - b.price)

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo">GAS<span>IFY</span></div>
          <span style={{ fontSize: 11, color: '#555' }}>
            {loading ? 'Loading...' : `${stations.length} stations`}
          </span>
        </div>

        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid #222',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: dataSource === 'live' ? '#22c55e' : '#f59e0b',
            boxShadow: dataSource === 'live' ? '0 0 6px #22c55e' : 'none'
          }} />
          <span style={{ fontSize: 11, color: '#555' }}>
            {dataSource === 'live' ? '🇫🇷 Live data — France' : 'Demo data'}
          </span>
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

        <div className="stations-list">
          {loading ? (
            <div style={{ color: '#555', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
              Fetching real prices...
            </div>
          ) : sorted.map((station, i) => (
            <div
              key={station.id}
              className={`station-card ${selected?.id === station.id ? 'selected' : ''}`}
              onClick={() => setSelected(station)}
            >
              <div className="rank">#{i + 1}</div>
              <div className="station-info">
                <div className="station-name">{station.name}</div>
                <div className="station-brand">
                  {station.city}
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
          center={mapCenter}
          zoom={mapZoom}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FlyTo station={selected} />
          {stations.map(station => (
            <Marker
              key={station.id}
              position={[station.lat, station.lng]}
              icon={createPriceIcon(station.price, selected?.id === station.id)}
              eventHandlers={{ click: () => setSelected(station) }}
            >
              <Popup>
                <div style={{ fontFamily: 'sans-serif', minWidth: 160 }}>
                  <strong style={{ fontSize: 14 }}>{station.name}</strong><br />
                  <span style={{ color: '#888', fontSize: 12 }}>{station.city}</span><br /><br />
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
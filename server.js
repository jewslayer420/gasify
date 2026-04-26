import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'

const app = express()
app.use(cors())

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function fetchFranceStations(fuel) {
  try {
    const priceField = fuel + '_prix'
    const url = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?limit=100&timezone=Europe%2FParis`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    })
    const raw = await res.json()
    if (!raw || !Array.isArray(raw.results)) return []
    return raw.results
      .filter(s => s[priceField] != null && s.geom != null)
      .map((s, i) => ({
        id: 'fr_' + i,
        name: s.adresse || 'Station ' + i,
        brand: s.ensigne_id || 'Station',
        price: parseFloat(s[priceField]),
        fuel: fuel,
        lat: s.geom.lat,
        lng: s.geom.lon,
        city: s.ville || '',
        country: 'France',
        flag: '🇫🇷',
        sp95: s.sp95_prix || null,
        sp98: s.sp98_prix || null,
        gazole: s.gazole_prix || null,
        gplc: s.gplc_prix || null,
        e10: s.e10_prix || null,
      }))
  } catch (e) {
    console.log('France API error:', e.message)
    return []
  }
}

async function fetchSloveniaStations(fuel, lat, lng) {
  try {
    const fuelMap = {
      'gazole': 'dizel',
      'sp95': '95',
      'sp98': '98',
      'gplc': 'avtoplin-lpg',
      'e10': '95'
    }
    const sloveneFuel = fuelMap[fuel] || 'dizel'
    const searchLat = lat || 46.1512
    const searchLng = lng || 14.9955
    const radius = 200

    let allResults = []
    let nextUrl = `https://goriva.si/api/v1/search/?format=json&lat=${searchLat}&lng=${searchLng}&radius=${radius}`

    while (nextUrl) {
      const res = await fetch(nextUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      })
      const raw = await res.json()
      if (!raw || !Array.isArray(raw.results)) break
      allResults = [...allResults, ...raw.results]
      nextUrl = raw.next || null
      console.log(`Fetched ${allResults.length} / ${raw.count} Slovenian stations`)
    }

    return allResults
      .filter(s => s.prices && s.prices[sloveneFuel] != null && s.lat && s.lng)
      .map((s) => ({
        id: 'si_' + s.pk,
        name: s.name || s.address,
        brand: s.name?.split(' ')[0] || 'Station',
        price: parseFloat(s.prices[sloveneFuel]),
        fuel: fuel,
        lat: parseFloat(s.lat),
        lng: parseFloat(s.lng),
        city: s.zip_code || '',
        address: s.address || '',
        country: 'Slovenia',
        flag: '🇸🇮',
        gazole: s.prices?.dizel || null,
        sp95: s.prices?.['95'] || null,
        sp98: s.prices?.['98'] || null,
        gplc: s.prices?.['avtoplin-lpg'] || null,
        e10: s.prices?.['95'] || null,
        openHours: s.open_hours || '',
      }))
  } catch (e) {
    console.log('Slovenia API error:', e.message)
    return []
  }
}

app.get('/api/stations', async (req, res) => {
  try {
    const fuel = req.query.fuel || 'gazole'
    const userLat = parseFloat(req.query.lat) || null
    const userLng = parseFloat(req.query.lng) || null

    const [franceStations, sloveniaStations] = await Promise.all([
      fetchFranceStations(fuel),
      fetchSloveniaStations(fuel, userLat, userLng)
    ])

    console.log(`FR: ${franceStations.length}, SI: ${sloveniaStations.length}`)

    let stations = [...sloveniaStations, ...franceStations]

    if (userLat && userLng) {
      stations = stations
        .map(s => ({
          ...s,
          distance: getDistance(userLat, userLng, s.lat, s.lng)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 50)
    } else {
      stations = stations
        .sort((a, b) => a.price - b.price)
        .slice(0, 100)
    }

    res.json(stations)
  } catch (e) {
    console.log('Error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.listen(3001, () => console.log('Gasify API running on http://localhost:3001'))
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

app.get('/api/stations', async (req, res) => {
  try {
    const fuel = req.query.fuel || 'gazole'
    const userLat = parseFloat(req.query.lat) || null
    const userLng = parseFloat(req.query.lng) || null
    const priceField = fuel + '_prix'

    const url = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?limit=100&timezone=Europe%2FParis`

    const res2 = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    })

    const raw = await res2.json()

    console.log('Raw keys:', Object.keys(raw || {}))
    console.log('Results count:', raw?.results?.length)

    if (!raw || !Array.isArray(raw.results)) {
      console.log('No results found')
      return res.json([])
    }

    let stations = raw.results
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
        address: s.adresse || '',
        sp95: s.sp95_prix || null,
        sp98: s.sp98_prix || null,
        gazole: s.gazole_prix || null,
        gplc: s.gplc_prix || null,
        e10: s.e10_prix || null,
      }))

    if (userLat && userLng) {
      stations = stations
        .map(s => ({
          ...s,
          distance: getDistance(userLat, userLng, s.lat, s.lng)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 20)
    } else {
      stations = stations
        .sort((a, b) => a.price - b.price)
        .slice(0, 50)
    }

    console.log(`Returning ${stations.length} stations for fuel: ${fuel}`)
    res.json(stations)
  } catch (e) {
    console.log('Error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.listen(3001, () => console.log('Gasify API running on http://localhost:3001'))
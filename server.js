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

    const url = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?limit=200'
    const response = await fetch(url)
    const data = await response.json()

    let stations = data.results
      .filter(s => s[priceField] && s.geom)
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

    console.log(`Returning ${stations.length} stations for fuel: ${fuel}, location: ${userLat},${userLng}`)
    res.json(stations)
  } catch (e) {
    console.log('Error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.listen(3001, () => console.log('Gasify API running on http://localhost:3001'))
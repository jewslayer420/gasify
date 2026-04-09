import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'

const app = express()
app.use(cors())

app.get('/api/stations', async (req, res) => {
  try {
    const fuel = req.query.fuel || 'gazole'
    const priceField = fuel + '_prix'
    const url = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?limit=50'
    const response = await fetch(url)
    const data = await response.json()

    const stations = data.results
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
      .sort((a, b) => a.price - b.price)

    console.log(`Returning ${stations.length} stations for fuel: ${fuel}`)
    res.json(stations)
  } catch (e) {
    console.log('Error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.listen(3001, () => console.log('Gasify API running on http://localhost:3001'))
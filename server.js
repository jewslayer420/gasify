import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'

const app = express()
app.use(cors())

// Approximate country bounding boxes for deciding which APIs to call
const COUNTRY_BBOX = {
  FR: { minLat: 41.3, maxLat: 51.1, minLng: -5.1, maxLng: 9.7 },
  SI: { minLat: 45.4, maxLat: 46.9, minLng: 13.4, maxLng: 16.6 },
}

function overlaps(a, b) {
  return a.maxLat >= b.minLat && a.minLat <= b.maxLat &&
         a.maxLng >= b.minLng && a.minLng <= b.maxLng
}

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function fetchFranceStations(fuel, bbox = null) {
  try {
    const priceField = fuel + '_prix'
    let where = `${priceField} IS NOT NULL AND geom IS NOT NULL`

    // Use the ODS spatial filter when a region bbox is provided — avoids fetching all of France
    if (bbox) {
      where += ` AND within_bbox(geom, ${bbox.minLat}, ${bbox.minLng}, ${bbox.maxLat}, ${bbox.maxLng})`
    }

    const limit = bbox ? 200 : 100
    const url = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?where=${encodeURIComponent(where)}&limit=${limit}&timezone=Europe%2FParis`

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
        fuel,
        lat: s.geom.lat,
        lng: s.geom.lon,
        city: s.ville || '',
        country: 'France',
        sp95:   s.sp95_prix   || null,
        sp98:   s.sp98_prix   || null,
        gazole: s.gazole_prix || null,
        gplc:   s.gplc_prix   || null,
        e10:    s.e10_prix    || null,
      }))
  } catch (e) {
    console.log('France API error:', e.message)
    return []
  }
}

async function fetchSloveniaStations(fuel, bbox = null) {
  try {
    const fuelMap = {
      gazole: 'dizel',
      sp95:   '95',
      sp98:   '98',
      gplc:   'avtoplin-lpg',
      e10:    '95',
    }
    const sloveneFuel = fuelMap[fuel] || 'dizel'

    // Always search from the center of Slovenia with a radius that covers the whole country.
    // bbox filtering happens on the results afterward.
    const searchLat = 46.1512
    const searchLng = 14.9955
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
      console.log(`SI: fetched ${allResults.length} / ${raw.count}`)
    }

    return allResults
      .filter(s => s.prices?.[sloveneFuel] != null && s.lat && s.lng)
      .map(s => ({
        id: 'si_' + s.pk,
        name: s.name ? s.name.replace(/^(PETROL|OMV|MOL|SHELL|BP)\s+/i, '$1 ').trim() : s.address,
        brand: s.name?.split(' ')[0] || 'Station',
        price: parseFloat(s.prices[sloveneFuel]),
        fuel,
        lat: parseFloat(s.lat),
        lng: parseFloat(s.lng),
        city: s.zip_code || '',
        address: s.address || '',
        country: 'Slovenia',
        gazole: s.prices?.dizel          || null,
        sp95:   s.prices?.['95']         || null,
        sp98:   s.prices?.['98']         || null,
        gplc:   s.prices?.['avtoplin-lpg'] || null,
        e10:    s.prices?.['95']         || null,
      }))
  } catch (e) {
    console.log('Slovenia API error:', e.message)
    return []
  }
}

app.get('/api/stations', async (req, res) => {
  try {
    const fuel     = req.query.fuel || 'gazole'
    const userLat  = parseFloat(req.query.lat) || null
    const userLng  = parseFloat(req.query.lng) || null
    const bboxRaw  = req.query.bbox // "minLat,minLng,maxLat,maxLng"

    // Parse bbox
    let bbox = null
    if (bboxRaw) {
      const parts = bboxRaw.split(',').map(Number)
      if (parts.length === 4 && parts.every(n => !isNaN(n))) {
        const [minLat, minLng, maxLat, maxLng] = parts
        bbox = { minLat, minLng, maxLat, maxLng }
      }
    }

    // Only call APIs for countries that overlap with the requested bbox
    const needFR = !bbox || overlaps(bbox, COUNTRY_BBOX.FR)
    const needSI = !bbox || overlaps(bbox, COUNTRY_BBOX.SI)

    console.log(`fuel=${fuel} bbox=${bboxRaw || 'none'} → FR:${needFR} SI:${needSI}`)

    const [frStations, siStations] = await Promise.all([
      needFR ? fetchFranceStations(fuel, bbox) : [],
      needSI ? fetchSloveniaStations(fuel, bbox) : [],
    ])

    console.log(`FR: ${frStations.length}, SI: ${siStations.length}`)

    let stations = [...siStations, ...frStations]

    // Attach distances when user location is known
    if (userLat && userLng) {
      stations = stations.map(s => ({
        ...s,
        distance: getDistance(userLat, userLng, s.lat, s.lng),
      }))
    }

    if (bbox) {
      // Regional mode: filter to bbox, return all (no hard cap)
      stations = stations.filter(s =>
        s.lat >= bbox.minLat && s.lat <= bbox.maxLat &&
        s.lng >= bbox.minLng && s.lng <= bbox.maxLng
      )
      stations.sort((a, b) =>
        a.distance != null ? a.distance - b.distance : a.price - b.price
      )
    } else if (userLat && userLng) {
      // Near-me mode: 50 closest
      stations = stations.sort((a, b) => a.distance - b.distance).slice(0, 50)
    } else {
      // Default: 100 cheapest
      stations = stations.sort((a, b) => a.price - b.price).slice(0, 100)
    }

    res.json(stations)
  } catch (e) {
    console.log('Error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.listen(3001, () => console.log('Gasify API running on http://localhost:3001'))

import { useState, useEffect } from 'react'
import axios from 'axios'
import MapComponent from './components/Map'
import './App.css'

function App() {
  const [zones, setZones] = useState([
    { id: 'Zone A', lat: 45.0, lon: -0.5, status: 'Active' },
    { id: 'Zone B', lat: 45.02, lon: -0.48, status: 'Active' },
  ])
  const [selectedZone, setSelectedZone] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleZoneSelect = async (zone) => {
    setSelectedZone(zone)
    setLoading(true)
    setRecommendation(null)

    // Call Reco API (Gateway routed)
    try {
      // Mock Context
      const payload = {
        zone_id: zone.id,
        lat: zone.lat,
        lon: zone.lon,
        temperature: 28.5, // Mock live data
        soil_moisture: 35.0, // Mock live data
        crop_type: "Corn"
      }

      const res = await axios.post('/api/reco/recommendation', payload)
      setRecommendation(res.data)
    } catch (error) {
      console.error("API Error", error)
      setRecommendation({ recommendation: "Error fetching data", amount_mm: 0, details: "Check console" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1>AgroTrace Dashboard</h1>
        <p>Intelligent Coverage & Irrigation</p>
      </header>

      <div className="main-content">
        <div className="map-panel">
          <MapComponent zones={zones} onZoneSelect={handleZoneSelect} />
        </div>

        <div className="info-panel">
          <h2>Zone Details</h2>
          {selectedZone ? (
            <div>
              <p><strong>ID:</strong> {selectedZone.id}</p>
              <p>Location: {selectedZone.lat}, {selectedZone.lon}</p>
              <hr />
              {loading ? <p>Analyzing...</p> : (
                recommendation && (
                  <div className="recommendation-card">
                    <h3>Result</h3>
                    <p className="action">{recommendation.recommendation}</p>
                    <p className="amount">Amount: {recommendation.amount_mm} mm</p>
                    <p className="details"><small>{recommendation.details}</small></p>
                  </div>
                )
              )}
            </div>
          ) : (
            <p>Select a zone on the map to see details.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default App

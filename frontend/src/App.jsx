import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import WaterPrediction from './pages/WaterPrediction';
import IrrigationReco from './pages/IrrigationReco';
import SensorIngestion from './pages/SensorIngestion';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="water-prediction" element={<WaterPrediction />} />
          <Route path="irrigation-reco" element={<IrrigationReco />} />
          <Route path="sensors" element={<SensorIngestion />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

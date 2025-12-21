import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};
import Dashboard from './pages/Dashboard';
import VisionMap from './pages/VisionMap';
import WaterPrediction from './pages/WaterPrediction';
import IrrigationReco from './pages/IrrigationReco';
import SensorIngestion from './pages/SensorIngestion';
import Login from './pages/Login';
import Register from './pages/Register';
import Databases from './pages/Databases';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="vision-map" element={<VisionMap />} />
          <Route path="water-prediction" element={<WaterPrediction />} />
          <Route path="irrigation-reco" element={<IrrigationReco />} />
          <Route path="sensors" element={<SensorIngestion />} />
          <Route path="databases" element={<Databases />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

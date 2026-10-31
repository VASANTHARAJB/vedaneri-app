import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import AdminLayout from './layouts/AdminLayout';
import DashboardOverview from './pages/DashboardOverview';
import ContentStats from './pages/ContentStats';
import SevasManagement from './pages/SevasManagement';
import DevoteeDirectory from './pages/DevoteeDirectory';
import SankalpamRoster from './pages/SankalpamRoster';
import Login from './pages/Login';
import PanchangamManager from './pages/PanchangamManager';
import DonationsManagement from './pages/DonationsManagement';
import CampsManagement from './pages/CampsManagement';
import MagazineManagement from './pages/MagazineManagement';
import DiscoverAudio from './pages/DiscoverAudio';
import DiscoverVideo from './pages/DiscoverVideo';
import DiscoverAlbum from './pages/DiscoverAlbum';
import AboutOmkarananda from './pages/AboutOmkarananda';
import AboutAshramam from './pages/AboutAshramam';

// Shown until the editor for that page is built
const Soon = ({ name }: { name: string }) => (
  <div style={{ padding: 24 }}>
    <h1 style={{ fontSize: 20, fontWeight: 800 }}>{name}</h1>
    <p style={{ marginTop: 8, color: '#6b7280' }}>The editor for this page is coming next.</p>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* All protected routes inside AdminLayout shell */}
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardOverview />} />
            <Route path="content-stats" element={<ContentStats />} />
            <Route path="sevas" element={<SevasManagement />} />
            <Route path="panchangam" element={<PanchangamManager />} />
            <Route path="devotees" element={<DevoteeDirectory />} />
            <Route path="donations" element={<DonationsManagement />} />
            <Route path="camps" element={<CampsManagement />} />
            <Route path="magazine" element={<MagazineManagement />} />
            <Route path="seva-orders" element={<SankalpamRoster />} />
            <Route path="discover-audio" element={<DiscoverAudio />} />
            <Route path="discover-video" element={<DiscoverVideo />} />
            <Route path="discover-album" element={<DiscoverAlbum />} />
            <Route path="about-swami" element={<AboutOmkarananda />} />
            <Route path="about-ashramam" element={<AboutAshramam />} />
            <Route path="about-adhishtanam" element={<Soon name="Adhishtanam" />} />
            <Route path="about-vidyapitham" element={<Soon name="Vidyapitham" />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
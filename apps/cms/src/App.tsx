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
            <Route path="seva-orders" element={<SankalpamRoster />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
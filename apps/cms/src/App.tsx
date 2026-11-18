import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import AdminLayout from './layouts/AdminLayout';
import DashboardOverview from './pages/DashboardOverview';
import ContentStats from './pages/ContentStats';
import SevasManagement from './pages/SevasManagement';
import SankalpamRoster from './pages/SankalpamRoster';
import Login from './pages/Login';
import PanchangamManager from './pages/PanchangamManager';
import PanchangamCalendar from './pages/PanchangamCalendar';
import DonationsManagement from './pages/DonationsManagement';
import CampsManagement from './pages/CampsManagement';
import MagazineManagement from './pages/MagazineManagement';
import DiscoverAudio from './pages/DiscoverAudio';
import DiscoverVideo from './pages/DiscoverVideo';
import DiscoverAlbum from './pages/DiscoverAlbum';
import AboutOmkarananda from './pages/AboutOmkarananda';
import AboutAshramam from './pages/AboutAshramam';
import AboutAdhishtanam from './pages/AboutAdhishtanam';
import AboutVidyapitham from './pages/AboutVidyapitham';
import ContactManagement from './pages/ContactManagement';
import AccommodationManagement from './pages/AccommodationManagement';
import HomeManagement from './pages/HomeManagement';
import PaymentsDashboard from './pages/PaymentsDashboard';
import SevaPayments from './pages/SevaPayments';
import DonationPayments from './pages/DonationPayments';
import MagazinePayments from './pages/MagazinePayments';
import CampPayments from './pages/CampPayments';
import DevoteeDetails from './pages/DevoteeDetails';
import DevoteeRecords from './pages/DevoteeRecords';
import SevaRegister from './pages/SevaRegister';
import SevaOffline from './pages/SevaOffline';
import DonationRegister from './pages/DonationRegister';
import DonationOffline from './pages/DonationOffline';
import MagazineRegister from './pages/MagazineRegister';
import MagazineOffline from './pages/MagazineOffline';
import CampRegister from './pages/CampRegister';
import CampOffline from './pages/CampOffline';
import PrintingLabels from './pages/PrintingLabels';
import PosDashboard from './pages/PosDashboard';
import PosNewSale from './pages/PosNewSale';
import PosSales from './pages/PosSales';
import PosItems from './pages/PosItems';
import PosStock from './pages/PosStock';
import PosPurchases from './pages/PosPurchases';
import PosSuppliers from './pages/PosSuppliers';
import PosAdjustments from './pages/PosAdjustments';
import PosReports from './pages/PosReports';
import UsersManagement from './pages/UsersManagement';
import GmDashboard from './pages/GmDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DeveloperDashboard from './pages/DeveloperDashboard';

// Shown to a login that has no page ticked yet
const NoAccess = () => (
  <div style={{ padding: 24, maxWidth: 520 }}>
    <h1 style={{ fontSize: 20, fontWeight: 800 }}>No pages are open for this login yet</h1>
    <p style={{ marginTop: 8, color: '#6b7280' }}>A super admin has to tick the pages this login may open on the Users page. Please ask them, then sign in again.</p>
  </div>
);

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
            <Route path="dashboard-gm" element={<GmDashboard />} />
            <Route path="dashboard-admin" element={<AdminDashboard />} />
            <Route path="dashboard-developer" element={<DeveloperDashboard />} />
            <Route path="no-access" element={<NoAccess />} />
            <Route path="content-stats" element={<ContentStats />} />
            <Route path="sevas" element={<SevasManagement />} />
            <Route path="panchangam-calendar" element={<PanchangamCalendar />} />
            <Route path="panchangam" element={<PanchangamManager />} />
            <Route path="donations" element={<DonationsManagement />} />
            <Route path="camps" element={<CampsManagement />} />
            <Route path="magazine" element={<MagazineManagement />} />
            <Route path="discover-audio" element={<DiscoverAudio />} />
            <Route path="discover-video" element={<DiscoverVideo />} />
            <Route path="discover-album" element={<DiscoverAlbum />} />
            <Route path="about-swami" element={<AboutOmkarananda />} />
            <Route path="about-ashramam" element={<AboutAshramam />} />
            <Route path="about-adhishtanam" element={<AboutAdhishtanam />} />
            <Route path="about-vidyapitham" element={<AboutVidyapitham />} />
            <Route path="page-contact" element={<ContactManagement />} />
            <Route path="page-accommodation" element={<AccommodationManagement />} />
            <Route path="page-home" element={<HomeManagement />} />
            <Route path="payments-dashboard" element={<PaymentsDashboard />} />
            <Route path="seva-payments" element={<SevaPayments />} />
            <Route path="payment-donations" element={<DonationPayments />} />
            <Route path="payment-magazine" element={<MagazinePayments />} />
            <Route path="payment-camps" element={<CampPayments />} />
            <Route path="devotees" element={<DevoteeDetails />} />
            <Route path="devotee-records" element={<DevoteeRecords />} />
            <Route path="seva-register" element={<SevaRegister />} />
            <Route path="donation-register" element={<DonationRegister />} />
            <Route path="magazine-register" element={<MagazineRegister />} />
            <Route path="camp-register" element={<CampRegister />} />
            <Route path="seva-offline" element={<SevaOffline />} />
            <Route path="donation-offline" element={<DonationOffline />} />
            <Route path="magazine-offline" element={<MagazineOffline />} />
            <Route path="camp-offline" element={<CampOffline />} />
            <Route path="pos" element={<PosDashboard />} />
            <Route path="pos-new-sale" element={<PosNewSale />} />
            <Route path="pos-sales" element={<PosSales />} />
            <Route path="pos-items" element={<PosItems />} />
            <Route path="pos-stock" element={<PosStock />} />
            <Route path="pos-purchases" element={<PosPurchases />} />
            <Route path="pos-suppliers" element={<PosSuppliers />} />
            <Route path="pos-adjustments" element={<PosAdjustments />} />
            <Route path="pos-reports" element={<PosReports />} />
            <Route path="printing-labels" element={<PrintingLabels />} />
            <Route path="users" element={<UsersManagement />} />
            <Route path="settings" element={<Soon name="Settings" />} />
            <Route path="*" element={<Soon name="Page Not Found" />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Maintenance from './pages/Maintenance';
import Tenants from './pages/Tenants';
import Financials from './pages/Financials';
import Leasing from './pages/Leasing';
import Properties from './pages/Properties';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="tenants" element={<Tenants />} />
        <Route path="financials" element={<Financials />} />
        <Route path="leasing" element={<Leasing />} />
        <Route path="properties" element={<Properties />} />
      </Route>
    </Routes>
  );
}

import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  return (
    <div className="min-h-screen bg-dark-bg">
      <Sidebar />
      <Header />
      <main className="ml-60 mt-14 p-6">
        <Outlet />
      </main>
    </div>
  );
}

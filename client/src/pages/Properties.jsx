import { usePolling, formatCurrency } from '../hooks/usePolling';
import api from '../api';

export default function Properties() {
  const { data } = usePolling(api.getProperties, 30000);
  const properties = data?.properties || [];

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        Portfolio — {properties.length} Properties
      </h2>

      <div className="grid grid-cols-3 gap-6">
        {properties.map(p => (
          <PropertyCard key={p.id} property={p} />
        ))}
      </div>
    </div>
  );
}

function PropertyCard({ property: p }) {
  const occupancy = p.total_units > 0 ? Math.round(((p.occupied_units + (p.notice_units || 0)) / p.total_units) * 100) : 0;
  const isFullyOccupied = occupancy === 100;
  const borderColor = isFullyOccupied ? 'border-emerald-500/30' : 'border-amber-500/30';
  const monthlyRent = p.monthly_rent || 0;

  return (
    <div className={`card border ${borderColor} transition-colors`}>
      <h3 className="text-sm font-semibold text-gray-200">{p.address}</h3>
      <p className="text-xs text-gray-500 mt-0.5">{p.city}, {p.state} {p.zip}</p>

      <div className="grid grid-cols-3 gap-4 mt-5">
        <div className="text-center">
          <p className="font-mono text-xl font-bold text-gray-200">{p.total_units}</p>
          <p className="text-[10px] text-gray-500 uppercase mt-1">Units</p>
        </div>
        <div className="text-center">
          <p className={`font-mono text-xl font-bold ${isFullyOccupied ? 'text-emerald-400' : 'text-amber-400'}`}>{occupancy}%</p>
          <p className="text-[10px] text-gray-500 uppercase mt-1">Occupancy</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-xl font-bold text-gray-200">{formatCurrency(monthlyRent)}</p>
          <p className="text-[10px] text-gray-500 uppercase mt-1">Monthly Rent</p>
        </div>
      </div>
    </div>
  );
}

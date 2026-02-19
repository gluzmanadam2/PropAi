import { usePolling, formatCurrency } from '../hooks/usePolling';
import api from '../api';

export default function Leasing() {
  const { data: properties } = usePolling(api.getProperties, 30000);

  const vacantProperties = properties?.properties?.filter(p => p.vacant_units > 0) || [];
  const totalVacant = vacantProperties.reduce((s, p) => s + p.vacant_units, 0);

  if (totalVacant === 0) {
    return (
      <div className="card text-center py-16">
        <p className="text-emerald-400 text-lg font-semibold">All units occupied</p>
        <p className="text-gray-500 text-sm mt-2">No vacant units across the portfolio</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        Vacant Units ({totalVacant})
      </h2>

      <div className="card p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-border text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left p-4">Unit</th>
              <th className="text-left p-4">Property</th>
              <th className="text-left p-4">Beds / Baths</th>
              <th className="text-left p-4">Sq Ft</th>
              <th className="text-left p-4">Asking Rent</th>
              <th className="text-left p-4">Days on Market</th>
            </tr>
          </thead>
          <tbody>
            {vacantProperties.flatMap(prop =>
              (prop.vacant_unit_details || []).map(unit => (
                <tr key={unit.id} className="border-b border-dark-border hover:bg-dark-hover transition-colors">
                  <td className="p-4 text-sm text-gray-300">#{unit.unit_number}</td>
                  <td className="p-4 text-sm text-gray-400">{prop.address}</td>
                  <td className="p-4 text-sm text-gray-400">{unit.bedrooms}bd / {unit.bathrooms}ba</td>
                  <td className="p-4 text-sm text-gray-400">{unit.sqft || '—'}</td>
                  <td className="p-4 text-sm font-mono text-emerald-400">{formatCurrency(unit.market_rent)}</td>
                  <td className="p-4 text-sm text-gray-500">—</td>
                </tr>
              ))
            )}
            {/* Fallback for properties without detailed unit info */}
            {vacantProperties.filter(p => !p.vacant_unit_details?.length).map(prop => (
              <tr key={prop.id} className="border-b border-dark-border">
                <td className="p-4 text-sm text-gray-400" colSpan={2}>{prop.address}</td>
                <td className="p-4 text-sm text-amber-400" colSpan={4}>{prop.vacant_units} vacant unit{prop.vacant_units > 1 ? 's' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

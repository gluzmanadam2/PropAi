import { useState, useCallback } from 'react';
import { usePolling, formatCurrency, formatDate, timeAgo } from '../hooks/usePolling';
import api from '../api';

export default function Tenants() {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);

  const { data: tenantsData } = usePolling(api.getTenants, 30000);
  const { data: ledger } = usePolling(api.getCurrentLedger, 30000);

  const tenants = tenantsData?.tenants || [];
  const ledgerMap = {};
  if (ledger?.entries) {
    for (const e of ledger.entries) ledgerMap[e.tenant_id] = e;
  }

  const filtered = tenants.filter(t => {
    const q = search.toLowerCase();
    return !q || `${t.first_name} ${t.last_name}`.toLowerCase().includes(q)
      || t.unit_number.toLowerCase().includes(q)
      || t.property_address.toLowerCase().includes(q);
  });

  // Group by property
  const grouped = {};
  for (const t of filtered) {
    const key = t.property_address;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }
  const propertyGroups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  async function handleExpand(tenant) {
    if (expanded === tenant.id) { setExpanded(null); setDetail(null); return; }
    setExpanded(tenant.id);
    setDetail(await api.getTenant(tenant.id));
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="card">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search tenants..."
            className="flex-1 bg-transparent text-gray-300 text-sm outline-none placeholder-gray-600" />
          <span className="text-xs text-gray-500">{filtered.length} tenants</span>
        </div>
      </div>

      {/* Tenant List */}
      <div className="card p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-border text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Unit</th>
              <th className="text-left p-4">Rent</th>
              <th className="text-left p-4">Payment Status</th>
            </tr>
          </thead>
          <tbody>
            {propertyGroups.map(([address, groupTenants]) => (
              <PropertyGroup key={address} address={address} tenants={groupTenants}
                ledgerMap={ledgerMap} expanded={expanded} detail={detail} onExpand={handleExpand} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-8 text-sm">No tenants found</div>
        )}
      </div>
    </div>
  );
}

const PAY_COLORS = {
  paid: 'bg-emerald-500/20 text-emerald-400',
  late: 'bg-red-500/20 text-red-400',
  unpaid: 'bg-red-500/20 text-red-400',
  partial: 'bg-amber-500/20 text-amber-400',
  no_data: 'bg-gray-500/20 text-gray-500',
};

function PropertyGroup({ address, tenants, ledgerMap, expanded, detail, onExpand }) {
  return (
    <>
      <tr className="bg-dark-bg">
        <td colSpan={4} className="px-4 py-2.5 border-b border-dark-border">
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 3v18m4.5-18v18m4.5-18v18m4.5-18v18M5.25 6h.008M5.25 9h.008M5.25 12h.008M5.25 15h.008M9.75 6h.008M9.75 9h.008M9.75 12h.008M9.75 15h.008M14.25 6h.008M14.25 9h.008M14.25 12h.008M14.25 15h.008M18.75 6h.008M18.75 9h.008M18.75 12h.008M18.75 15h.008" />
            </svg>
            <span className="text-sm font-semibold text-gray-300">{address}</span>
            <span className="text-xs text-gray-500">({tenants.length} {tenants.length === 1 ? 'tenant' : 'tenants'})</span>
          </div>
        </td>
      </tr>
      {tenants.map(t => {
        const entry = ledgerMap[t.id];
        const payStatus = entry?.status || 'no_data';
        return (
          <TenantRow key={t.id} tenant={t} payStatus={payStatus} payColor={PAY_COLORS[payStatus]}
            expanded={expanded === t.id} detail={detail} onExpand={() => onExpand(t)} />
        );
      })}
    </>
  );
}

function TenantRow({ tenant: t, payStatus, payColor, expanded, detail, onExpand }) {
  return (
    <>
      <tr className="border-b border-dark-border hover:bg-dark-hover cursor-pointer transition-colors" onClick={onExpand}>
        <td className="p-4 text-sm font-medium text-gray-200">{t.first_name} {t.last_name}</td>
        <td className="p-4 text-sm text-gray-400">{t.unit_number}</td>
        <td className="p-4 text-sm font-mono text-gray-300">{formatCurrency(t.rent_amount)}</td>
        <td className="p-4"><span className={`badge ${payColor}`}>{payStatus}</span></td>
      </tr>
      {expanded && detail && (
        <tr>
          <td colSpan={4} className="bg-dark-bg border-b border-dark-border">
            <TenantDetail detail={detail} />
          </td>
        </tr>
      )}
    </>
  );
}

function TenantDetail({ detail: d }) {
  return (
    <div className="p-6 grid grid-cols-2 gap-8">
      {/* Conversation History */}
      <div>
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Conversation History</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {(d.conversations || []).length === 0 ? (
            <p className="text-xs text-gray-600">No messages</p>
          ) : (
            d.conversations.slice(0, 12).map(c => (
              <div key={c.id} className={`text-xs p-2.5 rounded-lg ${
                c.direction === 'inbound'
                  ? 'bg-dark-card border border-dark-border'
                  : 'bg-accent/10 border border-accent/20'
              }`}>
                <p className="text-gray-300">{c.message}</p>
                <span className="text-gray-600 text-[10px]">{timeAgo(c.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Maintenance History */}
      <div>
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Maintenance History</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {(d.work_orders || []).length === 0 ? (
            <p className="text-xs text-gray-600">No maintenance history</p>
          ) : (
            d.work_orders.map(wo => (
              <div key={wo.id} className="flex items-center justify-between text-sm py-2 border-b border-dark-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-300 text-xs truncate">#{wo.id} {wo.description}</p>
                  <p className="text-gray-600 text-[10px]">{formatDate(wo.created_at)}</p>
                </div>
                <span className={`badge text-[10px] ${
                  wo.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                  wo.status === 'cancelled' ? 'bg-gray-500/20 text-gray-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>{wo.status}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

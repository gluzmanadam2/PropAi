import { useState, useCallback } from 'react';
import { usePolling, formatCurrency, formatDate, timeAgo } from '../hooks/usePolling';
import { PriorityBadge } from './Overview';
import api from '../api';

export default function Maintenance() {
  const [showCompleted, setShowCompleted] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);

  const { data, refresh } = usePolling(useCallback(() => api.getWorkOrders(), []), 30000);

  const priorityOrder = { emergency: 0, urgent: 1, standard: 2, low: 3 };
  const allOrders = data?.work_orders || [];

  const openOrders = allOrders
    .filter(w => ['new', 'dispatched', 'in_progress'].includes(w.status))
    .sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));

  const completedOrders = allOrders.filter(w => w.status === 'completed' || w.status === 'cancelled');

  const displayOrders = showCompleted ? [...openOrders, ...completedOrders] : openOrders;

  async function handleExpand(wo) {
    if (expanded === wo.id) { setExpanded(null); setDetail(null); return; }
    setExpanded(wo.id);
    setDetail(await api.getWorkOrder(wo.id));
  }

  async function handleApprove(woId) {
    await api.approveWorkOrder(woId);
    refresh();
    if (expanded === woId) setDetail(await api.getWorkOrder(woId));
  }

  async function handleUpdate(woId, updates) {
    await api.updateWorkOrder(woId, updates);
    refresh();
    if (expanded === woId) setDetail(await api.getWorkOrder(woId));
  }

  return (
    <div className="space-y-6">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Open Work Orders ({openOrders.length})
        </h2>
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            showCompleted
              ? 'border-accent/30 text-accent bg-accent/10'
              : 'border-dark-border text-gray-500 hover:text-gray-300'
          }`}
        >
          {showCompleted ? 'Hide' : 'Show'} Completed ({completedOrders.length})
        </button>
      </div>

      {/* Work Order List */}
      <div className="card p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-border text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left p-4">Unit</th>
              <th className="text-left p-4">Property</th>
              <th className="text-left p-4">Issue</th>
              <th className="text-left p-4">Priority</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Vendor</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayOrders.map(wo => (
              <WORow key={wo.id} wo={wo} expanded={expanded === wo.id} detail={detail}
                onExpand={() => handleExpand(wo)} onApprove={() => handleApprove(wo.id)}
                onUpdate={(updates) => handleUpdate(wo.id, updates)} />
            ))}
          </tbody>
        </table>
        {displayOrders.length === 0 && (
          <div className="text-center text-gray-500 py-8 text-sm">No open work orders</div>
        )}
      </div>
    </div>
  );
}

function WORow({ wo, expanded, detail, onExpand, onApprove, onUpdate }) {
  const statusColors = {
    new: 'bg-amber-500/20 text-amber-400',
    dispatched: 'bg-accent/20 text-accent',
    in_progress: 'bg-purple-500/20 text-purple-400',
    completed: 'bg-emerald-500/20 text-emerald-400',
    cancelled: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <>
      <tr className="border-b border-dark-border hover:bg-dark-hover cursor-pointer transition-colors" onClick={onExpand}>
        <td className="p-4 text-sm text-gray-300">#{wo.unit_number}</td>
        <td className="p-4 text-sm text-gray-400">{wo.property_address}</td>
        <td className="p-4 text-sm text-gray-300 max-w-xs truncate">{wo.description || wo.category}</td>
        <td className="p-4"><PriorityBadge priority={wo.priority} /></td>
        <td className="p-4"><span className={`badge ${statusColors[wo.status] || ''}`}>{wo.status}</span></td>
        <td className="p-4 text-sm text-gray-400">{wo.vendor_name || '—'}</td>
        <td className="p-4">
          {wo.status === 'new' && (
            <button onClick={e => { e.stopPropagation(); onApprove(); }} className="btn-primary text-xs py-1 px-3">
              Approve
            </button>
          )}
        </td>
      </tr>
      {expanded && detail && (
        <tr>
          <td colSpan={7} className="bg-dark-bg border-b border-dark-border">
            <WODetail wo={detail} onApprove={onApprove} onUpdate={onUpdate} />
          </td>
        </tr>
      )}
    </>
  );
}

function WODetail({ wo, onApprove, onUpdate }) {
  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-3 gap-6">
        <div>
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Tenant Message</h4>
          <p className="text-sm text-gray-300 bg-dark-card rounded-lg p-3 border border-dark-border italic">
            "{wo.tenant_message}"
          </p>
        </div>
        <div>
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Details</h4>
          <div className="space-y-1.5 text-sm">
            <p><span className="text-gray-500">Category:</span> <span className="text-gray-300 capitalize">{wo.category}</span></p>
            <p><span className="text-gray-500">Vendor:</span> <span className="text-gray-300">{wo.vendor_name || 'Unassigned'}</span></p>
            <p><span className="text-gray-500">Cost:</span> <span className="font-mono text-gray-300">{wo.cost ? formatCurrency(wo.cost) : '—'}</span></p>
          </div>
        </div>
        <div>
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Timeline</h4>
          <div className="space-y-1.5 text-sm">
            <p><span className="text-gray-500">Created:</span> <span className="text-gray-300">{formatDate(wo.created_at)}</span></p>
            <p><span className="text-gray-500">Dispatched:</span> <span className="text-gray-300">{formatDate(wo.dispatched_at)}</span></p>
            <p><span className="text-gray-500">Completed:</span> <span className="text-gray-300">{formatDate(wo.completed_at)}</span></p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2 border-t border-dark-border">
        {wo.status === 'new' && <button onClick={onApprove} className="btn-primary text-xs">Approve & Dispatch</button>}
        {['new', 'dispatched', 'in_progress'].includes(wo.status) && (
          <button onClick={() => onUpdate({ status: 'completed' })} className="btn-success text-xs">Mark Complete</button>
        )}
        {wo.status === 'new' && (
          <button onClick={() => onUpdate({ status: 'cancelled' })} className="btn-danger text-xs">Cancel</button>
        )}
      </div>
    </div>
  );
}

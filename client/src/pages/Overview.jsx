import { useState, useCallback } from 'react';
import { usePolling, formatCurrency, timeAgo } from '../hooks/usePolling';
import api from '../api';

export default function Overview() {
  const { data: dashboard, loading } = usePolling(api.getDashboard, 30000);
  const { data: notifs, refresh: refreshNotifs } = usePolling(useCallback(() => api.getNotifications('pending'), []), 30000);
  const { data: newWOs, refresh: refreshWOs } = usePolling(useCallback(() => api.getWorkOrders({ status: 'new' }), []), 30000);
  const { data: convos } = usePolling(useCallback(() => api.getRecentConversations(10), []), 30000);

  if (loading || !dashboard) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading dashboard...</div>;
  }

  const p = dashboard.portfolio;
  const rc = dashboard.rent_collection;
  const wo = dashboard.work_orders;

  const grossCollected = rc.total_collected || 0;
  const noi = Math.round(grossCollected * 0.77);

  // Combine items needing owner action
  const attentionItems = [];

  if (newWOs?.work_orders) {
    for (const w of newWOs.work_orders) {
      attentionItems.push({
        id: `wo-${w.id}`,
        type: 'work_order',
        priority: w.priority,
        text: `Work Order #${w.id}: ${w.description || w.category} — ${w.property_address} Unit ${w.unit_number}`,
        time: w.created_at,
        woId: w.id,
      });
    }
  }

  if (notifs?.notifications) {
    for (const n of notifs.notifications) {
      // Clean API paths out of notification messages
      const cleanText = n.message.replace(/\s*(?:via |— )?(?:Approve (?:via|sending) )?POST \/api\/\S+/gi, '').trim();
      // Detect pay-or-quit approval notifications
      const isPayOrQuit = n.message.includes('PAY-OR-QUIT') && n.related_tenant_id;
      attentionItems.push({
        id: `notif-${n.id}`,
        type: 'notification',
        notifType: n.type,
        text: cleanText,
        time: n.created_at,
        notifId: n.id,
        isPayOrQuit,
        tenantId: n.related_tenant_id,
      });
    }
  }

  // Last 10 AI actions
  const aiActions = (convos?.conversations || [])
    .filter(c => c.ai_response)
    .slice(0, 10)
    .map(c => ({
      text: `Responded to ${c.first_name} ${c.last_name}: ${c.classification || 'message'}`,
      time: c.created_at,
    }));

  async function handleApproveWO(woId) {
    await api.approveWorkOrder(woId);
    refreshWOs();
  }

  async function handleDenyWO(woId) {
    await api.updateWorkOrder(woId, { status: 'cancelled' });
    refreshWOs();
  }

  async function handleApprovePayOrQuit(tenantId, notifId) {
    await api.approvePayOrQuit(tenantId, 2, 2026);
    await api.acknowledgeNotification(notifId);
    refreshNotifs();
  }

  async function handleAcknowledge(notifId) {
    await api.acknowledgeNotification(notifId);
    refreshNotifs();
  }

  return (
    <div className="space-y-8">
      {/* 4 Large Metric Cards */}
      <div className="grid grid-cols-4 gap-6">
        <MetricCard
          label="Occupancy Rate"
          value={`${p.occupancy_rate}%`}
          color={p.occupancy_rate >= 90 ? 'text-emerald-400' : 'text-amber-400'}
        />
        <MetricCard
          label="Collection Rate"
          value={`${rc.collection_rate}%`}
          color={rc.collection_rate >= 95 ? 'text-emerald-400' : rc.collection_rate >= 85 ? 'text-amber-400' : 'text-red-400'}
        />
        <MetricCard
          label="Active Work Orders"
          value={wo.active}
          color={wo.emergency > 0 ? 'text-red-400' : 'text-accent'}
          subtitle={wo.emergency > 0 ? `${wo.emergency} emergency` : null}
        />
        <MetricCard
          label="Monthly NOI"
          value={formatCurrency(noi)}
          color="text-emerald-400"
        />
      </div>

      {/* Needs Your Attention */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Needs Your Attention
          {attentionItems.length > 0 && (
            <span className="ml-2 text-xs font-mono text-amber-400">({attentionItems.length})</span>
          )}
        </h2>
        {attentionItems.length === 0 ? (
          <p className="text-gray-500 text-sm py-6 text-center">All caught up — no pending items</p>
        ) : (
          <div className="space-y-3">
            {attentionItems.map(item => (
              <AttentionItem
                key={item.id}
                item={item}
                onApproveWO={handleApproveWO}
                onDenyWO={handleDenyWO}
                onAcknowledge={handleAcknowledge}
                onApprovePayOrQuit={handleApprovePayOrQuit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Simple Activity Feed */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">AI Activity Today</h2>
        {aiActions.length === 0 ? (
          <p className="text-gray-500 text-sm py-6 text-center">No AI actions yet today</p>
        ) : (
          <div className="space-y-0">
            {aiActions.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-dark-border last:border-0">
                <span className="text-sm text-gray-300">{a.text}</span>
                <span className="text-xs text-gray-500 flex-shrink-0 ml-4">{timeAgo(a.time)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color = 'text-white', subtitle }) {
  return (
    <div className="card text-center py-8">
      <p className={`text-3xl font-mono font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 uppercase tracking-wider mt-2">{label}</p>
      {subtitle && <p className="text-xs text-red-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function AttentionItem({ item, onApproveWO, onDenyWO, onAcknowledge, onApprovePayOrQuit }) {
  const isEmergency = (item.type === 'notification' && item.notifType === 'emergency') || item.priority === 'emergency';
  const borderColor = isEmergency ? 'border-l-red-500' : 'border-l-amber-500';

  return (
    <div className={`border-l-4 ${borderColor} rounded-r-lg p-4 bg-dark-bg`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-300">{item.text}</p>
          <p className="text-xs text-gray-500 mt-1">{timeAgo(item.time)}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {item.type === 'work_order' && (
            <>
              <button onClick={() => onApproveWO(item.woId)} className="btn-primary text-xs py-1.5 px-3">Approve</button>
              <button onClick={() => onDenyWO(item.woId)} className="btn-danger text-xs py-1.5 px-3">Deny</button>
            </>
          )}
          {item.type === 'notification' && item.isPayOrQuit && (
            <>
              <button onClick={() => onApprovePayOrQuit(item.tenantId, item.notifId)} className="btn-primary text-xs py-1.5 px-3">Approve</button>
              <button onClick={() => onAcknowledge(item.notifId)} className="btn-danger text-xs py-1.5 px-3">Deny</button>
            </>
          )}
          {item.type === 'notification' && !item.isPayOrQuit && (
            <button onClick={() => onAcknowledge(item.notifId)} className="btn-ghost text-xs py-1.5 px-3">Acknowledge</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PriorityBadge({ priority }) {
  const colors = {
    emergency: 'bg-red-500/20 text-red-400',
    urgent: 'bg-orange-500/20 text-orange-400',
    standard: 'bg-accent/20 text-accent',
    low: 'bg-emerald-500/20 text-emerald-400',
  };
  return (
    <span className={`badge ${colors[priority] || 'bg-gray-500/20 text-gray-400'}`}>
      {priority}
    </span>
  );
}

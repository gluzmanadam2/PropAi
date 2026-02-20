import { useState, useCallback } from 'react';
import { usePolling, formatCurrency } from '../hooks/usePolling';
import api from '../api';

export default function Financials() {
  const [showReport, setShowReport] = useState(false);
  const { data: ledger } = usePolling(api.getCurrentLedger, 30000);
  const { data: delinquent } = usePolling(useCallback(() => api.getDelinquent(), []), 30000);

  const summary = ledger?.summary || {};
  const totalDue = summary.total_due || 0;
  const totalCollected = summary.total_collected || 0;
  const collectionPct = totalDue ? ((totalCollected / totalDue) * 100).toFixed(1) : 0;

  // Simple NOI calc
  const expenses = Math.round(totalCollected * 0.15);
  const mgmtFee = Math.round(totalCollected * 0.08);
  const noi = totalCollected - expenses - mgmtFee;

  return (
    <div className="space-y-8">
      {/* Collection Progress Bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Collection Progress — {summary.month}/{summary.year}
          </h2>
          <span className="font-mono text-xl font-bold text-accent">{collectionPct}%</span>
        </div>
        <div className="w-full bg-dark-bg rounded-full h-5 border border-dark-border">
          <div className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${Math.min(collectionPct, 100)}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>{formatCurrency(totalCollected)} collected</span>
          <span>{formatCurrency(totalDue)} total due</span>
        </div>
      </div>

      {/* Monthly Summary: 3 numbers */}
      <div className="grid grid-cols-3 gap-6">
        <div className="card text-center py-6">
          <p className="text-2xl font-mono font-bold text-emerald-400">{formatCurrency(totalCollected)}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wider mt-2">Income</p>
        </div>
        <div className="card text-center py-6">
          <p className="text-2xl font-mono font-bold text-red-400">{formatCurrency(expenses + mgmtFee)}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wider mt-2">Expenses</p>
        </div>
        <div className="card text-center py-6">
          <p className="text-2xl font-mono font-bold text-emerald-400">{formatCurrency(noi)}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wider mt-2">NOI</p>
        </div>
      </div>

      {/* Unpaid Tenants */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Unpaid Tenants
            {delinquent?.tenants?.length > 0 && (
              <span className="ml-2 text-xs font-mono text-red-400">({delinquent.tenants.length})</span>
            )}
          </h2>
          {delinquent?.total_owed > 0 && (
            <span className="font-mono text-sm text-red-400">{formatCurrency(delinquent.total_owed)} outstanding</span>
          )}
        </div>

        {!delinquent?.tenants?.length ? (
          <p className="text-gray-500 text-sm py-6 text-center">All tenants are current</p>
        ) : (
          <div className="space-y-4">
            {delinquent.tenants.map(t => (
              <DelinquentRow key={t.id} tenant={t} />
            ))}
          </div>
        )}
      </div>

      {/* View Full Report toggle */}
      {showReport ? (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Full Report</h2>
            <button onClick={() => setShowReport(false)} className="text-xs text-gray-500 hover:text-gray-300">Hide</button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-dark-border">
              <span className="text-gray-400">Rent Revenue</span>
              <span className="font-mono text-gray-300">{formatCurrency(totalCollected)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dark-border">
              <span className="text-gray-400">Late Fees Collected</span>
              <span className="font-mono text-gray-300">{formatCurrency(ledger?.entries?.reduce((s, e) => s + e.late_fee, 0) || 0)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dark-border">
              <span className="text-gray-400">Operating Expenses (15%)</span>
              <span className="font-mono text-red-400">-{formatCurrency(expenses)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dark-border">
              <span className="text-gray-400">Management Fee (8%)</span>
              <span className="font-mono text-red-400">-{formatCurrency(mgmtFee)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-dark-border">
              <span className="text-gray-400">Reserves (5%)</span>
              <span className="font-mono text-amber-400">-{formatCurrency(Math.round(totalCollected * 0.05))}</span>
            </div>
            <div className="flex justify-between py-2 font-semibold">
              <span className="text-gray-300">Net Distribution</span>
              <span className="font-mono text-emerald-400">{formatCurrency(totalCollected - expenses - mgmtFee - Math.round(totalCollected * 0.05))}</span>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowReport(true)}
          className="w-full text-center text-xs text-gray-500 hover:text-accent transition-colors py-2">
          View Full Report
        </button>
      )}
    </div>
  );
}

const COLLECTION_STEPS = [
  { type: 'reminder_1', label: 'Friendly Reminder', description: 'Payment reminder SMS sent to tenant' },
  { type: 'reminder_2', label: 'Late Fee Applied', description: '$50 late fee applied, late notice sent' },
  { type: 'reminder_3', label: 'Formal Notice', description: 'Formal delinquency notice sent' },
  { type: 'escalated', label: 'Escalated to Owner', description: 'Flagged for owner approval of pay-or-quit' },
  { type: 'pay_or_quit', label: 'Pay-or-Quit Served', description: '7-day pay-or-quit notice served (Maine Title 14 §6002)' },
];

function getNextStep(completedTypes) {
  for (const step of COLLECTION_STEPS) {
    if (!completedTypes.has(step.type)) return step;
  }
  return null;
}

function DelinquentRow({ tenant: t }) {
  const now = new Date();
  const daysLate = now.getDate();
  const actions = t.collection_actions || [];
  const completedTypes = new Set(actions.map(a => a.action_type));
  const nextStep = getNextStep(completedTypes);
  const lastAction = actions[actions.length - 1];
  const allStepsDone = !nextStep;

  // Determine what happens after all steps
  const evictionNext = allStepsDone && completedTypes.has('pay_or_quit');

  return (
    <div className="border border-dark-border rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-200">{t.first_name} {t.last_name}</p>
          <p className="text-xs text-gray-500">{t.property_address || t.address} Unit {t.unit_number}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge bg-red-500/20 text-red-400">{daysLate} days late</span>
          <span className="font-mono text-red-400 font-semibold">{formatCurrency(t.total_owed)}</span>
        </div>
      </div>

      {/* Steps: Completed + Next */}
      <div className="space-y-1.5">
        {COLLECTION_STEPS.map(step => {
          const done = completedTypes.has(step.type);
          const isNext = nextStep?.type === step.type;

          if (!done && !isNext) return null;

          return (
            <div key={step.type} className="flex items-center gap-3 py-1.5">
              {done ? (
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-400 text-xs">{'\u2713'}</span>
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border border-amber-500/50 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-400 text-[10px]">{'\u2192'}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-medium ${done ? 'text-gray-400' : 'text-amber-400'}`}>
                  {done ? step.label : `NEXT: ${step.label}`}
                </span>
                <span className="text-xs text-gray-600 ml-2">{step.description}</span>
              </div>
              {done && (
                <span className="text-[10px] text-gray-600 flex-shrink-0">
                  {actions.find(a => a.action_type === step.type)?.sent_at?.split(' ')[0] || ''}
                </span>
              )}
            </div>
          );
        })}

        {/* After all steps: eviction path */}
        {evictionNext && (
          <div className="flex items-center gap-3 py-1.5">
            <div className="w-5 h-5 rounded-full border border-red-500/50 flex items-center justify-center flex-shrink-0">
              <span className="text-red-400 text-[10px]">{'\u2192'}</span>
            </div>
            <div className="flex-1">
              <span className="text-xs font-medium text-red-400">NEXT: Eviction Filing</span>
              <span className="text-xs text-gray-600 ml-2">If unpaid after 7-day cure period, proceed with eviction</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

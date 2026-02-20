import { usePolling } from '../hooks/usePolling';
import api from '../api';

export default function Header() {
  const { data: dashboard } = usePolling(api.getDashboard, 30000);
  const { data: convos } = usePolling(() => api.getRecentConversations(50), 30000);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const todayConvos = convos?.conversations?.filter(c => {
    const d = new Date(c.created_at);
    return d.toDateString() === now.toDateString();
  }) || [];
  const aiHandled = todayConvos.filter(c => c.direction === 'outbound').length;
  const pendingNotifs = dashboard?.notifications?.pending || 0;

  return (
    <header className="h-14 bg-dark-card border-b border-dark-border flex items-center justify-between px-6 fixed top-0 left-60 right-0 z-20">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs text-gray-400">All Systems Operational</span>
        </div>
        <span className="text-xs text-gray-500">{dateStr} {timeStr}</span>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 bg-dark-bg px-3 py-1.5 rounded-lg border border-dark-border">
          <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="text-xs text-gray-300">
            <span className="font-mono font-semibold text-accent">{aiHandled}</span> AI interactions
          </span>
          <span className="text-[10px] text-gray-500">|</span>
          <span className="text-xs text-gray-400">
            <span className="font-mono font-semibold text-amber-400">{pendingNotifs}</span> need input
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
            <span className="text-accent text-xs font-bold">AG</span>
          </div>
        </div>
      </div>
    </header>
  );
}

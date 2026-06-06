import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * App frame: the 56px operator rail + the active surface. Active state and
 * navigation are derived from the URL (react-router) so the rail stays in sync
 * with deep links and back/forward.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const items: Array<{
    key: string;
    icon: IconName;
    label: string;
    active: boolean;
    onClick: () => void;
  }> = [
    {
      key: 'missions',
      icon: 'grid',
      label: 'Missions',
      active: pathname.startsWith('/missions'),
      onClick: () => navigate('/missions'),
    },
    { key: 'planner', 
      icon: 'plan', 
      label: 'Planner', 
      active: pathname === '/plan', 
      onClick: () => navigate('/plan') },
    {
      key: 'live',
      icon: 'live',
      label: 'Live',
      active: pathname.startsWith('/live'),
      // Return to an in-progress run if there is one; otherwise the /live
      // empty state ("no active live stream").
      onClick: () => {
        if (pathname.startsWith('/live')) return;
        const live = sessionStorage.getItem('mt:live');
        navigate(live || '/live');
      },
    },
  ];

  const railBtn =
    'group relative grid h-9 w-9 place-items-center rounded-lg transition-all duration-150';
  const railIdle = 'text-t-lo hover:bg-white/10 hover:text-t-hi';
  const railActive =
    "bg-acc text-[#06241a] shadow-[0_2px_12px_rgba(79,227,161,0.4)] hover:bg-acc-bright before:absolute before:inset-y-1.5 before:-left-3.5 before:w-1 before:rounded-sm before:bg-acc before:content-['']";

  return (
    <div className="flex h-full bg-bg-0">
      <nav className="relative z-20 flex w-14 flex-none flex-col items-center gap-1.5 border-r border-line bg-bg-1 py-3.5">
        <button
          onClick={() => navigate('/')}
          aria-label="Overview"
          className="group relative grid h-10 w-10 place-items-center rounded-2xl bg-[linear-gradient(160deg,#4fe3a1,#2bb47d)] text-[#06241a] shadow-[0_0_0_1px_rgba(79,227,161,0.3),0_6px_16px_rgba(79,227,161,0.18)] transition-transform hover:scale-105 active:scale-95"
        >
          <Icon name="drone" size={20} />
          <RailTip label="Overview" />
        </button>
        {/* short divider between the logo and the nav */}
        <div className="my-2 h-px w-5 rounded-full bg-line-2" />
        {items.map((it) => (
          <button
            key={it.key}
            className={`${railBtn} ${it.active ? railActive : railIdle}`}
            aria-label={it.label}
            onClick={it.onClick}
          >
            <Icon name={it.icon} size={19} />
            <RailTip label={it.label} />
          </button>
        ))}
        <div className="flex-1" />
        <button className={`${railBtn} ${railIdle}`} aria-label="Settings">
          <Icon name="settings" size={18} />
          <RailTip label="Settings" />
        </button>
      </nav>
      <main className="relative min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

/** Hover tooltip to the right of a rail icon, showing the page title. */
function RailTip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 translate-x-[-4px] whitespace-nowrap rounded-md border border-line-2 bg-bg-1 px-2.5 py-1 text-xs font-medium text-t-hi opacity-0 shadow-[0_8px_28px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100">
      {label}
    </span>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { startMission } from '@/api/client';
import {
  ALT_CHIPS,
  PREFLIGHT_CHECKS,
  REPLIES,
  RETRY_CHIPS,
  REVIEW_CHIPS,
  SITE_CHIPS,
  TEMPLATES,
  TYPE_CHIPS,
  type Chip,
  type PlanTemplate,
} from './mock';

/**
 * Mission Planner — a scripted, finite-state chat (no real LLM). The operator
 * picks what to fly → confirms the site → reviews the plan (optionally tweaks
 * altitude) → runs pre-flight checks → hits **Start Mission** inside the chat.
 * Start does a real POST /api/missions/start and hands the run_id to the live
 * route. Suggestions + system responses come from ./mock; quick-reply chips
 * drive the flow so the conversation stays coherent.
 */

type Stage = 'boot' | 'type' | 'site' | 'review' | 'alt' | 'armed';
interface CardData {
  kind: 'plan' | 'arm';
  t: PlanTemplate;
  alt: number;
}
interface Msg {
  id: number;
  role: 'sys' | 'op';
  text?: string;
  card?: CardData;
}

interface ChatPlannerProps {
  onStarted: (runId: string, speed: number, templateId: string) => void;
  onCancel: () => void;
}

export function ChatPlanner({ onStarted, onCancel }: ChatPlannerProps) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [typing, setTyping] = useState(false);
  const [speed, setSpeed] = useState(6);
  const [checks, setChecks] = useState(0);
  const [launching, setLaunching] = useState(false);
  const stage = useRef<Stage>('boot');
  const plan = useRef<{ t: PlanTemplate | null; alt: number | null }>({ t: null, alt: null });
  const scrollRef = useRef<HTMLDivElement>(null);
  const idc = useRef(0);

  const down = () =>
    requestAnimationFrame(() => {
      const s = scrollRef.current;
      if (s) s.scrollTo({ top: s.scrollHeight, behavior: 'smooth' });
    });
  const addMsg = (m: Omit<Msg, 'id'>) => {
    setMsgs((x) => [...x, { id: idc.current++, ...m }]);
    down();
  };
  const sysSay = (payload: Omit<Msg, 'id' | 'role'>, after?: () => void, delay = 750) => {
    setTyping(true);
    setChips([]);
    down();
    setTimeout(() => {
      setTyping(false);
      addMsg({ role: 'sys', ...payload });
      after?.();
    }, delay);
  };

  // boot conversation
  useEffect(() => {
    const t1 = setTimeout(() => {
      addMsg({ role: 'sys', text: REPLIES.greeting });
      stage.current = 'type';
      setChips(TYPE_CHIPS);
    }, 500);
    return () => clearTimeout(t1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proposePlan = () => {
    const t = plan.current.t!;
    const alt = plan.current.alt ?? t.alt;
    sysSay({ text: REPLIES.plan(t, alt), card: { kind: 'plan', t, alt } }, () => {
      stage.current = 'review';
      setChips(REVIEW_CHIPS);
    });
  };

  const armUp = () => {
    const t = plan.current.t!;
    sysSay(
      { text: REPLIES.preflight, card: { kind: 'arm', t, alt: plan.current.alt ?? t.alt } },
      () => {
        stage.current = 'armed';
        setChips([]);
        setChecks(0);
        [1, 2, 3, 4].forEach((n) => setTimeout(() => setChecks(n), 500 * n));
      },
      700,
    );
  };

  const onChip = (chip: Chip) => {
    const s = stage.current;
    if (s === 'type') {
      const t = TEMPLATES[chip.value]!;
      plan.current = { t, alt: null };
      addMsg({ role: 'op', text: chip.label });
      sysSay({ text: REPLIES.typeAck(t) }, () => {
        stage.current = 'site';
        setChips(SITE_CHIPS);
      });
    } else if (s === 'site') {
      addMsg({ role: 'op', text: chip.label });
      if (chip.value === 'back') {
        sysSay({ text: REPLIES.back }, () => {
          stage.current = 'type';
          setChips(TYPE_CHIPS);
        });
      } else proposePlan();
    } else if (s === 'review') {
      addMsg({ role: 'op', text: chip.label });
      if (chip.value === 'arm') armUp();
      else
        sysSay({ text: REPLIES.altPrompt }, () => {
          stage.current = 'alt';
          setChips(ALT_CHIPS);
        });
    } else if (s === 'alt') {
      plan.current.alt = parseInt(chip.value, 10);
      addMsg({ role: 'op', text: chip.label + ' AGL' });
      proposePlan();
    }
  };

  const start = async () => {
    const t = plan.current.t!;
    setLaunching(true);
    setChips([]);
    addMsg({ role: 'op', text: 'Start mission' });
    setTyping(true);
    down();
    try {
      const res = await startMission(t.id);
      setTyping(false);
      addMsg({ role: 'sys', text: REPLIES.arming(t) });
      setTimeout(() => onStarted(res.run_id, speed, t.id), 800);
    } catch {
      setTyping(false);
      setLaunching(false);
      addMsg({ role: 'sys', text: REPLIES.launchFail });
      stage.current = 'review';
      setChips(RETRY_CHIPS);
    }
  };

  return (
    <div className="absolute inset-0 grid place-items-center bg-bg-0 p-4 [background-image:radial-gradient(70%_50%_at_50%_0%,rgba(79,227,161,0.05),transparent_55%)] sm:p-6">
      <div className="flex h-full w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-line bg-bg-1 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
        <header className="flex flex-none items-center justify-between border-b border-line px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[linear-gradient(160deg,#4fe3a1,#2bb47d)] text-[#06241a]">
              <Icon name="drone" size={16} />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">Mission Planner</div>
              <div className="mt-px flex items-center gap-1.5 text-2xs text-t-lo">
                <span className="h-1.5 w-1.5 rounded-full bg-acc shadow-[0_0_6px_var(--color-acc)]" />
                Greenfield Solar · dock online
              </div>
            </div>
          </div>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pb-2.5 pt-6">
          <div className="flex flex-col gap-4">
            {msgs.map((m) => (
              <Bubble
                key={m.id}
                m={m}
                speed={speed}
                setSpeed={setSpeed}
                checks={checks}
                launching={launching}
                onStart={start}
              />
            ))}
            {typing && (
              <div className="flex items-end gap-2.5">
                <Avatar />
                <div className="flex gap-1 rounded-2xl rounded-bl-md border border-line bg-bg-2 px-3.5 py-3">
                  <Dot />
                  <Dot delay="0.18s" />
                  <Dot delay="0.36s" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-none border-t border-line px-6 pb-5 pt-3 [background:linear-gradient(180deg,transparent,rgba(0,0,0,0.15))]">
          {chips.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c.value}
                  onClick={() => onChip(c)}
                  className="animate-[msgin_0.3s_ease-out_both] rounded-full border border-acc-line bg-acc-dim px-3.5 py-2 text-sm font-semibold text-acc transition hover:-translate-y-px hover:bg-[#4fe3a1]/25"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          <div
            className={`flex items-center gap-2.5 rounded-lg border border-line-2 bg-bg-1 py-1.5 pl-3.5 pr-1.5 ${
              chips.length || typing ? 'opacity-55' : ''
            }`}
          >
            <input
              disabled
              placeholder={
                chips.length ? 'Tap a suggestion above…' : 'Conversation guided — pick an option'
              }
              className="flex-1 border-0 bg-transparent text-sm text-t-mid outline-none"
            />
            <button disabled className="grid h-9 w-9 place-items-center rounded-md bg-bg-3 text-t-lo">
              <Icon name="send" size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div className="grid h-7 w-7 flex-none place-items-center rounded-lg border border-line-2 bg-bg-3 text-acc">
      <Icon name="drone" size={13} />
    </div>
  );
}

function Dot({ delay }: { delay?: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-[tdot_1.2s_infinite] rounded-full bg-t-lo"
      style={delay ? { animationDelay: delay } : undefined}
    />
  );
}

interface BubbleProps {
  m: Msg;
  speed: number;
  setSpeed: (n: number) => void;
  checks: number;
  launching: boolean;
  onStart: () => void;
}

function Bubble({ m, ...card }: BubbleProps) {
  if (m.role === 'op') {
    return (
      <div className="flex animate-[msgin_0.34s_ease-out_both] justify-end">
        <div className="max-w-[460px] rounded-2xl rounded-br-md bg-acc px-3.5 py-2.5 text-sm font-medium text-[#06241a]">
          {m.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex animate-[msgin_0.34s_ease-out_both] items-end gap-2.5">
      <Avatar />
      <div className="flex max-w-[460px] flex-col gap-2.5">
        {m.text && (
          <div className="rounded-2xl rounded-bl-md border border-line bg-bg-2 px-3.5 py-2.5 text-sm">
            {m.text}
          </div>
        )}
        {m.card?.kind === 'plan' && <PlanCard t={m.card.t} alt={m.card.alt} />}
        {m.card?.kind === 'arm' && <ArmCard {...card} />}
      </div>
    </div>
  );
}

function PlanCard({ t, alt }: { t: PlanTemplate; alt: number }) {
  const rows: Array<[string, string]> = [
    ['Template', t.label],
    ['Drone', `${t.drone} · ${t.serial}`],
    ['Pattern', t.pattern],
    ['Cruise alt', `${alt} m AGL`],
    ['Camera', t.camera],
    ['Waypoints', `${t.wp} · ${t.cap} captures`],
    ['Est. flight', t.est],
  ];
  return (
    <div className="w-[380px] max-w-full overflow-hidden rounded-xl border border-line-2 bg-bg-1 shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between border-b border-line px-3.5 py-3">
        <span className="text-2xs font-medium uppercase tracking-widest text-t-lo">Flight Plan</span>
        <span className="rounded border border-line-2 bg-bg-2 px-1.5 py-0.5 text-2xs uppercase tracking-wider text-t-mid">
          {t.id}
        </span>
      </div>
      <div className="py-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3.5 px-3.5 py-2 text-sm">
            <span className="pt-px text-2xs uppercase tracking-wider text-t-lo">{k}</span>
            <span className="text-right font-semibold text-t-hi">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArmCard({ speed, setSpeed, checks, launching, onStart }: Omit<BubbleProps, 'm'>) {
  return (
    <div className="w-[380px] max-w-full rounded-xl border border-line-2 bg-bg-1 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
      <div className="flex flex-col gap-2.5">
        {PREFLIGHT_CHECKS.map((c, i) => {
          const ok = checks > i;
          return (
            <div
              key={c}
              className={`flex items-center gap-2.5 text-sm transition-colors ${ok ? 'text-t-hi' : 'text-t-lo'}`}
            >
              <span
                className={`grid h-5 w-5 flex-none place-items-center rounded-md border text-acc transition ${
                  ok ? 'border-acc-line bg-acc-dim' : 'border-line-2'
                }`}
              >
                {ok ? <Icon name="check" size={12} /> : <Spinner className="h-3 w-3" />}
              </span>
              {c}
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3.5">
        <span className="text-2xs font-medium uppercase tracking-widest text-t-lo">Replay speed</span>
        <div className="flex gap-0.5 rounded-lg bg-bg-3 p-0.5">
          {[3, 6, 12].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                speed === s ? 'bg-bg-1 text-acc shadow-[0_1px_2px_rgba(0,0,0,0.4)]' : 'text-t-mid'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <Button
        size="lg"
        block
        disabled={checks < 4 || launching}
        onClick={onStart}
        className="mt-3"
      >
        {launching ? (
          <>
            <Spinner className="h-3.5 w-3.5" />
            Launching…
          </>
        ) : (
          <>
            <Icon name="play" size={15} fill="currentColor" stroke={0} />
            Start Mission
          </>
        )}
      </Button>
    </div>
  );
}

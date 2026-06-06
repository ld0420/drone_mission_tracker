import { Routes, Route, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { OperationsOverview } from '@/components/overview/OperationsOverview';
import { MissionList } from '@/components/missions/MissionList';
import { MissionDetailView } from '@/components/missions/MissionDetailView';
import { ChatPlanner } from '@/components/chat/ChatPlanner';
import { LiveMission } from '@/components/live/LiveMission';
import { LiveEmpty } from '@/components/live/LiveEmpty';

/**
 * Surfaces are URL-routed (react-router). Thin route wrappers translate router
 * state (params) and navigation into the plain props each surface expects, so
 * the leaf components stay decoupled from the router.
 *
 *   /missions            mission history
 *   /missions/:id        past-mission detail (deep-linkable)
 *   /plan                chat planner
 *   /live/:runId         live mission cockpit
 */
function MissionListRoute() {
  const navigate = useNavigate();
  return (
    <MissionList
      onOpenMission={(id) => navigate(`/missions/${id}`)}
      onPlan={() => navigate('/plan')}
    />
  );
}

function MissionDetailRoute() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  return <MissionDetailView missionId={id} onBack={() => navigate('/missions')} />;
}

function PlanRoute() {
  const navigate = useNavigate();
  return (
    <ChatPlanner
      onStarted={(runId, speed, template) =>
        navigate(`/live/${runId}?speed=${speed}&template=${template}`)
      }
      onCancel={() => navigate('/missions')}
    />
  );
}

function LiveRoute() {
  const { runId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const speed = Number(params.get('speed')) || 3;
  const templateId = params.get('template') ?? '';
  return (
    <LiveMission
      runId={runId}
      speed={speed}
      templateId={templateId}
      onExit={() => navigate('/missions')}
      onReview={() => navigate(`/missions/${templateId}`)}
      onPlanAnother={() => navigate('/plan')}
    />
  );
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<OperationsOverview />} />
        <Route path="/missions" element={<MissionListRoute />} />
        <Route path="/missions/:id" element={<MissionDetailRoute />} />
        <Route path="/plan" element={<PlanRoute />} />
        <Route path="/live" element={<LiveEmpty />} />
        <Route path="/live/:runId" element={<LiveRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

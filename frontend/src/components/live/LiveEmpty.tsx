import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

/**
 * Shown when the Live rail tab is opened but nothing is flying. Rather than
 * bouncing the operator elsewhere, it explains the state and points to the
 * planner.
 */
export function LiveEmpty() {
  const navigate = useNavigate();
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#0c130f] [background-image:linear-gradient(rgba(79,227,161,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(79,227,161,0.05)_1px,transparent_1px)] [background-size:34px_34px] p-6">
      <div className="text-center">
        <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-line bg-bg-1 text-t-lo">
          <Icon name="live" size={28} />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-bg-1 bg-t-lo" />
        </div>
        <h2 className="mt-5 text-xl font-bold tracking-tight">No active live stream</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-t-lo">
          Nothing is flying right now. Plan a mission and hit Start to watch the drone here in
          real time.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2.5">
          <Button variant="outline" onClick={() => navigate('/')}>
            Overview
          </Button>
          <Button onClick={() => navigate('/plan')}>
            <Icon name="plan" size={15} />
            Plan a mission
          </Button>
        </div>
      </div>
    </div>
  );
}

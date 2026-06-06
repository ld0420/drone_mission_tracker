import { useMemo, useState, type ReactNode } from 'react';
import { MissionMap } from './MissionMap';
import { CapturesRail } from './CapturesRail';
import { ImageViewer, type ViewerCapture } from './ImageViewer';
import { useMissionDetail, useMissionPath } from '@/hook/useMissionDetail';
import { Icon } from '@/components/ui/Icon';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatDate, formatDuration, formatTime } from '@/utils/format';

interface MissionDetailViewProps {
  missionId: string;
  onBack: () => void;
}

function MetaCell({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="meta-cell">
      <div className="k">{k}</div>
      <div className={`v${mono ? ' mono' : ''}`}>{v}</div>
    </div>
  );
}

/**
 * Past-mission detail — the design's split: telemetry sidebar (left), map
 * (fills), captures rail (right), legend floating top-right, viewer one click
 * away. Owns the single source of truth for the selected capture (`seq`) so the
 * map cone, rail thumb, and open image stay in lockstep.
 *
 * NB: the Mapbox-backed map + this layout stay on the hand-written CSS classes
 * (styles/operator.css + index.css). Converting them to Tailwind utilities
 * repeatedly destabilised the live WebGL canvas (it loaded tiles but painted
 * black), so this surface is deliberately left on the CSS-class version that
 * renders reliably. See SOLUTION.md.
 *
 * Data, split by fitness: useMissionDetail → metadata + abort reason;
 * useMissionPath → all map geometry + the complete capture list the viewer
 * steps through; CapturesRail → paginated /captures.
 */
export function MissionDetailView({ missionId, onBack }: MissionDetailViewProps) {
  const detail = useMissionDetail(missionId);
  const pathQuery = useMissionPath(missionId);
  const mission = detail.data;

  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const viewerCaptures = useMemo<ViewerCapture[]>(() => {
    const feats = pathQuery.data?.captures.features ?? [];
    return feats
      .map((f) => ({
        seq: f.properties.seq,
        image_id: f.properties.image_id,
        heading: f.properties.heading,
        alt: f.properties.alt,
        waypoint_index: f.properties.waypoint_index,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      }))
      .sort((a, b) => a.seq - b.seq);
  }, [pathQuery.data]);

  const select = (seq: number) => {
    setSelectedSeq(seq);
    setViewerOpen(true);
  };

  const aborted = mission?.status === 'aborted';

  return (
    <div className="view detail-split">
      <header className="detail-header">
        <button className="back-btn" onClick={onBack}>
          <Icon name="chevL" size={16} />
          Missions
        </button>
        {mission && (
          <div className="detail-titlewrap">
            <div className="nm">{mission.name}</div>
            <div className="sub">
              <StatusPill status={mission.status} />
              <span className="tag">{mission.type}</span>
            </div>
          </div>
        )}
      </header>

      <div className="detail-body">
        <aside className="telemetry-sidebar">
          {mission && (
            <>
              <div
                className="meta-card-head"
                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
              >
                <span className="eyebrow" style={{ width: 'fit-content' }}>
                  Mission Telemetry
                </span>
                <span className="tag">{mission.id}</span>
              </div>
              <div className="meta-grid">
                <MetaCell k="Drone" v={mission.drone.model} />
                <MetaCell k="Serial" v={mission.drone.serial} mono />
                <MetaCell k="Duration" v={formatDuration(mission.duration_seconds)} mono />
                <MetaCell
                  k="Started"
                  v={
                    mission.started_at
                      ? `${formatDate(mission.started_at)} · ${formatTime(mission.started_at)}`
                      : '—'
                  }
                  mono
                />
                <MetaCell
                  k="Ended"
                  v={mission.ended_at ? formatTime(mission.ended_at) : '—'}
                  mono
                />
                <MetaCell k="Status" v={<StatusPill status={mission.status} />} />
              </div>
              {aborted && mission.abort_reason && (
                <div className="abort-banner">
                  <span className="ic">
                    <Icon name="alert" size={16} />
                  </span>
                  <div>
                    <b>Mission aborted</b>
                    {mission.abort_reason}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>

        <div className="detail-map">
          {pathQuery.data ? (
            <MissionMap
              path={pathQuery.data}
              status={mission?.status ?? 'complete'}
              selectedSeq={selectedSeq}
              onSelectCapture={select}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              <div className="spin" />
            </div>
          )}

          {mission && (
            <div className="legend">
              <div className="row">
                <span className="gl">
                  <svg width={16} height={10}>
                    <line
                      x1={0}
                      y1={5}
                      x2={16}
                      y2={5}
                      stroke={aborted ? '#ff6b5e' : '#4fe3a1'}
                      strokeWidth={2}
                    />
                  </svg>
                </span>
                Planned flight path
              </div>
              <div className="row">
                <span className="gl">
                  <svg width={14} height={12} viewBox="0 0 14 12">
                    <path d="M7 11 L2 2 L12 2 Z" fill="rgba(79,227,161,0.3)" stroke="#4fe3a1" />
                  </svg>
                </span>
                Capture · camera heading
              </div>
              <div className="row">
                <span className="gl">
                  <Icon name="home" size={13} style={{ color: '#fff' }} />
                </span>
                Dock · takeoff &amp; RTL
              </div>
            </div>
          )}
        </div>

        <CapturesRail missionId={missionId} selectedSeq={selectedSeq} onOpen={select} />
      </div>

      {viewerOpen && mission && (
        <ImageViewer
          captures={viewerCaptures}
          selectedSeq={selectedSeq}
          missionName={mission.name}
          onSelectSeq={setSelectedSeq}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}

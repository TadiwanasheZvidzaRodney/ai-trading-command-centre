import { FlaskConical } from 'lucide-react';

export function Placeholder({
  title,
  phase,
  description,
}: {
  title: string;
  phase: number;
  description: string;
}) {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">{title}</h2>
          <p className="page-subtitle">Planned for Phase {phase}</p>
        </div>
        <span className="badge accent">Phase {phase}</span>
      </div>
      <div className="placeholder">
        <div className="placeholder-icon">
          <FlaskConical size={21} />
        </div>
        <h2>{title}</h2>
        <p>{description}</p>
        <p className="hint">
          This page is a deliberate placeholder. It will be replaced by the real workflow in
          Phase {phase}; no mock data is shown in the meantime.
        </p>
      </div>
    </div>
  );
}

'use client';

import type { CopilotAnalysisResponse } from '@/lib/hooks';
import { TrendingUp } from 'lucide-react';

function extractTradeIdeas(
  md: string,
): Array<{ title: string; details: string[] }> {
  const ideas = [];
  const lines = md.split('\n');
  let current: { title: string; details: string[] } | null = null;

  for (const line of lines) {
    // Match ### Idea or #### Idea patterns
    if (line.match(/^#{3,4}\s+Idea/i)) {
      if (current) ideas.push(current);
      current = { title: line.replace(/^#+\s+/, ''), details: [] };
    } else if (current && line.startsWith('- ')) {
      current.details.push(line.substring(2).trim());
    } else if (current && line.trim() === '' && current.details.length > 0) {
      // Empty line after details - idea might be complete
      if (line.match(/^#{3,4}\s+/)) {
        ideas.push(current);
        current = null;
      }
    }
  }
  if (current) ideas.push(current);
  return ideas;
}

export function TradeIdeasHighlight({
  report,
}: {
  report: CopilotAnalysisResponse;
}) {
  const ideas = extractTradeIdeas(report.report);

  if (ideas.length === 0) {
    return null;
  }

  return (
    <div className="trade-ideas-card card">
      <div className="card-header">
        <div className="row">
          <TrendingUp size={20} />
          <h3 className="card-title">Trade Ideas ({ideas.length})</h3>
        </div>
      </div>
      <div className="card-body">
        <div className="ideas-list">
          {ideas.map((idea, idx) => (
            <div key={idx} className="idea-item">
              <h4>{idea.title}</h4>
              {idea.details.length > 0 && (
                <ul>
                  {idea.details.map((detail, i) => (
                    <li key={i}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

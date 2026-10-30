'use client';

import type { CopilotAnalysisResponse } from '@/lib/hooks';
import { AlertTriangle, Zap } from 'lucide-react';

function parseMarkdown(md: string): string {
  // Simple markdown to HTML converter - safe for display
  let html = md
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Lists (basic)
    .replace(/^\- (.*?)$/gm, '<li>$1</li>')
    // Wrap consecutive list items
    .replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>')
    // Code blocks
    .replace(/`([^`]*)`/g, '<code>$1</code>')
    // Line breaks
    .replace(/\n/g, '<br/>');

  return html;
}

export function AIAnalysisReport({
  report,
  fallback,
  fallbackReason,
  inferenceTimeMs,
}: {
  report: CopilotAnalysisResponse;
  fallback?: boolean;
  fallbackReason?: string;
  inferenceTimeMs: number;
}) {
  const generatedTime = new Date(report.generated_at);

  return (
    <div className="report-container card">
      {fallback && (
        <div className="banner warning">
          <AlertTriangle size={16} />
          <span>AI model unavailable ({fallbackReason}). Showing analysis facts only.</span>
        </div>
      )}

      <div className="card-body">
        <div className="report-header">
          <div className="header-row">
            <span className="label">Generated:</span>
            <time>{generatedTime.toLocaleTimeString()}</time>
          </div>
          <div className="header-row">
            <span className="label">Model:</span>
            <span>
              {report.model
                ? `${report.model} (${inferenceTimeMs}ms)`
                : 'Fallback analysis'}
            </span>
          </div>
          <div className="header-row">
            <span className="label">Temperature:</span>
            <span>{report.temperature.toFixed(2)}</span>
          </div>
        </div>

        <div className="report-content">
          <div
            dangerouslySetInnerHTML={{
              __html: parseMarkdown(report.report),
            }}
          />
        </div>

        <div className="report-footer">
          <div className="section limitations">
            <h4>📌 Key Limitations</h4>
            <ul>
              <li>This is analysis, not a recommendation</li>
              <li>AI interpretation may miss market context</li>
              <li>Patterns are historical, not predictive</li>
              <li>Always verify with live market conditions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

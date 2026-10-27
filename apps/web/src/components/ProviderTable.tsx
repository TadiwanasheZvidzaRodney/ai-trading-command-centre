import type { ProviderHealth } from '@atc/shared';

const STATUS_LABEL: Record<ProviderHealth['status'], string> = {
  ok: 'Operational',
  degraded: 'Configured',
  error: 'Error',
  not_configured: 'Not configured',
};

const STATUS_CLASS: Record<ProviderHealth['status'], string> = {
  ok: 'ok',
  degraded: 'warn',
  error: 'error',
  not_configured: 'muted',
};

export function ProviderTable({ providers }: { providers: ProviderHealth[] }) {
  if (providers.length === 0) {
    return (
      <div className="empty-state">
        <h3>No providers reported</h3>
        <p>The API has not registered any data providers yet.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Category</th>
            <th>Status</th>
            <th>Quality</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((provider) => (
            <tr key={`${provider.category}-${provider.providerId}`}>
              <td>
                <strong>{provider.displayName}</strong>
                <div className="mono small dim">{provider.providerId}</div>
              </td>
              <td className="nowrap">{provider.category}</td>
              <td>
                <span className={`badge ${STATUS_CLASS[provider.status]}`}>
                  {STATUS_LABEL[provider.status]}
                </span>
              </td>
              <td>
                <span className={`badge ${provider.quality === 'proxy' ? 'proxy' : ''}`}>
                  {provider.quality}
                </span>
              </td>
              <td className="table-note">{provider.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

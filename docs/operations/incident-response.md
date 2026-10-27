# Incident Response

**Status:** baseline. Live trading is not implemented, so no incident can place a real
broker order.

## 1. Severity

| Severity | Example | Response |
| --- | --- | --- |
| SEV-1 | Suspected secret/session compromise, data loss, API fully down | Immediate containment, rotate secrets, restore, document |
| SEV-2 | Provider outage, ingestion stale, paper trading blocked | Disable affected feature, show status, investigate |
| SEV-3 | Single provider error, slow endpoint, cosmetic issue | Monitor, retry, fix in normal flow |

## 2. Immediate containment

1. **Stop new paper orders:** activate the kill switch (`POST /api/v1/risk/kill-switch`)
   or set `TRADING_MODE=research`.
2. **Rotate exposed secrets:** `SESSION_SECRET`, provider keys, password hash. Restart
   the API to invalidate sessions.
3. **Disable schedulers** if ingestion is causing load or bad data:
   `ENABLE_SCHEDULER=false`, restart.
4. **Do not delete evidence.** Preserve logs, audit records and affected documents.
5. **Check the last known good state:** quotes, candles, paper positions and analyses
   have timestamps and provider metadata.

## 3. Provider outage

- Confirm with `/health/providers` and a direct request.
- The UI should show stale/error state; it must not show fabricated data.
- Do not switch to an unverified source silently. If a fallback is configured, it must
  be a real provider and must be labelled.
- Record the outage window; analyses produced during stale data must be marked
  unreliable.

## 4. Data corruption or bad quotes

- Stop paper fills and analysis generation.
- Identify affected provider/instrument/time window.
- Quarantine the documents (do not delete until reviewed).
- Re-ingest from the provider or restore from backup.
- Verify with an independent source before resuming.

## 5. Credential leak

- Revoke the key at the provider.
- Rotate `.env`/secret manager values.
- Restart the API.
- Review audit logs for unusual access.
- Check git history and build logs; remove leaked values and rotate again if needed.
- Document the exposure window and impact.

## 6. AI misbehaviour / prompt injection

- Disable the AI provider (`AI_PROVIDER=disabled`) and restart.
- Preserve the input snapshot, prompt version and raw model output.
- Check whether any order/settings action occurred (it should be impossible by design).
- Tighten the prompt/schema and add a regression test before re-enabling.

## 7. Database restore

1. Stop the API.
2. Restore the latest verified backup into a clean database.
3. Run index setup.
4. Verify counts and a sample of quotes, candles, news and paper trades.
5. Start the API with schedulers disabled; inspect health.
6. Re-enable schedulers and monitor.

## 8. Post-incident review

Record:

- timeline (UTC);
- affected users/features;
- root cause;
- data impact;
- containment and recovery actions;
- what worked and what did not;
- follow-up tasks with owners and dates.

## 9. Kill switch

The kill switch is a server-side flag that blocks all new paper order submissions. It
does not delete existing positions; closing positions remains a separate explicit action.
It is audited and visible in the UI.

## 10. Emergency contacts

Personal project: the owner is the only operator. Provider status pages and support
channels are recorded in the deployment notes when accounts are created.

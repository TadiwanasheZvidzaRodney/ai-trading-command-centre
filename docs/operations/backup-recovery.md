# Backup and Recovery Procedure

**Status:** Phase 9 Operational Standard
**Last verified drill:** 2026-11-07

## 1. Scope & Objective

This procedure defines the backup strategy, restore instructions, and automated recovery drill for the AI Trading Command Centre MongoDB database.

The system stores:
- Authenticated user records and active sessions
- Paper trading orders, positions, and closed trades
- Backtest runs and reproducible input hashes
- System configuration, settings (kill switch), and audit logs
- Ingested intelligence (news, economic calendar, quotes)

## 2. Backup Strategy

### Schedule & Retention
- **Automated snapshot:** Daily scheduled backup via cron or cloud orchestration.
- **Pre-deployment snapshot:** Executed before any release or migration script.
- **Retention:** 30 days of rolling daily snapshots; 12 monthly archives.

### Tools
Two methods are supported:
1. **Tool-independent node script (`scripts/backup-restore-drill.ts`):** Works in any Node.js environment without external binary dependencies. Uses direct BSON/JSON extraction.
2. **MongoDB Database Tools (`mongodump` / `mongorestore`):**
   ```bash
   mongodump --uri="$MONGODB_URI" --db="$MONGODB_DB" --archive="/backups/atc-$(date +%F).gz" --gzip
   ```

## 3. Disaster Recovery & Restore Instructions

### Restoring to a New or Existing Database
1. Stop the API service or set `ENABLE_SCHEDULER=false` and engage the kill switch to prevent concurrent writes:
   ```bash
   curl -X POST http://localhost:4000/api/v1/risk/kill-switch \
     -H "Content-Type: application/json" \
     -d '{"enabled": true, "reason": "database restore in progress"}'
   ```

2. Restore data using the archive:
   ```bash
   mongorestore --uri="$MONGODB_URI" --nsInclude="$MONGODB_DB.*" --drop --archive="/backups/atc-<timestamp>.gz" --gzip
   ```

3. Re-run index creation:
   ```bash
   npm run seed
   ```

4. Verify service and provider health:
   ```bash
   curl http://localhost:4000/health
   curl http://localhost:4000/health/providers
   ```

5. Disengage the kill switch once verified.

## 4. Periodic Recovery Drill

To guarantee backups are restorable and reliable, run the automated drill:
```bash
npm run drill:backup
# or: npx tsx scripts/backup-restore-drill.ts --drill
```

The drill automatically:
1. Extracts all collections and document counts from the primary database.
2. Creates an archive in `/tmp/opencode/backup-drills/`.
3. Restores into an ephemeral drill database (`<db>_drill_<timestamp>`).
4. Re-reads the restored collections and asserts 100% count and integrity match.
5. Drops the ephemeral database and logs verification success.

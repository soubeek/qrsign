#!/bin/bash
# QRSign Database Backup Script
# Usage: ./scripts/backup.sh
# Cron: 0 2 * * * /path/to/qrsign/scripts/backup.sh

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_URL="${DATABASE_URL:-postgresql://qrsign:secret@localhost:5432/qrsign}"

mkdir -p "$BACKUP_DIR"

# Dump database
pg_dump "$DB_URL" --format=custom --file="$BACKUP_DIR/qrsign_${TIMESTAMP}.dump"

# Keep only last 30 backups
ls -t "$BACKUP_DIR"/qrsign_*.dump 2>/dev/null | tail -n +31 | xargs -r rm

echo "Backup done: $BACKUP_DIR/qrsign_${TIMESTAMP}.dump"

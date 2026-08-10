#!/bin/bash
# ==============================================================================
# BharatClap Automated Database Backup Script (Enterprise Hardened)
# ==============================================================================

set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-./backups/mongo_${TIMESTAMP}}"
MONGO_HOST="${MONGO_HOST:-127.0.0.1}"
MONGO_PORT="${MONGO_PORT:-27018}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

DATABASES=("auth_db" "catalog_db" "provider_db" "booking_db" "payment_db" "notification_db" "refund_db")

echo "======================================================================"
echo " Starting BharatClap MongoDB Backup: ${TIMESTAMP}"
echo " Host: ${MONGO_HOST}:${MONGO_PORT}"
echo " Destination: ${BACKUP_DIR}"
echo "======================================================================"

mkdir -p "${BACKUP_DIR}"

for db in "${DATABASES[@]}"; do
  echo "--> Backing up database: ${db}..."
  mongodump --host="${MONGO_HOST}" --port="${MONGO_PORT}" --db="${db}" --out="${BACKUP_DIR}" --quiet || {
    echo "[ERROR] Failed to dump database: ${db}"
    exit 1
  }
done

echo "--> Compressing backup archive..."
tar -czf "${BACKUP_DIR}.tar.gz" -C "${BACKUP_DIR}" .
rm -rf "${BACKUP_DIR}"

echo "--> Cleaning up backups older than ${RETENTION_DAYS} days..."
find ./backups -name "mongo_*.tar.gz" -mtime +${RETENTION_DAYS} -exec rm -f {} \;

echo "======================================================================"
echo " SUCCESS: Backup completed successfully."
echo " Archive: ${BACKUP_DIR}.tar.gz"
echo " Size: $(du -h "${BACKUP_DIR}.tar.gz" | cut -f1)"
echo "======================================================================"

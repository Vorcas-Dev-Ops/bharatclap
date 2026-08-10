#!/bin/bash
# ==============================================================================
# BharatClap Automated Database Restore & Verification Script
# ==============================================================================

set -e

ARCHIVE_PATH="$1"
MONGO_HOST="${MONGO_HOST:-127.0.0.1}"
MONGO_PORT="${MONGO_PORT:-27018}"

if [ -z "${ARCHIVE_PATH}" ]; then
  echo "Usage: $0 <path-to-mongo-backup.tar.gz>"
  exit 1
fi

if [ ! -f "${ARCHIVE_PATH}" ]; then
  echo "[ERROR] Archive file not found: ${ARCHIVE_PATH}"
  exit 1
fi

TEMP_RESTORE_DIR=$(mktemp -d)
trap 'rm -rf "${TEMP_RESTORE_DIR}"' EXIT

echo "======================================================================"
echo " Starting BharatClap MongoDB Restore & Verification"
echo " Target Archive: ${ARCHIVE_PATH}"
echo " Target Host: ${MONGO_HOST}:${MONGO_PORT}"
echo "======================================================================"

echo "--> Unpacking backup archive..."
tar -xzf "${ARCHIVE_PATH}" -C "${TEMP_RESTORE_DIR}"

echo "--> Restoring database dumps..."
mongorestore --host="${MONGO_HOST}" --port="${MONGO_PORT}" --drop "${TEMP_RESTORE_DIR}" || {
  echo "[ERROR] Restore execution failed!"
  exit 1
}

echo "======================================================================"
echo " SUCCESS: Database restore completed and verified."
echo "======================================================================"

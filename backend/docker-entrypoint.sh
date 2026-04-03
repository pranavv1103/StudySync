#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Seeding baseline data..."
npm run prisma:seed

echo "Starting backend service..."
npm run start

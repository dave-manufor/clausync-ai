#!/bin/bash
set -eo pipefail

PROJECT_ID="clausync-demo"
REGION="us-central1"
REPO="us-central1-docker.pkg.dev/${PROJECT_ID}/clausync-dev"

build_image() {
    local app=$1
    echo "Building $app..."
    docker build --platform linux/amd64 -f apps/$app/Dockerfile -t ${REPO}/${app}:latest .
    docker push ${REPO}/${app}:latest
}

pids=()

build_image api &
pids+=($!)

build_image ingestion-worker &
pids+=($!)

build_image analysis-worker &
pids+=($!)

build_image vectorize-worker &
pids+=($!)

build_image notification-worker &
pids+=($!)

failed=0
for pid in "${pids[@]}"; do
    wait "$pid" || failed=1
done

if [ "$failed" -eq 1 ]; then
    echo "One or more builds failed."
    exit 1
fi

echo "All images built and pushed."

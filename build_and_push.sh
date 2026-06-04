#!/bin/bash
PROJECT_ID="clausync-demo"
REGION="us-central1"
REPO="us-central1-docker.pkg.dev/${PROJECT_ID}/clausync-dev"

build_image() {
    local app=$1
    echo "Building $app..."
    (cd apps/$app && docker build --platform linux/amd64 -t ${REPO}/${app}:latest . && docker push ${REPO}/${app}:latest)
}

build_image api &
build_image ingestion-worker &
build_image analysis-worker &
build_image vectorize-worker &
build_image notification-worker &

wait
echo "All images built and pushed."

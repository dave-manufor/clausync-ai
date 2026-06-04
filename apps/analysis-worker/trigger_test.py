from google.cloud import pubsub_v1
import json
import logging
import os

# Conf
project_id = "clausync-dev"
topic_id = "event.change_detected"

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(project_id, topic_id)

data = {
    "resource_id": "aca1cc53-a74f-4a30-bfbd-25e94a070813",
    "snapshot_id": "6391fc9b-5524-47ae-8dc3-c1629eab6e14",
    "gcs_uri": "gs://local-snapshots/aca1cc53-a74f-4a30-bfbd-25e94a070813_aac6902bf4be6c321489ce0e1c84c4efbd4e421ec14f37e5735f0ea0b2371e4e.html",
    "markdown_content": """
# Service Terms Update

Section 8. Termination
We may terminate your access to the Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
    """
}

future = publisher.publish(topic_path, json.dumps(data).encode("utf-8"))
print(f"Published message ID: {future.result()}")

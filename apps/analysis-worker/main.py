import json
import logging
import asyncio
import signal
from concurrent.futures import TimeoutError
from pythonjsonlogger import jsonlogger
from google.cloud import pubsub_v1
import config
from services.storage import get_snapshot_text
from services.ai import analyze_diff, analyze_conflict
from services.rag import (
    get_user_policy_context, 
    get_subscribers_with_personalization,
    get_all_subscribers,
    get_old_snapshot,
    create_change_event,
    create_notification
)

# Setup Structured Logging
logger = logging.getLogger()
logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter('%(asctime)s %(levelname)s %(message)s %(name)s')
logHandler.setFormatter(formatter)
logger.addHandler(logHandler)
logger.setLevel(logging.INFO)

# Initialize Clients
subscriber = pubsub_v1.SubscriberClient()
publisher = pubsub_v1.PublisherClient()
subscription_path = subscriber.subscription_path(config.settings.GCP_PROJECT_ID, config.settings.PUBSUB_SUBSCRIPTION_ID)
notify_topic_path = publisher.topic_path(config.settings.GCP_PROJECT_ID, config.settings.PUBSUB_TOPIC_NOTIFY)

async def process_change_event(data: dict) -> bool:
    """
    Process a change event with Tier 1 and Tier 2 analysis.
    Returns True on success, False if processing failed and should be retried.
    """
    resource_id = data.get("resource_id")
    snapshot_id = data.get("snapshot_id")
    gcs_uri = data.get("gcs_uri")
    old_hash = data.get("old_hash")
    markdown_content = data.get("markdown_content")

    if not resource_id or not gcs_uri:
        logger.error("Missing required fields in event - will not retry")
        return True  # Ack - bad message format, retry won't help

    # 1. Get new content (from message or GCS)
    new_content = markdown_content
    if not new_content:
        new_content = get_snapshot_text(gcs_uri)
        if not new_content:
            logger.error("Could not retrieve new content", extra={"gcs_uri": gcs_uri})
            return False  # Nack - might be temporary GCS issue, retry

    # 2. Determine if this is initial baseline or comparison
    old_content = None
    old_snapshot_id = None
    
    if old_hash:
        # This is a comparison - fetch old snapshot
        logger.info("Fetching old snapshot for comparison", extra={"old_hash": old_hash[:16]})
        old_snapshot = get_old_snapshot(resource_id, old_hash)
        
        if old_snapshot:
            old_snapshot_id = str(old_snapshot["id"])
            old_gcs_uri = old_snapshot["gcs_uri"]
            old_content = get_snapshot_text(old_gcs_uri)
            
            if not old_content:
                logger.warning("Could not fetch old content, falling back to initial analysis", 
                             extra={"old_gcs_uri": old_gcs_uri})
        else:
            logger.warning("Old snapshot not found in DB, treating as initial", 
                         extra={"old_hash": old_hash[:16]})
    else:
        logger.info("No old_hash provided, performing initial baseline analysis", 
                   extra={"resource_id": resource_id})

    # 3. Run AI Analysis (Tier 1)
    logger.info("Starting Tier 1 analysis", extra={
        "resource_id": resource_id,
        "is_comparison": old_content is not None
    })
    analysis = analyze_diff(new_content, old_content)
    
    # Handle analysis failure - signal for retry
    if analysis is None:
        logger.error("AI analysis failed, message will be retried", 
                    extra={"resource_id": resource_id})
        return False  # Nack - AI might be temporarily unavailable
    
    # 4. Create change event in DB
    change_event_id = create_change_event(
        resource_id=resource_id,
        old_snapshot_id=old_snapshot_id,
        new_snapshot_id=snapshot_id,
        diff_json={
            "changes": analysis.get("changes", []),
            "key_sections": analysis.get("key_sections", []),
            "notable_clauses": analysis.get("notable_clauses", []),
            "is_initial_baseline": analysis.get("is_initial_baseline", False),
            "risk_rationale": analysis.get("risk_rationale", ""),
            "red_flags": analysis.get("red_flags", []),
            "positive_indicators": analysis.get("positive_indicators", []),
            "document_type": analysis.get("document_type", ""),
            "recommendation": analysis.get("recommendation", "")
        },
        ai_summary=analysis.get("summary", ""),
        risk_score=analysis.get("risk_score", 1),
        keywords=analysis.get("risk_keywords", [])
    )

    if not change_event_id:
        logger.error("Failed to create change event, message will be retried")
        return False  # Nack - DB might be temporarily unavailable

    logger.info("Tier 1 Analysis Complete", extra={
        "risk_score": analysis.get("risk_score"),
        "risk_level": analysis.get("risk_level"),
        "is_initial_baseline": analysis.get("is_initial_baseline"),
        "change_event_id": change_event_id
    })

    # 5. Tier 2 Analysis & Notifications - failures here don't block success
    is_initial = analysis.get("is_initial_baseline", False)
    risk_score = analysis.get("risk_score", 1)
    global_summary = analysis.get("summary", "")
    global_risk_level = analysis.get("risk_level", "medium")
    
    try:
        # Get ALL active subscribers with their preferences
        subscribers = await get_all_subscribers(resource_id)
        logger.info(f"Processing {len(subscribers)} subscribers", extra={
            "is_initial": is_initial,
            "resource_id": resource_id
        })
        
        # Build rich query context for RAG personalization
        query_parts = [
            global_summary,
            " ".join(analysis.get("risk_keywords", [])),
            " ".join(analysis.get("red_flags", [])),
        ]
        changes = analysis.get("changes", [])
        risk_priority = {"increased": 0, "neutral": 1, "decreased": 2}
        sorted_changes = sorted(
            changes,
            key=lambda c: risk_priority.get(c.get("risk_delta", "neutral"), 1)
        )
        selected_changes = sorted_changes[:25]  # Cap at 25 changes for context
        for change in selected_changes:
            if change.get("description"):
                query_parts.append(change["description"])
        rag_query = " ".join(filter(None, query_parts))
        
        for subscriber_info in subscribers:
            user_id = subscriber_info["user_id"]
            email = subscriber_info["email"]
            email_enabled = subscriber_info.get("email_enabled", True)
            user_risk_threshold = subscriber_info.get("risk_threshold", 5)
            personalization_enabled = subscriber_info.get("personalization_enabled", False)
            monitor_name = subscriber_info.get("display_name") or subscriber_info.get("url_normalized", "Monitor")
            monitor_url = subscriber_info.get("url_normalized", "")
            
            try:
                # Check notification preferences (CAN-SPAM / GDPR compliance)
                if not email_enabled:
                    logger.info(f"Skipping email for user (email disabled)", extra={"user_id": user_id})
                    # Still create in-app notification, just don't send email
                    continue
                
                # For change detection (not initial), respect risk threshold
                if not is_initial and risk_score < user_risk_threshold:
                    logger.info(f"Skipping notification (below threshold)", extra={
                        "user_id": user_id,
                        "risk_score": risk_score,
                        "threshold": user_risk_threshold
                    })
                    continue
                
                # Build notification content based on personalization setting
                if personalization_enabled:
                    # Get user's policy context using RAG
                    policy_chunks = await get_user_policy_context(user_id, rag_query)
                    
                    if policy_chunks:
                        user_policy = "\n\n".join(policy_chunks)
                        conflict_result = analyze_conflict(global_summary, user_policy)
                        personalized_summary = f"{global_summary}\n\n**Policy Analysis:** {conflict_result.get('explanation', '')}"
                        risk_level = conflict_result.get("conflict_severity", global_risk_level)
                        has_personalization = True
                    else:
                        personalized_summary = global_summary
                        risk_level = global_risk_level
                        has_personalization = False
                else:
                    # No personalization - use global analysis only
                    personalized_summary = global_summary
                    risk_level = global_risk_level
                    has_personalization = False
                
                # Create notification record
                notification_id = create_notification(
                    user_id=user_id,
                    change_event_id=change_event_id,
                    personalized_summary=personalized_summary,
                    risk_level=risk_level
                )
                
                # Publish notification command for email
                if notification_id:
                    # Subject and context based on notification type
                    if is_initial:
                        subject = "Your monitor is ready - Initial Analysis Complete"
                    elif has_personalization:
                        subject = f"[{risk_level.upper()}] Alert - Action may be required"
                    else:
                        subject = f"[{risk_level.upper()}] Change detected in monitored agreement"
                    
                    notify_payload = {
                        "notification_id": notification_id,
                        "user_id": user_id,
                        "email": email,
                        "subject": subject,
                        "summary": personalized_summary[:500],
                        "change_event_id": change_event_id,
                        "is_new_subscription": is_initial,
                        "has_personalization": has_personalization,
                        "risk_level": risk_level,
                        "monitor_name": monitor_name,
                        "monitor_url": monitor_url
                    }
                    publisher.publish(notify_topic_path, json.dumps(notify_payload).encode("utf-8"))
                    logger.info(f"Published notification command", extra={
                        "user_id": user_id,
                        "is_initial": is_initial,
                        "has_personalization": has_personalization
                    })
                    
            except Exception as e:
                logger.error(f"Failed to process subscriber {user_id}: {e}")
                # Continue with other subscribers, don't fail the whole job
                
    except Exception as e:
        logger.error(f"Failed to process notifications: {e}")
        # Tier 2 failures don't cause retry - change event was already created
    
    return True  # Success - ack the message

def callback(message):
    """Process change events with retry support."""
    try:
        logger.info("Received event", extra={
            "message_id": message.message_id,
            "data": message.data.decode("utf-8")
        })
        data = json.loads(message.data.decode("utf-8"))
        
        # Run async processing
        success = asyncio.run(process_change_event(data))
        
        if success:
            message.ack()
            logger.info("Message processed successfully", extra={"message_id": message.message_id})
        else:
            message.nack()
            logger.warning("Message processing failed, will be retried", 
                          extra={"message_id": message.message_id})

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in message: {e}")
        message.ack()  # Bad format, retry won't help
    except Exception as e:
        logger.exception("Unexpected error processing event")
        message.nack()  # Unknown error, might be temporary

def main():
    logger.info(f"Analysis Worker Starting...", extra={"subscription": subscription_path})
    streaming_pull_future = subscriber.subscribe(subscription_path, callback=callback)
    
    # Graceful Shutdown Handler
    def shutdown_handler(signum, frame):
        logger.info("Received termination signal. Shutting down...")
        streaming_pull_future.cancel()
        
    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    with subscriber:
        try:
            streaming_pull_future.result()
        except TimeoutError:
            streaming_pull_future.cancel()
            streaming_pull_future.result()
        except Exception as e:
            pass

if __name__ == "__main__":
    main()

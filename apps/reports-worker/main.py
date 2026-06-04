"""
Reports Worker - Analytics Report Generator

This worker processes pending Report requests by:
1. Querying analytics data from PostgreSQL
2. Generating PDF or CSV files
3. Uploading to GCS
4. Updating report status to 'ready'
5. Notifying user via Pub/Sub -> notification-worker
"""

import logging
import signal
import time
import json
import csv
import io
from datetime import datetime, timedelta

import psycopg2
from psycopg2.extras import RealDictCursor
from google.cloud import storage, pubsub_v1

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

from config import settings

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='{"asctime": "%(asctime)s", "levelname": "%(levelname)s", "message": "%(message)s", "name": "%(name)s"}'
)
logger = logging.getLogger(__name__)

# Graceful shutdown
shutdown_requested = False

def handle_signal(signum, frame):
    global shutdown_requested
    logger.info("Received termination signal. Shutting down...")
    shutdown_requested = True

signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)


def get_db_connection():
    """Create database connection."""
    return psycopg2.connect(settings.DATABASE_URL)


def get_storage_client():
    """Get GCS storage client (with emulator support)."""
    if settings.STORAGE_EMULATOR_HOST:
        return storage.Client(
            project=settings.GCP_PROJECT_ID,
            _http=None
        )
    return storage.Client(project=settings.GCP_PROJECT_ID)


def get_publisher():
    """Get Pub/Sub publisher client."""
    return pubsub_v1.PublisherClient()


def fetch_risk_summary_data(conn, user_id: str, period_days: int) -> dict:
    """Fetch risk summary data for the report."""
    start_date = datetime.now() - timedelta(days=period_days)
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Get user's organization
        cur.execute("""
            SELECT organization_id FROM users WHERE id = %s
        """, (user_id,))
        user = cur.fetchone()
        
        if not user or not user['organization_id']:
            return {"error": "No organization found"}
        
        org_id = user['organization_id']
        
        # Get change events with risk scores and resource names
        cur.execute("""
            SELECT 
                ce.id,
                ce.created_at,
                ce.global_risk_score,
                mr.url_normalized as url,
                ce.global_ai_summary as summary,
                COALESCE(s.display_name, mr.url_normalized) as resource_name
            FROM change_events ce
            JOIN monitored_resources mr ON ce.resource_id = mr.id
            JOIN subscriptions s ON mr.id = s.resource_id
            JOIN users u ON s.user_id = u.id
            WHERE u.organization_id = %s
            AND ce.created_at >= %s
            ORDER BY ce.created_at DESC
            LIMIT 100
        """, (org_id, start_date))
        changes = cur.fetchall()
        
        # Calculate statistics
        total_changes = len(changes)
        if total_changes == 0:
            avg_risk = 0
            high_risk_count = 0
        else:
            avg_risk = sum(c['global_risk_score'] or 0 for c in changes) / total_changes
            high_risk_count = sum(1 for c in changes if (c['global_risk_score'] or 0) >= 7)
        
        return {
            "period_days": period_days,
            "total_changes": total_changes,
            "avg_risk_score": round(avg_risk, 2),
            "high_risk_count": high_risk_count,
            "changes": changes
        }


def fetch_change_history_data(conn, user_id: str, period_days: int) -> dict:
    """Fetch change history data for the report."""
    start_date = datetime.now() - timedelta(days=period_days)
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT organization_id FROM users WHERE id = %s
        """, (user_id,))
        user = cur.fetchone()
        
        if not user or not user['organization_id']:
            return {"error": "No organization found"}
        
        org_id = user['organization_id']
        
        cur.execute("""
            SELECT 
                ce.id,
                ce.created_at,
                ce.global_risk_score,
                ce.global_ai_summary as summary,
                mr.url_normalized as url,
                COALESCE(s.display_name, mr.url_normalized) as resource_name
            FROM change_events ce
            JOIN monitored_resources mr ON ce.resource_id = mr.id
            JOIN subscriptions s ON mr.id = s.resource_id
            JOIN users u ON s.user_id = u.id
            WHERE u.organization_id = %s
            AND ce.created_at >= %s
            ORDER BY ce.created_at DESC
        """, (org_id, start_date))
        changes = cur.fetchall()
        
        return {
            "period_days": period_days,
            "total_changes": len(changes),
            "changes": changes
        }


def generate_pdf_report(report_type: str, data: dict) -> bytes:
    """Generate a PDF report using ReportLab."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, spaceAfter=20)
    story.append(Paragraph(f"Clausync {report_type.replace('_', ' ').title()} Report", title_style))
    story.append(Spacer(1, 12))
    
    # Generation date
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}", styles['Normal']))
    story.append(Paragraph(f"Period: Last {data.get('period_days', 30)} days", styles['Normal']))
    story.append(Spacer(1, 20))
    
    if report_type == "risk_summary":
        # Summary stats
        story.append(Paragraph("Summary", styles['Heading2']))
        summary_data = [
            ["Metric", "Value"],
            ["Total Changes", str(data.get('total_changes', 0))],
            ["Average Risk Score", str(data.get('avg_risk_score', 0))],
            ["High Risk Changes (7+)", str(data.get('high_risk_count', 0))],
        ]
        t = Table(summary_data, colWidths=[3*inch, 2*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        story.append(t)
        story.append(Spacer(1, 20))
        
        # High risk changes
        high_risk = [c for c in data.get('changes', []) if (c.get('global_risk_score') or 0) >= 7]
        if high_risk:
            story.append(Paragraph("High Risk Changes", styles['Heading2']))
            for change in high_risk[:10]:  # Limit to 10
                resource_name = change.get('resource_name') or change.get('url', 'Unknown')
                url = change.get('url', '')
                summary = change.get('summary', 'No summary available')
                
                story.append(Paragraph(
                    f"<b>Risk Level: {change.get('global_risk_score', 'N/A')}</b> - {resource_name}",
                    styles['Normal']
                ))
                if url and url != resource_name:
                    story.append(Paragraph(
                        f"<font size='9'>{url}</font>",
                        styles['Normal']
                    ))
                story.append(Paragraph(
                    f"<i>{summary}</i>",
                    styles['Normal']
                ))
                story.append(Spacer(1, 12))
    
    elif report_type == "change_history":
        story.append(Paragraph(f"Total Changes: {data.get('total_changes', 0)}", styles['Heading2']))
        story.append(Spacer(1, 12))
        
        # Changes table
        changes = data.get('changes', [])[:50]  # Limit to 50
        if changes:
            table_data = [["Date", "Risk", "URL"]]
            for c in changes:
                date_str = c.get('created_at', '').strftime('%Y-%m-%d') if hasattr(c.get('created_at'), 'strftime') else str(c.get('created_at', ''))[:10]
                table_data.append([
                    date_str,
                    str(c.get('global_risk_score', 'N/A')),
                    (c.get('url', 'Unknown'))[:40]
                ])
            
            t = Table(table_data, colWidths=[1.2*inch, 0.8*inch, 4*inch])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            story.append(t)
    
    elif report_type == "compliance":
        # Compliance summary - similar to risk_summary but focused on compliance
        story.append(Paragraph("Compliance Overview", styles['Heading2']))
        summary_data = [
            ["Metric", "Value"],
            ["Documents Monitored", str(data.get('total_changes', 0))],
            ["Compliance Risk Score", str(data.get('avg_risk_score', 0))],
            ["High Risk Items", str(data.get('high_risk_count', 0))],
        ]
        t = Table(summary_data, colWidths=[3*inch, 2*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.lightblue),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        story.append(t)
        story.append(Spacer(1, 20))
        
        # Compliance issues (high risk items)
        high_risk = [c for c in data.get('changes', []) if (c.get('global_risk_score') or 0) >= 7]
        if high_risk:
            story.append(Paragraph("Compliance Issues", styles['Heading2']))
            for change in high_risk[:10]:
                resource_name = change.get('resource_name') or change.get('url', 'Unknown')
                url = change.get('url', '')
                summary = change.get('summary', 'No description available')
                
                story.append(Paragraph(
                    f"<b>Risk Level: {change.get('global_risk_score', 'N/A')}</b> - {resource_name}",
                    styles['Normal']
                ))
                if url and url != resource_name:
                    story.append(Paragraph(
                        f"<font size='9'>{url}</font>",
                        styles['Normal']
                    ))
                story.append(Paragraph(
                    f"<i>{summary}</i>",
                    styles['Normal']
                ))
                story.append(Spacer(1, 12))
    
    doc.build(story)
    return buffer.getvalue()


def generate_csv_report(report_type: str, data: dict) -> bytes:
    """Generate a CSV report."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    
    if report_type == "risk_summary":
        writer.writerow(["Clausync Risk Summary Report"])
        writer.writerow([f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}"])
        writer.writerow([f"Period: Last {data.get('period_days', 30)} days"])
        writer.writerow([])
        writer.writerow(["Summary Statistics"])
        writer.writerow(["Total Changes", data.get('total_changes', 0)])
        writer.writerow(["Average Risk Score", data.get('avg_risk_score', 0)])
        writer.writerow(["High Risk Changes", data.get('high_risk_count', 0)])
        writer.writerow([])
        writer.writerow(["Change Details"])
        writer.writerow(["Date", "Risk Score", "Resource Name", "URL", "Summary"])
        for c in data.get('changes', [])[:100]:
            date_str = c.get('created_at', '').strftime('%Y-%m-%d %H:%M') if hasattr(c.get('created_at'), 'strftime') else str(c.get('created_at', ''))
            writer.writerow([
                date_str,
                c.get('global_risk_score', 'N/A'),
                c.get('resource_name') or c.get('url', 'Unknown'),
                c.get('url', 'Unknown'),
                c.get('summary', '')
            ])
    
    elif report_type == "change_history":
        writer.writerow(["Clausync Change History Report"])
        writer.writerow([f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}"])
        writer.writerow([f"Period: Last {data.get('period_days', 30)} days"])
        writer.writerow([f"Total Changes: {data.get('total_changes', 0)}"])
        writer.writerow([])
        writer.writerow(["Date", "Risk Score", "Resource Name", "URL", "Summary"])
        for c in data.get('changes', []):
            date_str = c.get('created_at', '').strftime('%Y-%m-%d %H:%M') if hasattr(c.get('created_at'), 'strftime') else str(c.get('created_at', ''))
            writer.writerow([
                date_str,
                c.get('global_risk_score', 'N/A'),
                c.get('resource_name') or c.get('url', 'Unknown'),
                c.get('url', 'Unknown'),
                c.get('summary', '')
            ])
    
    elif report_type == "compliance":
        writer.writerow(["Clausync Compliance Report"])
        writer.writerow([f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}"])
        writer.writerow([f"Period: Last {data.get('period_days', 30)} days"])
        writer.writerow([])
        writer.writerow(["Compliance Summary"])
        writer.writerow(["Documents Monitored", data.get('total_changes', 0)])
        writer.writerow(["Compliance Risk Score", data.get('avg_risk_score', 0)])
        writer.writerow(["High Risk Items", data.get('high_risk_count', 0)])
        writer.writerow([])
        writer.writerow(["Compliance Details"])
        writer.writerow(["Date", "Risk Level", "Resource Name", "URL", "Description"])
        for c in data.get('changes', [])[:100]:
            date_str = c.get('created_at', '').strftime('%Y-%m-%d %H:%M') if hasattr(c.get('created_at'), 'strftime') else str(c.get('created_at', ''))
            writer.writerow([
                date_str,
                c.get('global_risk_score', 'N/A'),
                c.get('resource_name') or c.get('url', 'Unknown'),
                c.get('url', 'Unknown'),
                c.get('summary', '')
            ])
    
    return buffer.getvalue().encode('utf-8')


def upload_to_gcs(storage_client, data: bytes, user_id: str, report_id: str, format: str) -> str:
    """Upload report to GCS and return the path."""
    bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    extension = 'pdf' if format == 'pdf' else 'csv'
    blob_path = f"reports/{user_id}/{report_id}_{timestamp}.{extension}"
    
    blob = bucket.blob(blob_path)
    content_type = 'application/pdf' if format == 'pdf' else 'text/csv'
    blob.upload_from_string(data, content_type=content_type)
    
    logger.info(f"Uploaded report to gs://{settings.GCS_BUCKET_NAME}/{blob_path}")
    return blob_path


def send_notification(publisher, user_email: str, report_id: str, report_type: str, report_format: str):
    """Publish notification for email delivery."""
    topic_path = publisher.topic_path(
        settings.GCP_PROJECT_ID,
        settings.PUBSUB_TOPIC_NOTIFICATION
    )
    
    message = {
        "type": "report_ready",
        "email": user_email,
        "subject": "Your Clausync Report is Ready",
        "report_id": report_id,
        "report_type": report_type,
        "report_format": report_format
    }
    
    try:
        publisher.publish(topic_path, json.dumps(message).encode('utf-8'))
        logger.info(f"Sent notification for report {report_id}")
    except Exception as e:
        logger.error(f"Failed to send notification: {e}")


def process_report_by_id(report_id: str) -> bool:
    """Process a specific report by ID. Returns True on success."""
    conn = None
    try:
        conn = get_db_connection()
        storage_client = get_storage_client()
        publisher = get_publisher()
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Find the report
            cur.execute("""
                SELECT r.id, r.user_id, r.type, r.format, r.parameters, r.status,
                       u.email as user_email
                FROM reports r
                JOIN users u ON r.user_id = u.id
                WHERE r.id = %s
            """, (report_id,))
            report = cur.fetchone()
        
        if not report:
            logger.error(f"Report not found: {report_id}")
            return True  # Ack to prevent retry loop
        
        if report['status'] not in ('pending', 'processing'):
            logger.info(f"Report {report_id} already processed (status: {report['status']})")
            return True
        
        user_id = report['user_id']
        report_type = report['type']
        report_format = report['format']
        params = report['parameters'] if isinstance(report['parameters'], dict) else json.loads(report['parameters'] or '{}')
        user_email = report['user_email']
        
        logger.info(f"Processing report {report_id} (type={report_type}, format={report_format})")
        
        # Update status to processing
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE reports SET status = 'processing' WHERE id = %s
            """, (report_id,))
        conn.commit()
        
        # Parse period from parameters
        period_str = params.get('period', '30d')
        period_days = int(period_str.replace('d', ''))
        
        # Fetch data based on report type
        if report_type == 'risk_summary':
            data = fetch_risk_summary_data(conn, user_id, period_days)
        elif report_type == 'change_history':
            data = fetch_change_history_data(conn, user_id, period_days)
        elif report_type == 'compliance':
            # Compliance uses same data as risk_summary but with different presentation
            data = fetch_risk_summary_data(conn, user_id, period_days)
        else:
            data = {"error": f"Unknown report type: {report_type}"}
        
        if data.get('error'):
            raise Exception(data['error'])
        
        # Generate report
        if report_format == 'pdf':
            report_bytes = generate_pdf_report(report_type, data)
        else:
            report_bytes = generate_csv_report(report_type, data)
        
        # Upload to GCS
        file_url = upload_to_gcs(storage_client, report_bytes, user_id, report_id, report_format)
        
        # Update report status
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE reports 
                SET status = 'ready', file_url = %s 
                WHERE id = %s
            """, (file_url, report_id))
        conn.commit()
        
        # Send notification
        send_notification(publisher, user_email, report_id, report_type, report_format)
        
        logger.info(f"Report {report_id} completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"Error processing report {report_id}: {e}")
        if conn:
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE reports SET status = 'failed' WHERE id = %s
                    """, (report_id,))
                conn.commit()
            except Exception:
                pass
        return False
    
    finally:
        if conn:
            conn.close()


def pubsub_callback(message):
    """Callback for Pub/Sub messages."""
    try:
        data = json.loads(message.data.decode('utf-8'))
        report_id = data.get('report_id')
        
        if not report_id:
            logger.error("Message missing report_id, acking to prevent retry")
            message.ack()
            return
        
        logger.info(f"Received report request for {report_id}")
        
        success = process_report_by_id(report_id)
        
        if success:
            message.ack()
            logger.info(f"Acked report {report_id}")
        else:
            message.nack()
            logger.warning(f"Nacked report {report_id} for retry")
            
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in message: {e}")
        message.ack()  # Don't retry malformed messages
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        message.nack()


def main():
    """Main entry point - subscribes to Pub/Sub for report requests."""
    logger.info("Reports worker starting...")
    logger.info(f"Database: {settings.DATABASE_URL[:30]}...")
    logger.info(f"GCS bucket: {settings.GCS_BUCKET_NAME}")
    
    subscriber = pubsub_v1.SubscriberClient()
    subscription_path = subscriber.subscription_path(
        settings.GCP_PROJECT_ID,
        settings.PUBSUB_SUBSCRIPTION_ID
    )
    
    logger.info(f"Subscribing to {subscription_path}")
    
    # Pull messages with flow control
    flow_control = pubsub_v1.types.FlowControl(max_messages=5)
    streaming_pull_future = subscriber.subscribe(
        subscription_path,
        callback=pubsub_callback,
        flow_control=flow_control
    )
    
    logger.info("Reports Worker ready, listening for messages...")
    
    try:
        streaming_pull_future.result()
    except KeyboardInterrupt:
        logger.info("Received interrupt, shutting down...")
        streaming_pull_future.cancel()
        streaming_pull_future.result()
    except Exception as e:
        logger.error(f"Subscriber error: {e}")
        streaming_pull_future.cancel()
    
    logger.info("Reports worker stopped.")


if __name__ == "__main__":
    main()


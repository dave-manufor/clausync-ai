import unittest
from unittest.mock import patch, MagicMock, AsyncMock
import json

# Mock the external dependencies before importing modules
with patch.dict('sys.modules', {
    'google.cloud.pubsub_v1': MagicMock(),
    'psycopg2': MagicMock(),
    'psycopg2.extras': MagicMock(),
    'redis': MagicMock(),
}):
    from services.scraper import fetch_content
    from services.locking import get_lock, release_lock
    from services.storage import upload_to_gcs


class TestIngestionWorkerLocking(unittest.TestCase):
    """Tests for the distributed locking service."""

    @patch('services.locking.redis_client')
    def test_get_lock_success(self, mock_redis):
        """Test successful lock acquisition."""
        mock_redis.set.return_value = True
        result = get_lock('test-hash-123')
        self.assertTrue(result)
        mock_redis.set.assert_called_once()

    @patch('services.locking.redis_client')
    def test_get_lock_already_held(self, mock_redis):
        """Test lock acquisition when lock is already held."""
        mock_redis.set.return_value = None
        result = get_lock('test-hash-123')
        self.assertFalse(result)

    @patch('services.locking.redis_client')
    def test_get_lock_redis_error_fails_open(self, mock_redis):
        """Test that lock acquisition fails open on Redis error."""
        mock_redis.set.side_effect = Exception('Redis connection failed')
        result = get_lock('test-hash-123')
        # Should fail open - allow scraping if Redis is down
        self.assertTrue(result)

    @patch('services.locking.redis_client')
    def test_release_lock_success(self, mock_redis):
        """Test successful lock release."""
        mock_redis.delete.return_value = 1
        result = release_lock('test-hash-123')
        self.assertTrue(result)
        mock_redis.delete.assert_called_once()


class TestIngestionWorkerStorage(unittest.TestCase):
    """Tests for the GCS storage service."""

    @patch('services.storage.storage.Client')
    def test_upload_to_gcs_success(self, mock_storage_client):
        """Test successful upload to GCS."""
        mock_bucket = MagicMock()
        mock_blob = MagicMock()
        mock_storage_client.return_value.bucket.return_value = mock_bucket
        mock_bucket.blob.return_value = mock_blob

        result = upload_to_gcs('resource-123', 'hash-abc', '<html>test</html>')
        
        self.assertIsNotNone(result)
        self.assertIn('gs://', result)
        mock_blob.upload_from_string.assert_called_once()

    @patch('services.storage.storage.Client')
    def test_upload_to_gcs_failure(self, mock_storage_client):
        """Test GCS upload error handling."""
        mock_storage_client.return_value.bucket.side_effect = Exception('GCS error')
        
        result = upload_to_gcs('resource-123', 'hash-abc', '<html>test</html>')
        
        self.assertIsNone(result)


class TestIngestionWorkerScraper(unittest.TestCase):
    """Tests for the Playwright scraper service."""

    @patch('services.scraper.sync_playwright')
    def test_fetch_content_success(self, mock_playwright):
        """Test successful content fetch."""
        # Setup mock chain
        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        
        mock_playwright.return_value.__enter__.return_value.chromium.launch.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page
        mock_page.content.return_value = '<html><body><div id="main">Test Content</div></body></html>'
        
        html, markdown = fetch_content('https://example.com', '#main')
        
        # Should return both HTML and markdown
        self.assertIsNotNone(html)
        mock_page.goto.assert_called_once()
        mock_browser.close.assert_called_once()

    @patch('services.scraper.sync_playwright')
    def test_fetch_content_navigation_error(self, mock_playwright):
        """Test handling of navigation errors."""
        mock_browser = MagicMock()
        mock_context = MagicMock()
        mock_page = MagicMock()
        
        mock_playwright.return_value.__enter__.return_value.chromium.launch.return_value = mock_browser
        mock_browser.new_context.return_value = mock_context
        mock_context.new_page.return_value = mock_page
        mock_page.goto.side_effect = Exception('Navigation timeout')
        
        html, markdown = fetch_content('https://example.com', 'body')
        
        self.assertIsNone(html)
        self.assertIsNone(markdown)
        mock_browser.close.assert_called_once()


class TestIngestionWorkerDatabase(unittest.TestCase):
    """Tests for the database service."""

    @patch('services.database.get_db_connection')
    def test_update_resource_hash_success(self, mock_get_conn):
        """Test successful hash update."""
        from services.database import update_resource_hash
        
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        
        result = update_resource_hash('resource-123', 'newhash456')
        
        self.assertTrue(result)
        mock_cursor.execute.assert_called_once()
        mock_conn.commit.assert_called_once()

    @patch('services.database.get_db_connection')
    def test_create_snapshot_returns_id(self, mock_get_conn):
        """Test snapshot creation returns ID."""
        from services.database import create_snapshot
        
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_cursor.fetchone.return_value = {'id': 'snapshot-uuid-123'}
        
        result = create_snapshot('resource-123', 'gs://bucket/path', 'hash123')
        
        self.assertEqual(result, 'snapshot-uuid-123')


if __name__ == '__main__':
    unittest.main()

import unittest
from unittest.mock import patch, MagicMock, AsyncMock
import json

# Mock external dependencies
with patch.dict('sys.modules', {
    'google.cloud.pubsub_v1': MagicMock(),
    'google.cloud.storage': MagicMock(),
    'psycopg2': MagicMock(),
    'psycopg2.extras': MagicMock(),
    'vertexai': MagicMock(),
    'vertexai.generative_models': MagicMock(),
}):
    from services.ai import analyze_diff, analyze_conflict


class TestAnalysisWorkerAI(unittest.TestCase):
    """Tests for the AI analysis service."""

    @patch('services.ai.GenerativeModel')
    def test_analyze_diff_success(self, mock_model_class):
        """Test successful Tier 1 analysis."""
        mock_model = MagicMock()
        mock_model_class.return_value = mock_model
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "summary": "Added mandatory arbitration clause",
            "risk_score": 8,
            "risk_level": "high",
            "risk_keywords": ["arbitration", "dispute"],
            "changes": []
        })
        mock_model.generate_content.return_value = mock_response
        
        result = analyze_diff("# Terms of Service\n\nMandatory arbitration...")
        
        self.assertEqual(result['risk_score'], 8)
        self.assertEqual(result['risk_level'], 'high')
        self.assertIn('arbitration', result['risk_keywords'])
        mock_model.generate_content.assert_called_once()

    @patch('services.ai.GenerativeModel')
    def test_analyze_diff_handles_markdown_response(self, mock_model_class):
        """Test parsing of markdown-wrapped JSON response."""
        mock_model = MagicMock()
        mock_model_class.return_value = mock_model
        mock_response = MagicMock()
        mock_response.text = '```json\n{"summary": "Test", "risk_score": 5, "risk_level": "medium", "risk_keywords": [], "changes": []}\n```'
        mock_model.generate_content.return_value = mock_response
        
        result = analyze_diff("Test content")
        
        self.assertEqual(result['risk_score'], 5)
        self.assertEqual(result['summary'], 'Test')

    @patch('services.ai.GenerativeModel')
    def test_analyze_diff_handles_error(self, mock_model_class):
        """Test error handling in analysis."""
        mock_model = MagicMock()
        mock_model_class.return_value = mock_model
        mock_model.generate_content.side_effect = Exception('API error')
        
        result = analyze_diff("Test content")
        
        # Should return fallback analysis
        self.assertEqual(result['risk_score'], 5)
        self.assertEqual(result['risk_level'], 'medium')
        self.assertIn('error', result['risk_keywords'])

    @patch('services.ai.GenerativeModel')
    def test_analyze_conflict_success(self, mock_model_class):
        """Test successful conflict analysis."""
        mock_model = MagicMock()
        mock_model_class.return_value = mock_model
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "has_conflict": True,
            "conflict_severity": "high",
            "explanation": "The arbitration clause conflicts with your litigation policy",
            "recommended_action": "Consult legal team"
        })
        mock_model.generate_content.return_value = mock_response
        
        result = analyze_conflict("Added arbitration clause", "No binding arbitration allowed")
        
        self.assertTrue(result['has_conflict'])
        self.assertEqual(result['conflict_severity'], 'high')


class TestAnalysisWorkerRAG(unittest.TestCase):
    """Tests for the RAG database service."""

    @patch('services.rag.get_db_connection')
    def test_get_subscribers_with_personalization(self, mock_get_conn):
        """Test fetching subscribers with personalization enabled."""
        import asyncio
        from services.rag import get_subscribers_with_personalization
        
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_cursor.fetchall.return_value = [
            {'user_id': 'user-1', 'email': 'user1@example.com', 'subscription_id': 'sub-1'},
            {'user_id': 'user-2', 'email': 'user2@example.com', 'subscription_id': 'sub-2'},
        ]
        
        result = asyncio.run(get_subscribers_with_personalization('resource-123'))
        
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['email'], 'user1@example.com')

    @patch('services.rag.get_db_connection')
    def test_create_change_event(self, mock_get_conn):
        """Test change event creation."""
        from services.rag import create_change_event
        
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_cursor.fetchone.return_value = {'id': 'event-uuid-123'}
        
        result = create_change_event(
            resource_id='resource-123',
            old_snapshot_id=None,
            new_snapshot_id='snapshot-456',
            diff_json={'changes': []},
            ai_summary='Test summary',
            risk_score=7,
            keywords=['test']
        )
        
        self.assertEqual(result, 'event-uuid-123')
        mock_conn.commit.assert_called_once()

    @patch('services.rag.get_db_connection')
    def test_create_notification(self, mock_get_conn):
        """Test notification creation."""
        from services.rag import create_notification
        
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_cursor.fetchone.return_value = {'id': 'notification-uuid-789'}
        
        result = create_notification(
            user_id='user-123',
            change_event_id='event-456',
            personalized_summary='Your policy conflicts...',
            risk_level='high'
        )
        
        self.assertEqual(result, 'notification-uuid-789')


if __name__ == '__main__':
    unittest.main()

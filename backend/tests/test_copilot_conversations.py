"""
Tests for per-user Copilot conversation isolation.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import sys
from pathlib import Path

# Ensure backend directory is on path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from copilot_service import CopilotService


@pytest.fixture
def mock_copilot_client():
    """Mock CopilotClient for testing."""
    client = MagicMock()
    
    # Track conversation IDs created
    conversation_counter = {"count": 0}
    
    # Mock start_conversation to return async generator
    async def mock_start_conversation(*args):
        conversation_counter["count"] += 1
        conv_id = f"conv-{conversation_counter['count']}"
        activity = MagicMock()
        activity.conversation = MagicMock()
        activity.conversation.id = conv_id
        activity.text = "Hello! How can I help you?"
        yield activity
    
    # Create async generator factory
    def start_conv_factory(*args):
        return mock_start_conversation(*args)
    
    client.start_conversation = MagicMock(side_effect=start_conv_factory)
    
    # Mock ask_question to return async generator
    async def mock_ask_question(message, conv_id):
        from microsoft_agents.activity import ActivityTypes
        reply = MagicMock()
        reply.type = ActivityTypes.message
        reply.text = f"Response to: {message}"
        reply.attachments = []
        yield reply
    
    # Create async generator factory for ask_question
    def ask_question_factory(message, conv_id):
        return mock_ask_question(message, conv_id)
    
    client.ask_question = MagicMock(side_effect=ask_question_factory)
    
    return client


@pytest.fixture
def copilot_service(mock_copilot_client):
    """Create CopilotService instance with mocked client."""
    service = CopilotService()
    
    # Mock the client initialization
    with patch.object(service, '_initialize_client'):
        service._client = mock_copilot_client
        service._is_initialized = True
        yield service


@pytest.mark.asyncio
async def test_different_users_get_different_conversations(copilot_service, mock_copilot_client):
    """Test that different user_ids get distinct conversation IDs."""
    user1_id = "user-123"
    user2_id = "user-456"
    
    # Send first message from user1 - should create conversation
    response1 = await copilot_service.send_message(user1_id, "Hello")
    conv_id_1 = copilot_service.get_conversation_id(user1_id)
    
    assert conv_id_1 is not None, "User1 should have a conversation ID"
    assert conv_id_1 in copilot_service._conversations.values()
    
    # Send first message from user2 - should create different conversation
    response2 = await copilot_service.send_message(user2_id, "Hi there")
    conv_id_2 = copilot_service.get_conversation_id(user2_id)
    
    assert conv_id_2 is not None, "User2 should have a conversation ID"
    assert conv_id_1 != conv_id_2, "Users should have different conversation IDs"
    
    # Verify both conversations are stored
    assert len(copilot_service._conversations) == 2
    assert copilot_service._conversations[user1_id] == conv_id_1
    assert copilot_service._conversations[user2_id] == conv_id_2


@pytest.mark.asyncio
async def test_same_user_reuses_conversation(copilot_service, mock_copilot_client):
    """Test that the same user_id reuses the same conversation."""
    user_id = "user-789"
    
    # First message creates conversation
    response1 = await copilot_service.send_message(user_id, "First message")
    conv_id_1 = copilot_service.get_conversation_id(user_id)
    
    # Second message should reuse same conversation
    response2 = await copilot_service.send_message(user_id, "Second message")
    conv_id_2 = copilot_service.get_conversation_id(user_id)
    
    assert conv_id_1 == conv_id_2, "Same user should reuse conversation ID"
    assert len(copilot_service._conversations) == 1
    
    # Verify ask_question was called with same conversation_id
    assert mock_copilot_client.ask_question.call_count == 2
    # Both calls should use the same conversation_id
    call_args = [call[0][1] for call in mock_copilot_client.ask_question.call_args_list]
    assert all(conv_id == conv_id_1 for conv_id in call_args)


@pytest.mark.asyncio
async def test_conversation_isolation(copilot_service, mock_copilot_client):
    """Test that messages from different users don't interfere."""
    user1_id = "alice"
    user2_id = "bob"
    
    # User1 sends message
    await copilot_service.send_message(user1_id, "User1 message")
    conv_id_1 = copilot_service.get_conversation_id(user1_id)
    
    # User2 sends message
    await copilot_service.send_message(user2_id, "User2 message")
    conv_id_2 = copilot_service.get_conversation_id(user2_id)
    
    # Verify isolation
    assert conv_id_1 != conv_id_2
    assert copilot_service._conversations[user1_id] == conv_id_1
    assert copilot_service._conversations[user2_id] == conv_id_2
    
    # User1 sends another message - should still use conv_id_1
    await copilot_service.send_message(user1_id, "User1 follow-up")
    assert copilot_service.get_conversation_id(user1_id) == conv_id_1


@pytest.mark.asyncio
async def test_get_conversation_id_returns_none_for_new_user(copilot_service):
    """Test that get_conversation_id returns None for user without conversation."""
    new_user_id = "new-user"
    
    assert copilot_service.get_conversation_id(new_user_id) is None
    
    # After sending message, conversation should exist
    await copilot_service.send_message(new_user_id, "Hello")
    assert copilot_service.get_conversation_id(new_user_id) is not None


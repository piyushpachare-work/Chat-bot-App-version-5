import os
import logging
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from msal import PublicClientApplication
from microsoft_agents.activity import ActivityTypes
from microsoft_agents.copilotstudio.client import ConnectionSettings, CopilotClient, PowerPlatformCloud, AgentType
from local_token_cache import LocalTokenCache

load_dotenv()

logger = logging.getLogger(__name__)
TOKEN_CACHE = LocalTokenCache("./.local_token_cache.json")


class CopilotService:
    """
    Copilot Studio service with per-user conversation isolation.
    
    IMPORTANT LIMITATIONS:
    - Conversation mapping is stored in-process memory only (no Redis/external persistence).
    - This means conversation state is lost on server restart.
    - For multi-instance deployments, each instance maintains separate conversation state.
    - To scale horizontally, migrate conversation mapping to shared storage (Redis, etc.).
    
    INITIALIZATION:
    - Service is lazy-initialized (only when first message is sent).
    - No network calls or token acquisition on startup/import.
    - Token acquisition uses silent flow only (never interactive).
    """
    def __init__(self):
        self._client = None
        # Per-user conversation mapping: user_id -> conversation_id
        # IN-MEMORY ONLY - lost on restart, not shared across instances
        self._conversations: Dict[str, str] = {}
        self._is_initialized = False

    def _acquire_token(self, app_client_id: str, tenant_id: str) -> str:
        """
        Acquire token from Azure AD using silent acquisition only.
        
        NOTE: This backend service NEVER triggers interactive MSAL flows.
        If silent token acquisition fails, an error is raised instead of
        attempting interactive login.
        """
        pca = PublicClientApplication(
            client_id=app_client_id,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
            token_cache=TOKEN_CACHE,
        )

        token_request = {
            "scopes": ["https://api.powerplatform.com/.default"],
        }
        
        accounts = pca.get_accounts()
        token = None
        
        try:
            if accounts:
                logger.info("Attempting silent token acquisition...")
                response = pca.acquire_token_silent(
                    token_request["scopes"], account=accounts[0]
                )
                token = response.get("access_token")
                
                if not token:
                    error_msg = (
                        "Silent token acquisition failed. Backend services must not "
                        "use interactive authentication flows. Ensure a valid token "
                        "is cached or use client credentials flow instead."
                    )
                    logger.error(error_msg)
                    raise Exception(error_msg)
            else:
                error_msg = (
                    "No cached accounts found. Backend services must not use "
                    "interactive authentication flows. Pre-authenticate or use "
                    "client credentials flow instead."
                )
                logger.error(error_msg)
                raise Exception(error_msg)
                
        except Exception as e:
            logger.error(f"Error acquiring token: {e}")
            raise Exception(f"Failed to acquire authentication token: {e}")

        if not token:
            raise Exception("Failed to acquire access token")
            
        return token

    def _initialize_client(self):
        """Initialize Copilot Studio client"""
        if self._is_initialized:
            return

        logger.info("Initializing Copilot Studio client...")
        
        # Get required environment variables with helpful error messages
        environment_id = os.environ.get("COPILOTSTUDIOAGENT__ENVIRONMENTID")
        agent_identifier = os.environ.get("COPILOTSTUDIOAGENT__SCHEMANAME")
        app_client_id = os.environ.get("COPILOTSTUDIOAGENT__AGENTAPPID")
        tenant_id = os.environ.get("COPILOTSTUDIOAGENT__TENANTID")
        
        missing_vars = []
        if not environment_id:
            missing_vars.append("COPILOTSTUDIOAGENT__ENVIRONMENTID")
        if not agent_identifier:
            missing_vars.append("COPILOTSTUDIOAGENT__SCHEMANAME")
        if not app_client_id:
            missing_vars.append("COPILOTSTUDIOAGENT__AGENTAPPID")
        if not tenant_id:
            missing_vars.append("COPILOTSTUDIOAGENT__TENANTID")
        
        if missing_vars:
            error_msg = (
                f"Missing required Copilot Studio environment variables: {', '.join(missing_vars)}. "
                "Please set these variables in your environment or .env file."
            )
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        settings = ConnectionSettings(
            environment_id=environment_id,
            agent_identifier=agent_identifier,
            cloud=PowerPlatformCloud.PROD,  
            copilot_agent_type=AgentType.PUBLISHED,  
            custom_power_platform_cloud=None  
        )
        
        token = self._acquire_token(
            app_client_id=app_client_id,
            tenant_id=tenant_id,
        )
        
        self._client = CopilotClient(settings, token)
        
        self._is_initialized = True

    async def _start_conversation(self) -> tuple[str, Optional[str]]:
        """
        Start a new conversation and get conversation ID and greeting message.
        Returns: (conversation_id, greeting_message)
        """
        logger.info("Starting new conversation with Copilot Studio...")
        activities = self._client.start_conversation(True)
        
        conversation_id = None
        greeting_message = None
        
        # Get conversation ID and greeting from activities
        async for activity in activities:
            if activity and hasattr(activity, 'conversation') and activity.conversation:
                conversation_id = activity.conversation.id
                logger.info(f"Conversation started: {conversation_id}")
                
                # Capture greeting message if it exists
                if hasattr(activity, 'text') and activity.text:
                    greeting_message = activity.text
                    logger.info(f"Greeting message: {greeting_message}")
            else:
                logger.warning(f"Received null/invalid activity: {activity}")
        
        if not conversation_id:
            raise ValueError("Failed to get conversation ID from Copilot Studio")
        
        return conversation_id, greeting_message

    def get_or_create_conversation(self, user_id: str) -> Optional[str]:
        """
        Get existing conversation ID for user, or None if new conversation needed.
        
        NOTE: This method does NOT initialize the client or create conversations.
        Client initialization and conversation creation happen lazily in send_message()
        to avoid any network calls or token acquisition on startup.
        """
        return self._conversations.get(user_id)

    def get_conversation_id(self, user_id: str) -> Optional[str]:
        """Get conversation ID for user, or None if not exists."""
        return self._conversations.get(user_id)

    async def send_message(self, user_id: str, message: str) -> Dict[str, Any]:
        """
        Send message to Copilot Studio using per-user conversation.
        
        Args:
            user_id: User identifier from session JWT
            message: Message text to send
        
        Returns:
            Response dict with reply, attachments, etc.
        """
        try:
            # Initialize client if needed
            if not self._is_initialized:
                self._initialize_client()
            
            # Get or create conversation for this user
            conversation_id = self._conversations.get(user_id)
            greeting_message = None
            
            if not conversation_id:
                # Create new conversation
                conversation_id, greeting_message = await self._start_conversation()
                self._conversations[user_id] = conversation_id
                logger.info(f"Created conversation {conversation_id} for user {user_id}")
            
            # If this is a request for intro (empty message), return greeting
            if not message.strip() and greeting_message:
                return {
                    "reply": greeting_message,
                    "all_responses": [greeting_message],
                    "conversation_id": conversation_id,
                    "has_attachments": False,
                    "attachments": []
                }

            logger.info(f"Sending message from user {user_id} to conversation {conversation_id}")
            
            # Send message to Copilot Studio
            replies = self._client.ask_question(message, conversation_id)
            
            responses = []
            text_response = ""
            attachments = []
            
            # Process all replies
            async for reply in replies:
                if reply.type == ActivityTypes.message:
                    if reply.text:
                        text_response = reply.text
                        responses.append(reply.text)
                    
                    # Check for attachments (Adaptive Cards)
                    if hasattr(reply, 'attachments') and reply.attachments:
                        for attachment in reply.attachments:
                            attachments.append({
                                "contentType": attachment.content_type,
                                "content": attachment.content
                            })
                    
                    # Check for suggested actions
                    if hasattr(reply, 'suggested_actions') and reply.suggested_actions:
                        logger.info(f"Suggested actions: {reply.suggested_actions}")
                
                elif reply.type == ActivityTypes.end_of_conversation:
                    logger.info("End of conversation received")
                    break

            return {
                "reply": text_response or " ".join(responses) or "No response from Copilot Studio",
                "attachments": attachments,
                "has_attachments": len(attachments) > 0
            }
            
        except Exception as e:
            logger.error(f"Error sending message to Copilot Studio: {e}")
            raise Exception(f"Failed to communicate with Copilot Studio: {e}")


# Global singleton instance
_copilot_service = None


def get_copilot_service() -> CopilotService:
    """
    Get or create Copilot service instance (lazy initialization).
    
    NOTE: This function does NOT initialize the client or make any network calls.
    The service instance is created, but client initialization and token acquisition
    only happen when send_message() is called for the first time.
    
    This ensures the backend never triggers MSAL flows or network calls on startup.
    """
    global _copilot_service
    if _copilot_service is None:
        _copilot_service = CopilotService()
    return _copilot_service

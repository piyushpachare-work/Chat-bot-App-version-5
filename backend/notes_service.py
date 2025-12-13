"""
Notes service for saving and managing user notes from AI chat responses.
Uses SQLite for persistence with per-user isolation.
"""
import sqlite3
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

class NotesService:
    """Service for managing saved notes with SQLite persistence."""
    
    def __init__(self, db_path: str = "./.notes.db"):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self) -> None:
        """Initialize SQLite database with notes table."""
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    preview TEXT,
                    tags TEXT,  -- JSON array of tag strings
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    message_id TEXT,  -- Optional: link to original message
                    conversation_id TEXT  -- Optional: link to conversation
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_id ON notes(user_id)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_created_at ON notes(created_at DESC)
            """)
            conn.commit()
        finally:
            conn.close()
    
    def save_note(
        self,
        user_id: str,
        content: str,
        title: Optional[str] = None,
        tags: Optional[List[str]] = None,
        message_id: Optional[str] = None,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Save a new note.
        
        Args:
            user_id: User identifier
            content: Full note content
            title: Optional title (auto-generated from first line if not provided)
            tags: Optional list of tags
            message_id: Optional link to original message
            conversation_id: Optional link to conversation
            
        Returns:
            Saved note dictionary
        """
        note_id = f"note-{datetime.now(timezone.utc).timestamp()}-{user_id[:8]}"
        
        # Auto-generate title from first line if not provided
        if not title:
            first_line = content.split('\n')[0].strip()
            title = first_line[:100] if first_line else "Untitled Note"
        
        # Generate preview (first 2 lines or 150 chars)
        preview_lines = content.split('\n')[:2]
        preview = '\n'.join(preview_lines).strip()[:150]
        
        tags_json = json.dumps(tags or ["General"])
        now = datetime.now(timezone.utc).isoformat()
        
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute("""
                INSERT INTO notes (id, user_id, title, content, preview, tags, created_at, updated_at, message_id, conversation_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (note_id, user_id, title, content, preview, tags_json, now, now, message_id, conversation_id))
            conn.commit()
        finally:
            conn.close()
        
        return {
            "id": note_id,
            "user_id": user_id,
            "title": title,
            "content": content,
            "preview": preview,
            "tags": tags or ["General"],
            "created_at": now,
            "updated_at": now,
            "message_id": message_id,
            "conversation_id": conversation_id
        }
    
    def get_notes(
        self,
        user_id: str,
        limit: int = 100,
        offset: int = 0,
        tag_filter: Optional[str] = None,
        search_query: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get notes for a user with optional filtering.
        
        Args:
            user_id: User identifier
            limit: Maximum number of notes to return
            offset: Pagination offset
            tag_filter: Optional tag to filter by
            search_query: Optional search query (searches title and content)
            
        Returns:
            List of note dictionaries
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            query = "SELECT * FROM notes WHERE user_id = ?"
            params = [user_id]
            
            if tag_filter:
                query += " AND tags LIKE ?"
                params.append(f'%"{tag_filter}"%')
            
            if search_query:
                query += " AND (title LIKE ? OR content LIKE ? OR preview LIKE ?)"
                search_pattern = f"%{search_query}%"
                params.extend([search_pattern, search_pattern, search_pattern])
            
            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])
            
            rows = conn.execute(query, params).fetchall()
            
            notes = []
            for row in rows:
                tags = json.loads(row["tags"]) if row["tags"] else []
                notes.append({
                    "id": row["id"],
                    "user_id": row["user_id"],
                    "title": row["title"],
                    "content": row["content"],
                    "preview": row["preview"],
                    "tags": tags,
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                    "message_id": row["message_id"],
                    "conversation_id": row["conversation_id"]
                })
            
            return notes
        finally:
            conn.close()
    
    def get_note(self, note_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific note by ID."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            row = conn.execute(
                "SELECT * FROM notes WHERE id = ? AND user_id = ?",
                (note_id, user_id)
            ).fetchone()
            
            if not row:
                return None
            
            tags = json.loads(row["tags"]) if row["tags"] else []
            return {
                "id": row["id"],
                "user_id": row["user_id"],
                "title": row["title"],
                "content": row["content"],
                "preview": row["preview"],
                "tags": tags,
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "message_id": row["message_id"],
                "conversation_id": row["conversation_id"]
            }
        finally:
            conn.close()
    
    def update_note(
        self,
        note_id: str,
        user_id: str,
        title: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Optional[Dict[str, Any]]:
        """Update note title and/or tags."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            updates = []
            params = []
            
            if title:
                updates.append("title = ?")
                params.append(title)
            
            if tags is not None:
                updates.append("tags = ?")
                params.append(json.dumps(tags))
            
            if not updates:
                # No updates, just return existing note
                return self.get_note(note_id, user_id)
            
            updates.append("updated_at = ?")
            params.append(datetime.now(timezone.utc).isoformat())
            params.extend([note_id, user_id])
            
            query = f"UPDATE notes SET {', '.join(updates)} WHERE id = ? AND user_id = ?"
            conn.execute(query, params)
            conn.commit()
            
            return self.get_note(note_id, user_id)
        finally:
            conn.close()
    
    def delete_note(self, note_id: str, user_id: str) -> bool:
        """Delete a note."""
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.execute(
                "DELETE FROM notes WHERE id = ? AND user_id = ?",
                (note_id, user_id)
            )
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()
    
    def get_all_tags(self, user_id: str) -> List[str]:
        """Get all unique tags for a user."""
        conn = sqlite3.connect(self.db_path)
        try:
            rows = conn.execute(
                "SELECT tags FROM notes WHERE user_id = ?",
                (user_id,)
            ).fetchall()
            
            all_tags = set()
            for row in rows:
                if row[0]:
                    tags = json.loads(row[0])
                    all_tags.update(tags)
            
            return sorted(list(all_tags))
        finally:
            conn.close()


# Global instance
_notes_service: Optional[NotesService] = None

def get_notes_service() -> NotesService:
    """Get or create the global notes service instance."""
    global _notes_service
    if _notes_service is None:
        _notes_service = NotesService()
    return _notes_service

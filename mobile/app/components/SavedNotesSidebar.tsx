import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Clipboard,
  Platform,
} from "react-native";
import { FluentIcon } from "./FluentIcon";
import { Text } from "@/components/fluent-ui/Text";
import { TextInput } from "@/components/fluent-ui/TextInput";
import { Button } from "@/components/fluent-ui/Button";
import { Card } from "@/components/fluent-ui/Card";
import { authenticatedFetch } from "@/src/auth/api";
import { getBackendBaseUrl } from "@/src/auth/config";
import { timeAgo } from "../utils/timeAgo";
import { FluentColors, FluentSpacing, FluentBorderRadius } from "@/constants/fluent-ui-tokens";

const NOTES_URL = `${getBackendBaseUrl()}/notes`;

export type Note = {
  id: string;
  title: string;
  content: string;
  preview: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  message_id?: string;
  conversation_id?: string;
};

type SavedNotesSidebarProps = {
  isVisible: boolean;
  onToggle: () => void;
  width?: number;
  refreshTrigger?: number; // When this changes, refresh the notes list
};

export function SavedNotesSidebar({
  isVisible,
  onToggle,
  width = 280,
  refreshTrigger,
}: SavedNotesSidebarProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showNoteDetail, setShowNoteDetail] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (selectedTag) params.append("tag", selectedTag);
      params.append("limit", "100");

      const url = `${NOTES_URL}?${params.toString()}`;
      const response = await authenticatedFetch(url);
      const data = await response.json();
      setNotes(data.notes || []);
    } catch (error) {
      console.error("Error loading notes:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedTag]);

  const loadTags = useCallback(async () => {
    try {
      const response = await authenticatedFetch(`${NOTES_URL}/tags/all`);
      const data = await response.json();
      setAllTags(data.tags || []);
    } catch (error) {
      console.error("Error loading tags:", error);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      loadNotes();
      loadTags();
    }
  }, [isVisible, loadNotes, loadTags]);

  // Refresh when refreshTrigger changes (e.g., when a new note is saved)
  useEffect(() => {
    if (isVisible && refreshTrigger !== undefined) {
      loadNotes();
      loadTags();
    }
  }, [refreshTrigger, isVisible, loadNotes, loadTags]);

  const handleDeleteNote = (noteId: string) => {
    Alert.alert(
      "Delete Note",
      "Are you sure you want to delete this note?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await authenticatedFetch(`${NOTES_URL}/${noteId}`, {
                method: "DELETE",
              });
              loadNotes();
              if (selectedNote?.id === noteId) {
                setSelectedNote(null);
                setShowNoteDetail(false);
              }
            } catch (error) {
              console.error("Error deleting note:", error);
              Alert.alert("Error", "Failed to delete note");
            }
          },
        },
      ]
    );
  };

  const handleNotePress = (note: Note) => {
    setSelectedNote(note);
    setShowNoteDetail(true);
  };

  const handleStartEditTitle = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingTitle(note.title);
  };

  const handleSaveTitle = async (noteId: string) => {
    if (!editingTitle.trim()) {
      Alert.alert("Error", "Title cannot be empty");
      return;
    }

    try {
      await authenticatedFetch(`${NOTES_URL}/${noteId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });
      setEditingNoteId(null);
      setEditingTitle("");
      loadNotes();
      // Update selected note if it's the one being edited
      if (selectedNote?.id === noteId) {
        setSelectedNote({ ...selectedNote, title: editingTitle.trim() });
      }
    } catch (error) {
      console.error("Error updating title:", error);
      Alert.alert("Error", "Failed to update title");
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingTitle("");
  };

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <View style={[sidebarStyles.container, { width }]}>
        {/* Search Bar at Top */}
        <View style={sidebarStyles.searchContainer}>
          <FluentIcon name="Search24Regular" size={20} color={FluentColors.text.secondary} />
          <TextInput
            placeholder="Search notes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            containerStyle={{ flex: 1, marginBottom: 0 }}
            inputStyle={sidebarStyles.searchInput}
          />
        </View>

        {/* Header with Title and Collapse */}
        <View style={sidebarStyles.header}>
          <Text variant="subtitle" weight="semibold" style={sidebarStyles.headerTitle}>Saved Notes</Text>
          <Button
            appearance="transparent"
            size="small"
            onPress={onToggle}
            style={sidebarStyles.collapseButton}
            accessibilityLabel="Collapse sidebar"
          >
            <FluentIcon name="ChevronRight24Regular" size={20} color={FluentColors.text.secondary} />
          </Button>
        </View>

        {/* Tags Filter */}
        {allTags.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={sidebarStyles.tagsContainer}
            contentContainerStyle={sidebarStyles.tagsContent}
          >
            <TouchableOpacity
              style={[
                sidebarStyles.tagPill,
                selectedTag === null && sidebarStyles.tagPillActive,
              ]}
              onPress={() => setSelectedTag(null)}
            >
              <Text
                style={[
                  sidebarStyles.tagText,
                  selectedTag === null && sidebarStyles.tagTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {allTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  sidebarStyles.tagPill,
                  selectedTag === tag && sidebarStyles.tagPillActive,
                ]}
                onPress={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                <Text
                  style={[
                    sidebarStyles.tagText,
                    selectedTag === tag && sidebarStyles.tagTextActive,
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Notes List */}
        {loading ? (
          <View style={sidebarStyles.loadingContainer}>
            <ActivityIndicator size="small" color={FluentColors.brand.primary} />
          </View>
        ) : notes.length === 0 ? (
          <View style={sidebarStyles.emptyContainer}>
            <Text variant="body" color="secondary" style={sidebarStyles.emptyText}>
              {searchQuery || selectedTag
                ? "No notes found"
                : "Save important AI responses here to revisit later."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={notes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <NoteItem
                note={item}
                onPress={() => handleNotePress(item)}
                onDelete={() => handleDeleteNote(item.id)}
                onEditTitle={() => handleStartEditTitle(item)}
                isEditing={editingNoteId === item.id}
                editingTitle={editingTitle}
                onTitleChange={setEditingTitle}
                onSaveTitle={() => handleSaveTitle(item.id)}
                onCancelEdit={handleCancelEdit}
              />
            )}
            contentContainerStyle={sidebarStyles.listContent}
          />
        )}
      </View>

      {/* Note Detail Modal */}
      <Modal
        visible={showNoteDetail}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
        onRequestClose={() => setShowNoteDetail(false)}
      >
        {selectedNote && (
          <NoteDetailView
            note={selectedNote}
            onClose={() => setShowNoteDetail(false)}
            onDelete={() => {
              handleDeleteNote(selectedNote.id);
              setShowNoteDetail(false);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function NoteItem({
  note,
  onPress,
  onDelete,
  onEditTitle,
  isEditing,
  editingTitle,
  onTitleChange,
  onSaveTitle,
  onCancelEdit,
}: {
  note: Note;
  onPress: () => void;
  onDelete: () => void;
  onEditTitle: () => void;
  isEditing: boolean;
  editingTitle: string;
  onTitleChange: (text: string) => void;
  onSaveTitle: () => void;
  onCancelEdit: () => void;
}) {
  if (isEditing) {
    return (
      <View style={sidebarStyles.noteItem}>
        <View style={sidebarStyles.editTitleContainer}>
          <TextInput
            style={sidebarStyles.editTitleInput}
            value={editingTitle}
            onChangeText={onTitleChange}
            autoFocus
            placeholder="Note title"
            placeholderTextColor="#999"
          />
          <View style={sidebarStyles.editTitleActions}>
            <TouchableOpacity
              onPress={onSaveTitle}
              style={sidebarStyles.editTitleButton}
            >
              <Text style={sidebarStyles.editTitleSaveText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onCancelEdit}
              style={sidebarStyles.editTitleButton}
            >
              <FluentIcon name="Dismiss24Regular" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={sidebarStyles.noteItem}
      onPress={onPress}
      onLongPress={onDelete}
      activeOpacity={0.7}
    >
      <View style={sidebarStyles.noteItemHeader}>
        <Text style={sidebarStyles.noteTitle} numberOfLines={1}>
          {note.title}
        </Text>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onEditTitle();
          }}
          style={sidebarStyles.editButton}
        >
          <FluentIcon name="Edit24Regular" size={16} color="#666" />
        </TouchableOpacity>
      </View>
      <Text style={sidebarStyles.notePreview} numberOfLines={2}>
        {note.preview}
      </Text>
      <View style={sidebarStyles.noteFooter}>
        <Text style={sidebarStyles.noteTime}>
          {timeAgo(note.created_at)}
        </Text>
        {note.tags.length > 0 && (
          <View style={sidebarStyles.noteTags}>
            {note.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={sidebarStyles.noteTag}>
                <Text style={sidebarStyles.noteTagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function NoteDetailView({
  note,
  onClose,
  onDelete,
}: {
  note: Note;
  onClose: () => void;
  onDelete: () => void;
}) {
  const handleCopy = async () => {
    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(note.content);
        Alert.alert("Copied", "Note content copied to clipboard");
      } catch (error) {
        Alert.alert("Error", "Failed to copy to clipboard");
      }
    } else {
      Clipboard.setString(note.content);
      Alert.alert("Copied", "Note content copied to clipboard");
    }
  };

  return (
    <View style={sidebarStyles.detailContainer}>
      <View style={sidebarStyles.detailHeader}>
        <TouchableOpacity
          onPress={onClose}
          style={sidebarStyles.closeButton}
          activeOpacity={0.7}
        >
          <FluentIcon name="Dismiss24Regular" size={20} color="#007AFF" />
          <Text style={sidebarStyles.closeButtonText}>Close</Text>
        </TouchableOpacity>
        <View style={sidebarStyles.detailHeaderActions}>
          <TouchableOpacity
            onPress={handleCopy}
            style={sidebarStyles.copyButton}
            activeOpacity={0.7}
          >
            <FluentIcon name="Copy24Regular" size={18} color="#007AFF" />
            <Text style={sidebarStyles.copyButtonText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            style={sidebarStyles.deleteButton}
            activeOpacity={0.7}
          >
            <FluentIcon name="Delete24Regular" size={18} color="#dc2626" />
            <Text style={sidebarStyles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        style={sidebarStyles.detailContent}
        contentContainerStyle={sidebarStyles.detailContentContainer}
        showsVerticalScrollIndicator={true}
      >
        <Text style={sidebarStyles.detailTitle}>{note.title}</Text>
        <View style={sidebarStyles.detailMetadata}>
          <Text style={sidebarStyles.detailTime}>
            Saved {timeAgo(note.created_at)}
          </Text>
        </View>
        {note.tags.length > 0 && (
          <View style={sidebarStyles.detailTags}>
            {note.tags.map((tag) => (
              <View key={tag} style={sidebarStyles.detailTag}>
                <Text style={sidebarStyles.detailTagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={sidebarStyles.detailContentBox}>
          <Text style={sidebarStyles.detailContentText}>{note.content}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const sidebarStyles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    height: "100%",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    padding: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  collapseButton: {
    padding: 4,
  },
  tagsContainer: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tagsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    marginRight: 6,
  },
  tagPillActive: {
    backgroundColor: "#007AFF",
  },
  tagText: {
    fontSize: 12,
    color: "#666",
  },
  tagTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  listContent: {
    padding: 8,
  },
  noteItem: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  noteItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  editButton: {
    padding: 4,
    marginLeft: 8,
  },
  editTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editTitleInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    padding: 8,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  editTitleActions: {
    flexDirection: "row",
    gap: 4,
  },
  editTitleButton: {
    padding: 4,
  },
  editTitleSaveText: {
    fontSize: 18,
    color: "#007AFF",
    fontWeight: "600",
  },
  notePreview: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
    lineHeight: 16,
  },
  noteFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  noteTime: {
    fontSize: 10,
    color: "#999",
  },
  noteTags: {
    flexDirection: "row",
  },
  noteTag: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
  },
  noteTagText: {
    fontSize: 10,
    color: "#666",
  },
  detailContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  closeButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    gap: 6,
  },
  closeButtonText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "500",
  },
  detailHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    gap: 4,
  },
  copyButtonText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "500",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    gap: 4,
  },
  deleteButtonText: {
    fontSize: 16,
    color: "#dc2626",
    fontWeight: "500",
  },
  detailContent: {
    flex: 1,
  },
  detailContentContainer: {
    padding: 20,
  },
  detailTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    lineHeight: 32,
  },
  detailMetadata: {
    marginBottom: 16,
  },
  detailTime: {
    fontSize: 13,
    color: "#666",
  },
  detailTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  detailTag: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  detailTagText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  detailContentBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  detailContentText: {
    fontSize: 16,
    color: "#111827",
    lineHeight: 26,
  },
});

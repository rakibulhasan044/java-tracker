/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import roadmapData from "../data/roadmap.json";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

interface NoteItem {
  id: string;
  title: string;
  content: string;
}

type WeeksData = Record<string, NoteItem[]>;
type TasksData = Record<string, string>;

// ─── Migration helper ─────────────────────────────────────────────────────────
// If old data arrives as a string (legacy flat format), convert it to NoteItem[].
function migrateWeekValue(raw: unknown): NoteItem[] {
  if (Array.isArray(raw)) return raw as NoteItem[];
  if (typeof raw !== "string" || !raw.trim()) return [];
  // Old format: blocks separated by \n\n---\n\n
  const blocks = raw.split(/\n\n---\n\n|\n\n<!--NOTE_BREAK-->\n\n/);
  return blocks
    .map((block, i) => {
      const trimmed = block.trim();
      if (!trimmed) return null;
      const lines = trimmed.split("\n");
      const titleMatch = lines[0].match(/^\*\*(.+)\*\*$/);
      if (titleMatch) {
        return { id: String(Date.now() + i), title: titleMatch[1], content: lines.slice(1).join("\n").trim() };
      }
      return { id: String(Date.now() + i), title: `Note ${i + 1}`, content: trimmed };
    })
    .filter(Boolean) as NoteItem[];
}

function migrateWeeksData(raw: Record<string, unknown>): WeeksData {
  const result: WeeksData = {};
  for (const [k, v] of Object.entries(raw)) {
    result[k] = migrateWeekValue(v);
  }
  return result;
}

// ─── Persistence helpers ──────────────────────────────────────────────────────
const saveAndSync = (updatedNotes: any) => {
  localStorage.setItem("java-roadmap-notes", JSON.stringify(updatedNotes));
  const progress = JSON.parse(localStorage.getItem("java-roadmap-progress") || "{}");
  fetch("/api/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ progress, notes: updatedNotes }),
  }).catch(console.error);
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function NotesPage() {
  const [weeksData, setWeeksData] = useState<WeeksData>({});
  const [tasksData, setTasksData] = useState<TasksData>({});
  const [mounted, setMounted] = useState(false);

  const [isAddingNote, setIsAddingNote] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(roadmapData.phases[0].weeks[0].id);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const [activePhaseId, setActivePhaseId] = useState(roadmapData.phases[0].id);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editModalContext, setEditModalContext] = useState<{ type: 'week'; weekId: string } | { type: 'task'; taskId: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'week'; weekId: string; noteId: string } | { type: 'task'; taskId: string } | null>(null);

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);

    // Optimistic: load from localStorage first
    const saved = localStorage.getItem("java-roadmap-notes");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.weeks) setWeeksData(migrateWeeksData(p.weeks));
        if (p.tasks) setTasksData(p.tasks);
      } catch (e) { console.error(e); }
    }

    // Then fetch from DB and update
    fetch("/api/data", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.notes) {
          const migratedWeeks = migrateWeeksData(data.notes.weeks || {});
          const notes = { ...data.notes, weeks: migratedWeeks };
          localStorage.setItem("java-roadmap-notes", JSON.stringify(notes));
          setWeeksData(migratedWeeks);
          if (data.notes.tasks) setTasksData(data.notes.tasks);
        }
      })
      .catch(console.error);
  }, []);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'week') {
      handleDeleteWeekNote(deleteTarget.weekId, deleteTarget.noteId);
    } else {
      handleDeleteTaskNote(deleteTarget.taskId);
    }
    setDeleteTarget(null);
    showToast('✓ Note deleted!');
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const getFullNotes = () => {
    const saved = localStorage.getItem("java-roadmap-notes");
    if (!saved) return { weeks: {}, tasks: {} };
    try {
      const p = JSON.parse(saved);
      return { weeks: migrateWeeksData(p.weeks || {}), tasks: p.tasks || {}, interview: p.interview || {} };
    } catch { return { weeks: {}, tasks: {} }; }
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  const handleSaveNote = () => {
    if (!newContent.trim()) return;
    const newNote: NoteItem = {
      id: String(Date.now()),
      title: newTitle.trim() || `Note`,
      content: newContent.trim(),
    };
    const existingList = weeksData[selectedWeek] || [];
    const updated = { ...weeksData, [selectedWeek]: [...existingList, newNote] };
    setWeeksData(updated);
    const fullNotes = getFullNotes();
    saveAndSync({ ...fullNotes, weeks: updated });
    setIsAddingNote(false);
    setNewTitle("");
    setNewContent("");
    showToast('✓ Note saved!');
  };

  const handleDeleteWeekNote = (weekId: string, noteId: string) => {
    const updated = {
      ...weeksData,
      [weekId]: (weeksData[weekId] || []).filter((n) => n.id !== noteId),
    };
    if (updated[weekId].length === 0) delete updated[weekId];
    setWeeksData(updated);
    const fullNotes = getFullNotes();
    saveAndSync({ ...fullNotes, weeks: updated });
  };

  const handleEditSaveWeek = (weekId: string, noteId: string) => {
    const updated = {
      ...weeksData,
      [weekId]: (weeksData[weekId] || []).map((n) =>
        n.id === noteId ? { ...n, title: editTitle, content: editContent } : n
      ),
    };
    setWeeksData(updated);
    const fullNotes = getFullNotes();
    saveAndSync({ ...fullNotes, weeks: updated });
    setEditingId(null);
    showToast('✓ Note updated!');
  };

  const handleDeleteTaskNote = (taskId: string) => {
    const updated = { ...tasksData };
    delete updated[taskId];
    setTasksData(updated);
    const fullNotes = getFullNotes();
    saveAndSync({ ...fullNotes, tasks: updated });
  };

  const handleEditSaveTask = (taskId: string) => {
    const updated = { ...tasksData, [taskId]: editContent };
    setTasksData(updated);
    const fullNotes = getFullNotes();
    saveAndSync({ ...fullNotes, tasks: updated });
    setEditingId(null);
  };

  const toggleNote = (id: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!mounted) return null;

  const activePhase = roadmapData.phases.find((p) => p.id === activePhaseId);
  const weeksWithNotes = activePhase?.weeks.filter((w) => (weeksData[w.id] || []).length > 0) || [];
  const tasksWithNotes =
    activePhase?.weeks.flatMap((w) =>
      w.tasks.filter((t) => tasksData[t.id]?.trim()).map((t) => ({ ...t, weekTitle: w.title }))
    ) || [];
  const hasAny = weeksWithNotes.length > 0 || tasksWithNotes.length > 0;

  return (
    <div className="animate-in">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">My Notes</h1>
          <p className="text-muted text-lg">All your saved notes, organized by phase</p>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/" className="action-btn active" style={{ padding: "0 1.25rem", height: "40px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", borderRadius: "8px", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap", backgroundColor: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)" }}>Dashboard</Link>
          <Link href="/interview" className="action-btn action-btn-interview active" style={{ padding: "0 1.25rem", height: "40px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", borderRadius: "8px", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}>Interview Qs</Link>
          <Link href="/qabank" className="action-btn active" style={{ padding: "0 1.25rem", height: "40px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", borderRadius: "8px", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap", backgroundColor: "rgba(16, 185, 129, 0.1)", color: "#059669" }}>QA Bank</Link>
          <Link href="/projects" className="action-btn active" style={{ padding: "0 1.25rem", height: "40px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", borderRadius: "8px", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap", backgroundColor: "var(--foreground)", color: "var(--background)" }}>Projects</Link>
        </div>
      </header>

      {/* Add Note */}
      {isAddingNote ? (
        <div className="card mb-8 animate-in" style={{ borderColor: "var(--color-note)", borderWidth: "2px" }}>
          <h2 className="text-2xl mb-4 font-semibold">Add New Note</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block mb-2 font-medium">Select Week</label>
              <select
                className="textarea-input"
                style={{ minHeight: "auto", padding: "0.75rem", width: "100%", backgroundColor: "var(--surface)", color: "var(--foreground)" }}
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
              >
                {roadmapData.phases.map((phase) => (
                  <optgroup key={phase.id} label={phase.title}>
                    {phase.weeks.map((w) => (
                      <option key={w.id} value={w.id}>{w.title}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-2 font-medium">Title <span className="text-muted">(optional)</span></label>
              <input
                className="textarea-input"
                style={{ minHeight: "auto", padding: "0.75rem", width: "100%" }}
                placeholder="e.g. HashMap internals..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Note Content <span className="text-muted">(Markdown supported)</span></label>
              <textarea
                className="textarea-input textarea-note"
                style={{ minHeight: "220px" }}
                placeholder={"Paste your notes here — markdown, code blocks, tables, --- dividers all work fine!"}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
            </div>
            <div className="flex gap-3 mt-2">
              <button className="action-btn action-btn-note active" onClick={handleSaveNote} style={{ padding: "0.7rem 1.5rem", borderRadius: "8px" }}>Save Note</button>
              <button className="action-btn" onClick={() => setIsAddingNote(false)} style={{ padding: "0.7rem 1.5rem", borderRadius: "8px" }}>Cancel</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <button className="action-btn action-btn-note active" onClick={() => setIsAddingNote(true)} style={{ padding: "0.75rem 1.5rem", fontSize: "1.05rem", borderRadius: "8px" }}>
            + Add New Note
          </button>
        </div>
      )}

      {/* Phase Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-4 mb-6" style={{ scrollbarWidth: "none" }}>
        {roadmapData.phases.map((phase) => (
          <button
            key={phase.id}
            onClick={() => setActivePhaseId(phase.id)}
            className="action-btn"
            style={{
              padding: "0.7rem 1.4rem", whiteSpace: "nowrap", borderRadius: "8px",
              border: activePhaseId === phase.id ? "2px solid var(--color-note)" : "1px solid var(--border)",
              backgroundColor: activePhaseId === phase.id ? "var(--bg-note)" : "transparent",
              color: activePhaseId === phase.id ? "var(--color-note)" : "var(--foreground)",
              fontWeight: activePhaseId === phase.id ? "600" : "500",
            }}
          >
            {phase.title}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4 animate-in">
        {!hasAny && (
          <div className="card text-center p-12 text-muted text-lg">
            No notes for {activePhase?.title} yet.<br /><br />Add notes here or on the dashboard!
          </div>
        )}

        {/* Weekly Notes */}
        {weeksWithNotes.map((week) => {
          const notesList = weeksData[week.id] || [];
          return (
            <div key={week.id} className="card">
              <h3 className="text-lg font-semibold mb-3 border-b pb-3" style={{ borderColor: "var(--border)" }}>{week.title}</h3>
              <div className="flex flex-col gap-1">{notesList.map((note) => {
                  const noteId = `${week.id}-${note.id}`;
                  const isOpen = expandedNotes.has(noteId);
                  const isEditing = editingId === noteId;
                  return (
                    <div key={noteId} className={`note-wrapper ${isOpen ? "expanded" : ""} flex-col !items-stretch`}>
                      {false ? null : (
                        <>
                          <div className="flex items-center w-full gap-2">
                            <button className="text-left font-medium flex items-center flex-1 transition-colors gap-2" onClick={() => toggleNote(noteId)}>
                              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--color-note)", flexShrink: 0, display: "inline-block" }} />
                              <span className="text-base leading-snug flex-1">{note.title}</span>
                              <span className="text-muted ml-1 text-sm flex-shrink-0">{isOpen ? "▲" : "▼"}</span>
                            </button>
                            <button
                              onClick={() => { setEditingId(noteId); setEditTitle(note.title); setEditContent(note.content); setEditModalContext({ type: 'week', weekId: week.id }); }}
                              className="action-btn" title="Edit" style={{ padding: "0.3rem 0.6rem", flexShrink: 0, fontWeight: 600 }}
                            >Edit</button>
                            <button
                              onClick={() => setDeleteTarget({ type: 'week', weekId: week.id, noteId: note.id })}
                              className="action-btn" title="Delete" style={{ padding: "0.3rem 0.6rem", flexShrink: 0, color: "#ef4444", fontWeight: 600 }}
                            >Delete</button>
                          </div>
                          {isOpen && (
                            <div className="mt-3 animate-in markdown-body" style={{ paddingLeft: "1.25rem" }}>
                              <ReactMarkdown>{note.content}</ReactMarkdown>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Task Notes */}
        {tasksWithNotes.length > 0 && (
          <div className="card">
            <h3 className="text-2xl font-semibold mb-6 border-b pb-4" style={{ borderColor: "var(--border)" }}>Topic Notes</h3>
            <div className="flex flex-col gap-2">
              {tasksWithNotes.map((task) => {
                const noteId = `task-${task.id}`;
                const isOpen = expandedNotes.has(noteId);
                const isEditing = editingId === noteId;
                return (
                  <div key={noteId} className={`note-wrapper ${isOpen ? "expanded" : ""} flex-col !items-stretch`}>
                    {false ? null : (
                      <>
                        <div className="flex items-center w-full gap-2">
                          <button className="text-left font-medium flex items-start flex-1 transition-colors gap-2" onClick={() => toggleNote(noteId)}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--accent)", flexShrink: 0, marginTop: "6px", display: "inline-block" }} />
                            <div className="flex-1 min-w-0">
                              <span className="text-base leading-snug block">{task.description}</span>
                              <span className="text-sm" style={{ color: "var(--text-muted)" }}>{task.weekTitle}</span>
                            </div>
                            <span className="text-muted text-sm flex-shrink-0 mt-1">{isOpen ? "▲" : "▼"}</span>
                          </button>
                          <button
                            onClick={() => { setEditingId(noteId); setEditTitle(''); setEditContent(tasksData[task.id]); setEditModalContext({ type: 'task', taskId: task.id }); }}
                            className="action-btn" title="Edit" style={{ padding: "0.3rem 0.6rem", flexShrink: 0, fontWeight: 600 }}
                          >Edit</button>
                          <button
                            onClick={() => setDeleteTarget({ type: 'task', taskId: task.id })}
                            className="action-btn" title="Delete" style={{ padding: "0.3rem 0.6rem", flexShrink: 0, color: "#ef4444", fontWeight: 600 }}
                          >Delete</button>
                        </div>
                        {isOpen && (
                          <div className="mt-3 animate-in markdown-body" style={{ paddingLeft: "1.25rem" }}>
                            <ReactMarkdown>{tasksData[task.id]}</ReactMarkdown>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModalContext && editingId && (
        <div className="modal-backdrop" onClick={() => { setEditingId(null); setEditModalContext(null); }}>
          <div className="modal-box" style={{ maxWidth: '680px', width: '94vw' }} onClick={e => e.stopPropagation()}>
            <p className="modal-title" style={{ marginBottom: '1rem' }}>✏️ Edit Note</p>
            {editModalContext.type === 'week' && (
              <input
                className="textarea-input"
                style={{ minHeight: 'auto', padding: '0.6rem 0.85rem', width: '100%', fontWeight: 600, backgroundColor: 'var(--surface)', marginBottom: '0.75rem' }}
                placeholder="Title..."
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                autoFocus
              />
            )}
            <textarea
              className="textarea-input"
              style={{ minHeight: '52vh', width: '100%', backgroundColor: 'var(--surface)', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.93rem', lineHeight: 1.7, padding: '0.75rem' }}
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              autoFocus={editModalContext.type === 'task'}
            />
            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button className="modal-btn-cancel" onClick={() => { setEditingId(null); setEditModalContext(null); }}>Cancel</button>
              <button
                className="action-btn action-btn-note active"
                style={{ padding: '0.55rem 1.2rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.88rem' }}
                onClick={() => {
                  if (editModalContext.type === 'week') {
                    handleEditSaveWeek(editModalContext.weekId, editingId.replace(editModalContext.weekId + '-', ''));
                  } else {
                    handleEditSaveTask(editModalContext.taskId);
                  }
                  setEditModalContext(null);
                }}
              >Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🗑️</div>
            <p className="modal-title">Delete Note?</p>
            <p className="modal-body">This note will be permanently deleted and cannot be undone.</p>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="modal-btn-delete" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className="toast success">{toast}</div>
        </div>
      )}
    </div>
  );
}

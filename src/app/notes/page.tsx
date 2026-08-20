/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import roadmapData from "../data/roadmap.json";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

const parseNotes = (text: string) => {
  const blocks = text.split('\n\n---\n\n');
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    const lines = trimmed.split('\n');
    const titleMatch = lines[0].match(/^\*\*(.+)\*\*$/);
    if (titleMatch) {
      return { title: titleMatch[1], content: lines.slice(1).join('\n').trim(), id: String(i) };
    }
    return { title: `Note ${i + 1}`, content: trimmed, id: String(i) };
  }).filter(Boolean) as { title: string; content: string; id: string }[];
};

const serializeNotes = (items: { title: string; content: string }[]) =>
  items
    .filter(item => item.content.trim())
    .map(item => item.title && item.title !== `Note ${1}` ? `**${item.title}**\n${item.content}` : item.content)
    .join('\n\n---\n\n');

const saveAndSync = (updatedNotes: any) => {
  localStorage.setItem("java-roadmap-notes", JSON.stringify(updatedNotes));
  const progress = JSON.parse(localStorage.getItem("java-roadmap-progress") || "{}");
  fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ progress, notes: updatedNotes })
  }).catch(console.error);
};

export default function NotesPage() {
  const [weeksData, setWeeksData] = useState<Record<string, string>>({});
  const [tasksData, setTasksData] = useState<Record<string, string>>({});
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

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(data => {
        if (data.notes) {
          localStorage.setItem("java-roadmap-notes", JSON.stringify(data.notes));
          if (data.notes.weeks) setWeeksData(data.notes.weeks);
          if (data.notes.tasks) setTasksData(data.notes.tasks);
        } else {
          const saved = localStorage.getItem("java-roadmap-notes");
          if (saved) {
            try {
              const p = JSON.parse(saved);
              if (p.weeks) setWeeksData(p.weeks);
              if (p.tasks) setTasksData(p.tasks);
            } catch (e) { console.error(e); }
          }
        }
        setMounted(true);
      })
      .catch(() => setMounted(true));
  }, []);

  const getFullNotes = () => JSON.parse(localStorage.getItem("java-roadmap-notes") || "{}");

  const handleSaveNote = () => {
    if (!newContent.trim()) return;
    const noteText = newTitle.trim() ? `**${newTitle.trim()}**\n${newContent.trim()}` : newContent.trim();
    const fullNotes = getFullNotes();
    const currentText = fullNotes.weeks?.[selectedWeek] || '';
    const separator = currentText.trim() ? '\n\n---\n\n' : '';
    const newText = currentText + separator + noteText;
    const updated = { ...weeksData, [selectedWeek]: newText };
    setWeeksData(updated);
    saveAndSync({ ...fullNotes, weeks: updated });
    setIsAddingNote(false);
    setNewTitle(""); setNewContent("");
  };

  const updateWeekNotes = (weekId: string, items: { title: string; content: string }[]) => {
    const newText = serializeNotes(items);
    const updated = { ...weeksData, [weekId]: newText };
    if (!newText.trim()) delete updated[weekId];
    setWeeksData(updated);
    const fullNotes = getFullNotes();
    saveAndSync({ ...fullNotes, weeks: updated });
  };

  const handleDeleteWeekNote = (weekId: string, noteId: string) => {
    const items = parseNotes(weeksData[weekId] || "").filter(n => n.id !== noteId);
    updateWeekNotes(weekId, items);
  };

  const handleEditSaveWeek = (weekId: string, noteId: string) => {
    const items = parseNotes(weeksData[weekId] || "").map(n =>
      n.id === noteId ? { ...n, title: editTitle, content: editContent } : n
    );
    updateWeekNotes(weekId, items);
    setEditingId(null);
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
    setExpandedNotes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!mounted) return null;

  const activePhase = roadmapData.phases.find(p => p.id === activePhaseId);
  const weeksWithNotes = activePhase?.weeks.filter(w => weeksData[w.id]?.trim()) || [];
  const tasksWithNotes = activePhase?.weeks.flatMap(w =>
    w.tasks.filter(t => tasksData[t.id]?.trim()).map(t => ({ ...t, weekTitle: w.title }))
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
          <Link href="/" className="action-btn active" style={{ padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>Dashboard</Link>
          <Link href="/interview" className="action-btn action-btn-interview active" style={{ padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>Interview Qs</Link>
            <Link href="/qabank" className="action-btn active" style={{ padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>QA Bank</Link>
          <Link href="/projects" className="action-btn active" style={{ padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: 'var(--foreground)', color: 'var(--background)' }}>Projects</Link>
        </div>
      </header>

      {/* Add Note */}
      {isAddingNote ? (
        <div className="card mb-8 animate-in" style={{ borderColor: 'var(--color-note)', borderWidth: '2px' }}>
          <h2 className="text-2xl mb-4 font-semibold">Add New Note</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block mb-2 font-medium">Select Week</label>
              <select className="textarea-input" style={{ minHeight: 'auto', padding: '0.75rem', width: '100%', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
                {roadmapData.phases.map(phase => (
                  <optgroup key={phase.id} label={phase.title}>
                    {phase.weeks.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-2 font-medium">Title <span className="text-muted">(optional)</span></label>
              <input className="textarea-input" style={{ minHeight: 'auto', padding: '0.75rem', width: '100%' }}
                placeholder="e.g. HashMap internals..." value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            </div>
            <div>
              <label className="block mb-2 font-medium">Note Content</label>
              <textarea className="textarea-input textarea-note" style={{ minHeight: '180px' }}
                placeholder="Write your note here..." value={newContent} onChange={e => setNewContent(e.target.value)} />
            </div>
            <div className="flex gap-3 mt-2">
              <button className="action-btn action-btn-note active" onClick={handleSaveNote} style={{ padding: '0.7rem 1.5rem', borderRadius: '8px' }}>Save Note</button>
              <button className="action-btn" onClick={() => setIsAddingNote(false)} style={{ padding: '0.7rem 1.5rem', borderRadius: '8px' }}>Cancel</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <button className="action-btn action-btn-note active" onClick={() => setIsAddingNote(true)}
            style={{ padding: '0.75rem 1.5rem', fontSize: '1.05rem', borderRadius: '8px' }}>
            + Add New Note
          </button>
        </div>
      )}

      {/* Phase Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-4 mb-6" style={{ scrollbarWidth: 'none' }}>
        {roadmapData.phases.map(phase => (
          <button key={phase.id} onClick={() => setActivePhaseId(phase.id)} className="action-btn"
            style={{
              padding: '0.7rem 1.4rem', whiteSpace: 'nowrap', borderRadius: '8px',
              border: activePhaseId === phase.id ? '2px solid var(--color-note)' : '1px solid var(--border)',
              backgroundColor: activePhaseId === phase.id ? 'var(--bg-note)' : 'transparent',
              color: activePhaseId === phase.id ? 'var(--color-note)' : 'var(--foreground)',
              fontWeight: activePhaseId === phase.id ? '600' : '500',
            }}>
            {phase.title}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-8 animate-in">
        {!hasAny && (
          <div className="card text-center p-12 text-muted text-lg">
            No notes for {activePhase?.title} yet.<br /><br />Add notes here or on the dashboard!
          </div>
        )}

        {/* Weekly Notes */}
        {weeksWithNotes.map(week => {
          const notesList = parseNotes(weeksData[week.id]);
          return (
            <div key={week.id} className="card">
              <h3 className="text-2xl font-semibold mb-6 border-b pb-4" style={{ borderColor: 'var(--border)' }}>{week.title}</h3>
              <div className="flex flex-col gap-2">
                {notesList.map(note => {
                  const noteId = `${week.id}-${note.id}`;
                  const isOpen = expandedNotes.has(noteId);
                  const isEditing = editingId === noteId;
                  return (
                    <div key={noteId} className={`note-wrapper ${isOpen ? 'expanded' : ''} flex-col !items-stretch`}>
                      {isEditing ? (
                        <div className="flex flex-col gap-3 animate-in w-full">
                          <input className="textarea-input" style={{ minHeight: 'auto', padding: '0.6rem 0.75rem', width: '100%', fontWeight: 600, backgroundColor: 'var(--surface)' }}
                            placeholder="Title..." value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                          <textarea className="textarea-input textarea-note" style={{ minHeight: '140px', backgroundColor: 'var(--surface)' }}
                            value={editContent} onChange={e => setEditContent(e.target.value)} />
                          <div className="flex gap-3">
                            <button className="action-btn action-btn-note active" onClick={() => handleEditSaveWeek(week.id, note.id)} style={{ padding: '0.5rem 1.2rem', borderRadius: '6px' }}>Save</button>
                            <button className="action-btn" onClick={() => setEditingId(null)} style={{ padding: '0.5rem 1.2rem', borderRadius: '6px' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center w-full gap-2">
                            <button className="text-left font-medium flex items-center flex-1 transition-colors gap-2"
                              onClick={() => toggleNote(noteId)}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-note)', flexShrink: 0, display: 'inline-block' }} />
                              <span className="text-base leading-snug flex-1">{note.title}</span>
                              <span className="text-muted ml-1 text-sm flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
                            </button>
                            <button onClick={() => { setEditingId(noteId); setEditTitle(note.title); setEditContent(note.content); setExpandedNotes(prev => { const n = new Set(prev); n.add(noteId); return n; }); }}
                              className="action-btn" title="Edit" style={{ padding: '0.3rem 0.6rem', flexShrink: 0, fontWeight: 600 }}>Edit</button>
                            <button onClick={() => { if (confirm('Delete this note?')) handleDeleteWeekNote(week.id, note.id); }}
                              className="action-btn" title="Delete" style={{ padding: '0.3rem 0.6rem', flexShrink: 0, color: '#ef4444', fontWeight: 600 }}>Delete</button>
                          </div>
                          {isOpen && (
                            <div className="mt-3 animate-in markdown-body" style={{ paddingLeft: '1.25rem' }}>
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
            <h3 className="text-2xl font-semibold mb-6 border-b pb-4" style={{ borderColor: 'var(--border)' }}>Topic Notes</h3>
            <div className="flex flex-col gap-2">
              {tasksWithNotes.map(task => {
                const noteId = `task-${task.id}`;
                const isOpen = expandedNotes.has(noteId);
                const isEditing = editingId === noteId;
                return (
                  <div key={noteId} className={`note-wrapper ${isOpen ? 'expanded' : ''} flex-col !items-stretch`}>
                    {isEditing ? (
                      <div className="flex flex-col gap-3 animate-in w-full">
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-muted)' }}>{task.description}</p>
                        <textarea className="textarea-input textarea-note" style={{ minHeight: '140px', backgroundColor: 'var(--surface)' }}
                          value={editContent} onChange={e => setEditContent(e.target.value)} />
                        <div className="flex gap-3">
                          <button className="action-btn action-btn-note active" onClick={() => handleEditSaveTask(task.id)} style={{ padding: '0.5rem 1.2rem', borderRadius: '6px' }}>Save</button>
                          <button className="action-btn" onClick={() => setEditingId(null)} style={{ padding: '0.5rem 1.2rem', borderRadius: '6px' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center w-full gap-2">
                          <button className="text-left font-medium flex items-start flex-1 transition-colors gap-2"
                            onClick={() => toggleNote(noteId)}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)', flexShrink: 0, marginTop: '6px', display: 'inline-block' }} />
                            <div className="flex-1 min-w-0">
                              <span className="text-base leading-snug block">{task.description}</span>
                              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{task.weekTitle}</span>
                            </div>
                            <span className="text-muted text-sm flex-shrink-0 mt-1">{isOpen ? '▲' : '▼'}</span>
                          </button>
                          <button onClick={() => { setEditingId(noteId); setEditContent(tasksData[task.id]); setExpandedNotes(prev => { const n = new Set(prev); n.add(noteId); return n; }); }}
                            className="action-btn" title="Edit" style={{ padding: '0.3rem 0.6rem', flexShrink: 0, fontWeight: 600 }}>Edit</button>
                          <button onClick={() => { if (confirm('Delete this note?')) handleDeleteTaskNote(task.id); }}
                            className="action-btn" title="Delete" style={{ padding: '0.3rem 0.6rem', flexShrink: 0, color: '#ef4444', fontWeight: 600 }}>Delete</button>
                        </div>
                        {isOpen && (
                          <div className="mt-3 animate-in markdown-body" style={{ paddingLeft: '1.25rem' }}>
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
    </div>
  );
}

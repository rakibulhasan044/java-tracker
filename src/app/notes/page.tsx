"use client";

import { useState, useEffect } from "react";
import roadmapData from "../data/roadmap.json";
import Link from "next/link";

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

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(data => {
        if (data.notes) {
          if (data.notes.weeks) setWeeksData(data.notes.weeks);
          if (data.notes.tasks) setTasksData(data.notes.tasks);
        } else {
          const savedNotes = localStorage.getItem("java-roadmap-notes");
          if (savedNotes) {
            try {
              const parsed = JSON.parse(savedNotes);
              if (parsed.weeks) setWeeksData(parsed.weeks);
              if (parsed.tasks) setTasksData(parsed.tasks);
            } catch (e) { console.error(e); }
          }
        }
        setMounted(true);
      })
      .catch(() => setMounted(true));
  }, []);

  const handleSaveNote = () => {
    if (!newContent.trim()) return;
    const noteText = newTitle.trim()
      ? `**${newTitle.trim()}**\n${newContent.trim()}`
      : newContent.trim();

    const fullNotes = JSON.parse(localStorage.getItem("java-roadmap-notes") || '{"weeks":{}}');
    const currentText = fullNotes.weeks?.[selectedWeek] || '';
    const separator = currentText.trim() ? '\n\n---\n\n' : '';
    const newText = currentText + separator + noteText;

    const updatedNotes = {
      ...fullNotes,
      weeks: { ...(fullNotes.weeks || {}), [selectedWeek]: newText }
    };

    localStorage.setItem("java-roadmap-notes", JSON.stringify(updatedNotes));
    setWeeksData(updatedNotes.weeks);

    const progress = JSON.parse(localStorage.getItem("java-roadmap-progress") || "{}");
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress, notes: updatedNotes })
    }).catch(e => console.error(e));

    setIsAddingNote(false);
    setNewTitle("");
    setNewContent("");
  };

  const toggleNote = (id: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const parseNotes = (text: string) => {
    const blocks = text.split('\n\n---\n\n');
    return blocks.map((block, i) => {
      const lines = block.trim().split('\n');
      const firstLine = lines[0] || '';
      const titleMatch = firstLine.match(/^\*\*(.+)\*\*$/);
      if (titleMatch) {
        return { title: titleMatch[1], content: lines.slice(1).join('\n').trim(), id: String(i) };
      }
      return { title: `Note ${i + 1}`, content: block.trim(), id: String(i) };
    }).filter(n => n.content);
  };

  if (!mounted) return null;

  const activePhase = roadmapData.phases.find(p => p.id === activePhaseId);
  const weeksWithNotes = activePhase?.weeks.filter(w => weeksData[w.id]?.trim()) || [];

  // also gather task notes for this phase
  const tasksWithNotes = activePhase?.weeks.flatMap(w =>
    w.tasks
      .filter(t => tasksData[t.id]?.trim())
      .map(t => ({ ...t, weekTitle: w.title }))
  ) || [];

  const hasAny = weeksWithNotes.length > 0 || tasksWithNotes.length > 0;

  return (
    <div className="animate-in">
      {/* Header */}
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl mb-2">My Notes</h1>
          <p className="text-muted text-lg">All your saved notes, organized by phase</p>
        </div>
        <div className="flex gap-3 items-center">
          <Link
            href="/interview"
            className="action-btn action-btn-interview active"
            style={{ padding: '0.6rem 1.1rem', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none' }}
          >
            Interview Qs →
          </Link>
          <Link
            href="/"
            className="badge"
            style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      {/* Add Note Form */}
      {isAddingNote ? (
        <div className="card mb-8 animate-in" style={{ borderColor: 'var(--color-note)', borderWidth: '2px' }}>
          <h2 className="text-2xl mb-4 font-semibold">Add New Note</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block mb-2 font-medium">Select Week</label>
              <select
                className="textarea-input"
                style={{ minHeight: 'auto', padding: '0.75rem', width: '100%', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
                value={selectedWeek}
                onChange={e => setSelectedWeek(e.target.value)}
              >
                {roadmapData.phases.map(phase => (
                  <optgroup key={phase.id} label={phase.title}>
                    {phase.weeks.map(w => (
                      <option key={w.id} value={w.id}>{w.title}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-2 font-medium">Title <span className="text-muted font-medium">(optional)</span></label>
              <input
                className="textarea-input"
                style={{ minHeight: 'auto', padding: '0.75rem', width: '100%' }}
                placeholder="e.g. HashMap internals, key takeaway..."
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Note Content</label>
              <textarea
                className="textarea-input textarea-note"
                style={{ minHeight: '180px' }}
                placeholder="Write your note here..."
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
              />
            </div>
            <div className="flex gap-4 mt-2">
              <button className="action-btn action-btn-note active" onClick={handleSaveNote} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px' }}>
                Save Note
              </button>
              <button className="action-btn" onClick={() => setIsAddingNote(false)} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <button
            className="action-btn action-btn-note active"
            onClick={() => setIsAddingNote(true)}
            style={{ padding: '0.75rem 1.5rem', fontSize: '1.05rem', borderRadius: '8px' }}
          >
            + Add New Note
          </button>
        </div>
      )}

      {/* Phase Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-4 mb-6" style={{ scrollbarWidth: 'none' }}>
        {roadmapData.phases.map(phase => (
          <button
            key={phase.id}
            onClick={() => setActivePhaseId(phase.id)}
            className="action-btn"
            style={{
              padding: '0.7rem 1.4rem',
              whiteSpace: 'nowrap',
              borderRadius: '8px',
              border: activePhaseId === phase.id ? '2px solid var(--color-note)' : '1px solid var(--border)',
              backgroundColor: activePhaseId === phase.id ? 'var(--bg-note)' : 'transparent',
              color: activePhaseId === phase.id ? 'var(--color-note)' : 'var(--foreground)',
              fontWeight: activePhaseId === phase.id ? '600' : '500',
            }}
          >
            {phase.title}
          </button>
        ))}
      </div>

      {/* Notes Content */}
      <div className="flex flex-col gap-8 animate-in">
        {!hasAny && (
          <div className="card text-center p-12 text-muted text-lg">
            No notes saved for {activePhase?.title} yet.<br /><br />
            Add notes here or directly on the dashboard!
          </div>
        )}

        {/* Weekly notes */}
        {weeksWithNotes.map(week => {
          const notesList = parseNotes(weeksData[week.id]);
          return (
            <div key={week.id} className="card">
              <h3 className="text-2xl font-semibold mb-6 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                {week.title}
              </h3>
              <div className="flex flex-col gap-4">
                {notesList.map((note) => {
                  const noteId = `${week.id}-${note.id}`;
                  const isOpen = expandedNotes.has(noteId);
                  return (
                    <div key={noteId} className="border-b last:border-0 pb-4 mb-2 last:mb-0 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                      <button
                        className="text-left font-medium flex items-center w-full transition-colors"
                        onClick={() => toggleNote(noteId)}
                      >
                        <span
                          className="inline-block mr-3 flex-shrink-0"
                          style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            backgroundColor: 'var(--color-note)', marginTop: '2px'
                          }}
                        />
                        <span className="text-lg leading-snug flex-1">{note.title}</span>
                        <span className="text-muted ml-3 text-sm flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
                      </button>
                      {isOpen && (
                        <div
                          className="mt-4 whitespace-pre-wrap animate-in"
                          style={{ lineHeight: '1.75', fontSize: '1rem', color: 'var(--text-muted)', paddingLeft: '1.25rem' }}
                        >
                          {note.content}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Per-task notes */}
        {tasksWithNotes.length > 0 && (
          <div className="card">
            <h3 className="text-2xl font-semibold mb-6 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
              Topic Notes
            </h3>
            <div className="flex flex-col gap-4">
              {tasksWithNotes.map(task => {
                const noteId = `task-${task.id}`;
                const isOpen = expandedNotes.has(noteId);
                return (
                  <div key={noteId} className="border-b last:border-0 pb-4 mb-2 last:mb-0 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                    <button
                      className="text-left font-medium flex items-center w-full transition-colors"
                      onClick={() => toggleNote(noteId)}
                    >
                      <span
                        className="inline-block mr-3 flex-shrink-0"
                        style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          backgroundColor: 'var(--accent)', marginTop: '2px'
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-lg leading-snug block">{task.description}</span>
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{task.weekTitle}</span>
                      </div>
                      <span className="text-muted ml-3 text-sm flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
                    </button>
                    {isOpen && (
                      <div
                        className="mt-4 whitespace-pre-wrap animate-in"
                        style={{ lineHeight: '1.75', fontSize: '1rem', color: 'var(--text-muted)', paddingLeft: '1.25rem' }}
                      >
                        {tasksData[task.id]}
                      </div>
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

/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import roadmapData from "../data/roadmap.json";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

const parseQA = (text: string) => {
  const parts = text.split(/\n\n(?=\*\*Q:)/);
  return parts.map((block, i) => {
    const trimmed = block.trim();
    const match = trimmed.match(/^\*\*Q:\s*(.+?)\*\*\n([\s\S]*)$/);
    if (match) return { q: match[1].trim(), a: match[2].trim(), id: String(i) };
    if (trimmed) return { q: 'General Note', a: trimmed, id: String(i) };
    return null;
  }).filter(Boolean) as { q: string; a: string; id: string }[];
};

const serializeQA = (items: { q: string; a: string }[]) =>
  items.map(item =>
    item.q === 'General Note' ? item.a : `**Q: ${item.q}**\n${item.a}`
  ).join('\n\n');

const saveAndSync = (updatedNotes: any) => {
  localStorage.setItem("java-roadmap-notes", JSON.stringify(updatedNotes));
  const progress = JSON.parse(localStorage.getItem("java-roadmap-progress") || "{}");
  
    
    fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ progress, notes: updatedNotes })
  }).catch(console.error);
};

export default function InterviewQuestions() {
  const [interviewData, setInterviewData] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);

  const [isAddingQA, setIsAddingQA] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(roadmapData.phases[0].weeks[0].id);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");

  const [activePhaseId, setActivePhaseId] = useState(roadmapData.phases[0].id);
  const [expandedQA, setExpandedQA] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const [editWeekId, setEditWeekId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ weekId: string; qaId: string } | null>(null);

  useEffect(() => {
    setMounted(true);
    
    const saved = localStorage.getItem("java-roadmap-notes");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.interview) setInterviewData(p.interview);
      } catch(e) {}
    }
    fetch('/api/data', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.notes) {
          localStorage.setItem("java-roadmap-notes", JSON.stringify(data.notes));
          if (data.notes.interview) setInterviewData(data.notes.interview);
        } else {
          const saved = localStorage.getItem("java-roadmap-notes");
          if (saved) {
            try { const p = JSON.parse(saved); if (p.interview) setInterviewData(p.interview); }
            catch (e) { console.error(e); }
          }
        }
        
      })
      .catch(() => setMounted(true));
  }, []);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    handleDelete(deleteTarget.weekId, deleteTarget.qaId);
    setDeleteTarget(null);
    showToast('✓ Question deleted!');
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const updateWeekQAs = (weekId: string, items: { q: string; a: string }[]) => {
    const newText = serializeQA(items);
    const updated = { ...interviewData, [weekId]: newText };
    if (!newText.trim()) delete updated[weekId];
    setInterviewData(updated);
    const fullNotes = JSON.parse(localStorage.getItem("java-roadmap-notes") || "{}");
    saveAndSync({ ...fullNotes, interview: updated });
  };

  const handleSaveQA = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    const fullNotes = JSON.parse(localStorage.getItem("java-roadmap-notes") || "{}");
    const existing = parseQA(interviewData[selectedWeek] || "");
    const newItems = [...existing, { q: newQuestion.trim(), a: newAnswer.trim() }];
    const newText = serializeQA(newItems);
    const updated = { ...interviewData, [selectedWeek]: newText };
    setInterviewData(updated);
    saveAndSync({ ...fullNotes, interview: updated });
    setIsAddingQA(false);
    setNewQuestion(""); setNewAnswer("");
    showToast('✓ Question saved!');
  };

  const handleDelete = (weekId: string, qaId: string) => {
    const items = parseQA(interviewData[weekId] || "").filter(item => item.id !== qaId);
    updateWeekQAs(weekId, items);
  };

  const handleEditSave = (weekId: string, qaId: string) => {
    const items = parseQA(interviewData[weekId] || "").map(item =>
      item.id === qaId ? { ...item, q: editQ, a: editA } : item
    );
    updateWeekQAs(weekId, items);
    setEditingId(null);
    showToast('✓ Question updated!');
  };

  if (!mounted) return null;

  const activePhase = roadmapData.phases.find(p => p.id === activePhaseId);
  const weeksWithQs = activePhase?.weeks.filter(w => interviewData[w.id]?.trim()) || [];

  return (
    <div className="animate-in">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Interview Qs</h1>
          <p className="text-muted text-lg">Saved interview questions and answers</p>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/" className="action-btn active" style={{ padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>Dashboard</Link>
          <Link href="/notes" className="action-btn action-btn-note active" style={{ padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>Notes</Link>
          <Link href="/projects" className="action-btn active" style={{ padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: 'var(--foreground)', color: 'var(--background)' }}>Projects</Link>
        </div>
      </header>

      {/* Add Q&A Form */}
      {isAddingQA ? (
        <div className="card mb-8 animate-in" style={{ borderColor: 'var(--color-interview)', borderWidth: '2px' }}>
          <h2 className="text-2xl mb-4 font-semibold">Add New Q&amp;A</h2>
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
              <label className="block mb-2 font-medium">Question</label>
              <input className="textarea-input" style={{ minHeight: 'auto', padding: '0.75rem', width: '100%' }}
                placeholder="Enter the interview question..." value={newQuestion} onChange={e => setNewQuestion(e.target.value)} />
            </div>
            <div>
              <label className="block mb-2 font-medium">Answer</label>
              <textarea className="textarea-input textarea-interview" style={{ minHeight: '150px' }}
                placeholder="Enter the answer..." value={newAnswer} onChange={e => setNewAnswer(e.target.value)} />
            </div>
            <div className="flex gap-3 mt-2">
              <button className="action-btn action-btn-interview active" onClick={handleSaveQA} style={{ padding: '0.7rem 1.5rem', borderRadius: '8px' }}>Save Q&amp;A</button>
              <button className="action-btn" onClick={() => setIsAddingQA(false)} style={{ padding: '0.7rem 1.5rem', borderRadius: '8px' }}>Cancel</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <button className="action-btn action-btn-interview active" onClick={() => setIsAddingQA(true)}
            style={{ padding: '0.75rem 1.5rem', fontSize: '1.05rem', borderRadius: '8px' }}>
            + Add New Q&amp;A
          </button>
        </div>
      )}

      {/* Phase Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-4 mb-6" style={{ scrollbarWidth: 'none' }}>
        {roadmapData.phases.map(phase => (
          <button key={phase.id} onClick={() => setActivePhaseId(phase.id)} className="action-btn"
            style={{
              padding: '0.7rem 1.4rem', whiteSpace: 'nowrap', borderRadius: '8px',
              border: activePhaseId === phase.id ? '2px solid var(--color-interview)' : '1px solid var(--border)',
              backgroundColor: activePhaseId === phase.id ? 'var(--bg-interview)' : 'transparent',
              color: activePhaseId === phase.id ? 'var(--color-interview)' : 'var(--foreground)',
              fontWeight: activePhaseId === phase.id ? '600' : '500',
            }}>
            {phase.title}
          </button>
        ))}
      </div>

      {/* QA List */}
      <div className="flex flex-col gap-4 animate-in">
        {weeksWithQs.length === 0 && (
          <div className="card text-center p-12 text-muted text-lg">
            No interview questions saved for {activePhase?.title} yet.<br /><br />Add them here or on the dashboard!
          </div>
        )}
        {weeksWithQs.map(week => {
          const qaList = parseQA(interviewData[week.id]);
          return (
            <div key={week.id} className="card">
              <h3 className="text-lg font-semibold mb-3 border-b pb-3" style={{ borderColor: 'var(--border)' }}>{week.title}</h3>
              <div className="flex flex-col gap-1">{qaList.map(item => {
                  const qaId = `${week.id}-${item.id}`;
                  const isExpanded = expandedQA.has(qaId);
                  const isEditing = editingId === qaId;
                  return (
                    <div key={qaId} className={`qa-wrapper ${isExpanded ? 'expanded' : ''} flex-col !items-stretch`}>
                      {false ? null : (
                        <>
                          <div className="flex items-center w-full gap-2">
                            <button className="text-left font-medium flex items-center flex-1 transition-colors"
                              onClick={() => setExpandedQA(prev => { const n = new Set(prev); n.has(qaId) ? n.delete(qaId) : n.add(qaId); return n; })}>
                              <span className="text-base leading-snug flex-1">{item.q}</span>
                              <span className="text-muted ml-2 text-sm flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                            </button>
                            <button
                              onClick={() => { setEditingId(item.id); setEditWeekId(week.id); setEditQ(item.q); setEditA(item.a); }}
                              className="action-btn" title="Edit"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem', flexShrink: 0, fontWeight: 600 }}>Edit</button>
                            <button
                              onClick={() => setDeleteTarget({ weekId: week.id, qaId: item.id })}
                              className="action-btn" title="Delete"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem', flexShrink: 0, color: '#ef4444', fontWeight: 600 }}>Delete</button>
                          </div>
                          {isExpanded && (
                            <div className="mt-3 animate-in markdown-body" style={{ paddingLeft: '0.25rem' }}>
                              <ReactMarkdown>{item.a}</ReactMarkdown>
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
      </div>

      {/* Edit Q&A Modal */}
      {editingId && editWeekId && (
        <div className="modal-backdrop" onClick={() => { setEditingId(null); setEditWeekId(null); }}>
          <div className="modal-box" style={{ maxWidth: '680px', width: '94vw' }} onClick={e => e.stopPropagation()}>
            <p className="modal-title" style={{ marginBottom: '1rem' }}>✏️ Edit Question</p>
            <input
              className="textarea-input"
              style={{ minHeight: 'auto', padding: '0.6rem 0.85rem', width: '100%', fontWeight: 600, backgroundColor: 'var(--surface)', marginBottom: '0.75rem' }}
              placeholder="Question..."
              value={editQ}
              onChange={e => setEditQ(e.target.value)}
              autoFocus
            />
            <textarea
              className="textarea-input"
              style={{ minHeight: '48vh', width: '100%', backgroundColor: 'var(--surface)', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.93rem', lineHeight: 1.7, padding: '0.75rem' }}
              placeholder="Answer (markdown supported)..."
              value={editA}
              onChange={e => setEditA(e.target.value)}
            />
            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button className="modal-btn-cancel" onClick={() => { setEditingId(null); setEditWeekId(null); }}>Cancel</button>
              <button
                className="action-btn action-btn-interview active"
                style={{ padding: '0.55rem 1.2rem', borderRadius: '8px', fontWeight: 600, fontSize: '0.88rem' }}
                onClick={() => { handleEditSave(editWeekId, editingId); setEditWeekId(null); }}
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
            <p className="modal-title">Delete Question?</p>
            <p className="modal-body">This Q&A entry will be permanently deleted and cannot be undone.</p>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="modal-btn-delete" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className="toast success">{toast}</div>
        </div>
      )}
    </div>
  );
}

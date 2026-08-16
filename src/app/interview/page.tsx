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

  useEffect(() => {
    fetch('/api/data')
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
        setMounted(true);
      })
      .catch(() => setMounted(true));
  }, []);

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
  };

  if (!mounted) return null;

  const activePhase = roadmapData.phases.find(p => p.id === activePhaseId);
  const weeksWithQs = activePhase?.weeks.filter(w => interviewData[w.id]?.trim()) || [];

  return (
    <div className="animate-in">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl mb-2">Interview Questions</h1>
          <p className="text-muted text-lg">Your saved interview prep by phase</p>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/notes" className="action-btn action-btn-note active" style={{ padding: '0.6rem 1.1rem', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none' }}>
            Notes →
          </Link>
          <Link href="/" className="badge" style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}>
            ← Dashboard
          </Link>
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
      <div className="flex flex-col gap-8 animate-in">
        {weeksWithQs.length === 0 && (
          <div className="card text-center p-12 text-muted text-lg">
            No interview questions saved for {activePhase?.title} yet.<br /><br />Add them here or on the dashboard!
          </div>
        )}
        {weeksWithQs.map(week => {
          const qaList = parseQA(interviewData[week.id]);
          return (
            <div key={week.id} className="card">
              <h3 className="text-2xl font-semibold mb-6 border-b pb-4" style={{ borderColor: 'var(--border)' }}>{week.title}</h3>
              <div className="flex flex-col gap-2">
                {qaList.map(item => {
                  const qaId = `${week.id}-${item.id}`;
                  const isExpanded = expandedQA.has(qaId);
                  const isEditing = editingId === qaId;
                  return (
                    <div key={qaId} className="border-b last:border-0 pb-4 mb-2 last:mb-0 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                      {isEditing ? (
                        <div className="flex flex-col gap-3 animate-in p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-interview)', border: '1px solid var(--border-interview)' }}>
                          <input className="textarea-input" style={{ minHeight: 'auto', padding: '0.6rem 0.75rem', width: '100%', fontWeight: 600 }}
                            value={editQ} onChange={e => setEditQ(e.target.value)} placeholder="Question..." />
                          <textarea className="textarea-input" style={{ minHeight: '120px' }}
                            value={editA} onChange={e => setEditA(e.target.value)} placeholder="Answer..." />
                          <div className="flex gap-3">
                            <button className="action-btn action-btn-interview active" onClick={() => handleEditSave(week.id, item.id)} style={{ padding: '0.5rem 1.2rem', borderRadius: '6px' }}>Save</button>
                            <button className="action-btn" onClick={() => setEditingId(null)} style={{ padding: '0.5rem 1.2rem', borderRadius: '6px' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center w-full gap-2">
                            <button className="text-left font-medium flex items-center flex-1 transition-colors"
                              onClick={() => setExpandedQA(prev => { const n = new Set(prev); n.has(qaId) ? n.delete(qaId) : n.add(qaId); return n; })}>
                              <span className="text-base leading-snug flex-1">{item.q}</span>
                              <span className="text-muted ml-2 text-sm flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                            </button>
                            <button
                              onClick={() => { setEditingId(qaId); setEditQ(item.q); setEditA(item.a); setExpandedQA(prev => { const n = new Set(prev); n.add(qaId); return n; }); }}
                              className="action-btn" title="Edit"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem', flexShrink: 0, fontWeight: 600 }}>Edit</button>
                            <button
                              onClick={() => { if (confirm('Delete this question?')) handleDelete(week.id, item.id); }}
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
    </div>
  );
}

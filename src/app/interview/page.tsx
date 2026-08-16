"use client";

import { useState, useEffect } from "react";
import roadmapData from "../data/roadmap.json";
import Link from "next/link";

const parseQA = (text: string) => {
  const parts = text.split('**Q:');
  const items = [];
  
  if (parts[0].trim()) {
    items.push({ q: 'General Notes', a: parts[0].trim() });
  }
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const qEndIndex = part.indexOf('**');
    if (qEndIndex !== -1) {
      const q = part.substring(0, qEndIndex).trim();
      const a = part.substring(qEndIndex + 2).trim();
      items.push({ q, a });
    } else {
      items.push({ q: 'Question', a: part.trim() });
    }
  }
  return items;
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

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(data => {
        if (data.notes && data.notes.interview) {
          setInterviewData(data.notes.interview);
        } else {
          const savedNotes = localStorage.getItem("java-roadmap-notes");
          if (savedNotes) {
            try {
              const parsed = JSON.parse(savedNotes);
              if (parsed.interview) setInterviewData(parsed.interview);
            } catch (e) { console.error(e) }
          }
        }
        setMounted(true);
      })
      .catch(() => setMounted(true));
  }, []);

  const handleSaveQA = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    const qaText = `\n\n**Q: ${newQuestion.trim()}**\n${newAnswer.trim()}`;
    
    const fullNotes = JSON.parse(localStorage.getItem("java-roadmap-notes") || '{"interview":{}}');
    const currentWeekText = fullNotes.interview?.[selectedWeek] || '';
    const newText = (currentWeekText + qaText).trimStart();
    
    const updatedNotes = {
      ...fullNotes,
      interview: {
        ...(fullNotes.interview || {}),
        [selectedWeek]: newText
      }
    };
    
    localStorage.setItem("java-roadmap-notes", JSON.stringify(updatedNotes));
    setInterviewData(updatedNotes.interview);
    
    const progress = JSON.parse(localStorage.getItem("java-roadmap-progress") || "{}");
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress, notes: updatedNotes })
    }).catch(e => console.error(e));
    
    setIsAddingQA(false);
    setNewQuestion("");
    setNewAnswer("");
  };

  if (!mounted) return null;

  const hasAnyQuestions = Object.values(interviewData).some(q => q && q.trim().length > 0);

  return (
    <div className="animate-in">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl mb-2">Interview Questions</h1>
          <p className="text-muted text-lg">Your saved interview prep by phase</p>
        </div>
        <Link href="/" className="badge" style={{ padding: '0.6rem 1rem', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          &larr; Back to Dashboard
        </Link>
      </header>

      {isAddingQA ? (
        <div className="card mb-8 animate-in" style={{ borderColor: 'var(--primary)', borderWidth: '2px' }}>
          <h2 className="text-2xl mb-4 font-semibold">Add New Q&A</h2>
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
              <label className="block mb-2 font-medium">Question</label>
              <input 
                className="textarea-input" 
                style={{ minHeight: 'auto', padding: '0.75rem', width: '100%' }}
                placeholder="Enter the interview question..."
                value={newQuestion}
                onChange={e => setNewQuestion(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Answer</label>
              <textarea 
                className="textarea-input textarea-large" 
                style={{ minHeight: '150px' }}
                placeholder="Enter the answer or notes..."
                value={newAnswer}
                onChange={e => setNewAnswer(e.target.value)}
              />
            </div>
            <div className="flex gap-4 mt-2">
              <button className="action-btn action-btn-interview active" onClick={handleSaveQA} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px' }}>
                Save Q&A
              </button>
              <button className="action-btn" onClick={() => setIsAddingQA(false)} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <button 
            className="action-btn action-btn-interview active" 
            onClick={() => setIsAddingQA(true)}
            style={{ padding: '0.75rem 1.5rem', fontSize: '1.1rem', borderRadius: '8px' }}
          >
            + Add New Q&A
          </button>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4 mb-6">
        {roadmapData.phases.map(phase => (
          <button
            key={phase.id}
            onClick={() => setActivePhaseId(phase.id)}
            className={`action-btn ${activePhaseId === phase.id ? 'active' : ''}`}
            style={{ 
              padding: '0.75rem 1.5rem', 
              whiteSpace: 'nowrap', 
              borderRadius: '8px', 
              border: activePhaseId === phase.id ? '2px solid var(--primary)' : '1px solid var(--border)',
              backgroundColor: activePhaseId === phase.id ? 'var(--bg-note)' : 'transparent',
              color: 'var(--foreground)'
            }}
          >
            {phase.title}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-8">
        {(() => {
          const phase = roadmapData.phases.find(p => p.id === activePhaseId);
          if (!phase) return null;

          const phaseWeeksWithQs = phase.weeks.filter(w => !!interviewData[w.id] && interviewData[w.id].trim().length > 0);
          
          if (phaseWeeksWithQs.length === 0) {
            return (
              <div className="card text-center p-12 text-muted text-lg">
                No interview questions saved for {phase.title} yet.<br/><br/>
                Add them here or on the dashboard!
              </div>
            );
          }

          return (
            <div className="flex flex-col gap-8 animate-in">
              {phaseWeeksWithQs.map(week => {
                const qaList = parseQA(interviewData[week.id]);
                return (
                  <div key={week.id} className="card">
                    <h3 className="text-2xl font-semibold mb-6 text-[var(--foreground)] border-b border-[var(--border)] pb-4">{week.title}</h3>
                    <div className="flex flex-col gap-4">
                      {qaList.map((item, idx) => {
                        const qaId = `${week.id}-${idx}`;
                        const isExpanded = expandedQA.has(qaId);
                        return (
                          <div key={qaId} className="border-b border-[var(--border)] last:border-0 pb-4 mb-4 last:mb-0 last:pb-0">
                            <button 
                              className="text-left font-medium flex items-center transition-colors w-full"
                              onClick={() => {
                                setExpandedQA(prev => {
                                  const next = new Set(prev);
                                  if (next.has(qaId)) next.delete(qaId);
                                  else next.add(qaId);
                                  return next;
                                });
                              }}
                            >
                              <span className="text-lg leading-snug">{item.q}</span>
                              <span className="text-muted ml-3 text-sm flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                            </button>
                            {isExpanded && (
                              <div className="mt-4 whitespace-pre-wrap text-[1.05rem] text-[var(--text-muted)]" style={{ lineHeight: '1.7' }}>
                                {item.a}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

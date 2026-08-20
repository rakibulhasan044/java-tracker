"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type QA = {
  question: string;
  answer: string;
  level: "Junior" | "Medium";
  phase: "Java Core" | "SQL Mastery" | "DSA" | "Spring Boot";
};

export default function QABankPage() {
  const [questions, setQuestions] = useState<QA[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>("All");
  const [filterPhase, setFilterPhase] = useState<string>("All");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/data")
      .then(res => res.json())
      .then(data => {
        if (data.qabank && Array.isArray(data.qabank)) {
          setQuestions(data.qabank);
        }
      })
      .catch(console.error);
  }, []);

  const filteredQuestions = questions.filter(q => {
    const matchLevel = filterLevel === "All" || q.level === filterLevel;
    const matchPhase = filterPhase === "All" || q.phase === filterPhase;
    return matchLevel && matchPhase;
  });

  const baseStyle = { padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' };

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto pb-24">
      <header className="mb-12 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">QA Bank</h1>
          <p className="text-muted text-lg">Curated interview questions for Java Engineers</p>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/" className="action-btn active" style={{ ...baseStyle, backgroundColor: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>Dashboard</Link>
          <Link href="/notes" className="action-btn action-btn-note active" style={baseStyle as any}>Notes</Link>
          <Link href="/interview" className="action-btn action-btn-interview active" style={baseStyle as any}>Interview Qs</Link>
          <Link href="/projects" className="action-btn active" style={{ ...baseStyle, backgroundColor: 'var(--foreground)', color: 'var(--background)' }}>Projects</Link>
        </div>
      </header>

      <div className="mb-8 flex gap-4 items-center">
        <span className="font-bold text-sm text-muted">Filters:</span>
        <select 
          className="border rounded-lg  outline-none focus:border-[var(--primary)]" 
          style={{ height: '36px', padding: '0 1rem', width: '200px', cursor: 'pointer', borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
        >
          <option value="All">All Levels</option>
          <option value="Junior">Junior</option>
          <option value="Medium">Medium</option>
        </select>

        <select 
          className="border rounded-lg  outline-none focus:border-[var(--primary)]" 
          style={{ height: '36px', padding: '0 1rem', width: '200px', cursor: 'pointer', borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}
          value={filterPhase}
          onChange={(e) => setFilterPhase(e.target.value)}
        >
          <option value="All">All Phases</option>
          <option value="Java Core">Java Core</option>
          <option value="SQL Mastery">SQL Mastery</option>
          <option value="DSA">DSA</option>
          <option value="Spring Boot">Spring Boot</option>
        </select>
      </div>

      <div className="flex flex-col gap-4">
        {filteredQuestions.length === 0 ? (
          <div className="p-8 text-center text-muted border rounded-xl bg-[var(--surface)]">
            No questions found for the selected filters.
          </div>
        ) : (
          filteredQuestions.map((q, idx) => {
            const isExpanded = expandedIndex === idx;
            return (
              <div key={idx} className="card p-0 overflow-hidden cursor-pointer transition-all" onClick={() => setExpandedIndex(isExpanded ? null : idx)}>
                <div className="p-5 flex justify-between items-center bg-[var(--surface)] hover:bg-[var(--bg-hover)]">
                  <div className="flex-1 pr-4">
                    <div className="flex gap-2 mb-2">
                      <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)' }}>{q.level}</span>
                      <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>{q.phase}</span>
                    </div>
                    <h3 className="font-semibold text-lg">{q.question}</h3>
                  </div>
                  <div className="text-2xl text-muted font-light px-2">
                    {isExpanded ? '−' : '+'}
                  </div>
                </div>
                {isExpanded && (
                  <div className="p-5 border-t text-muted leading-relaxed" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }}>
                    {q.answer}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

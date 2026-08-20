"use client";

import { useState, useEffect } from "react";
import roadmapData from "../data/roadmap.json";
import Link from "next/link";

type Submission = {
  tier: "easy" | "medium" | "hard";
  github: string;
  live: string;
};

type SubmissionsData = Record<string, Submission>;

export default function ProjectsPage() {
  const [submissions, setSubmissions] = useState<SubmissionsData>({});
  const [expandedTier, setExpandedTier] = useState<{ projectId: string; tier: string } | null>(null);
  const [formData, setFormData] = useState<Record<string, Submission>>({});

  useEffect(() => {
    fetch("/api/data")
      .then(res => res.json())
      .then(data => {
        if (data.submissions && Object.keys(data.submissions).length > 0) {
          setSubmissions(data.submissions);
          localStorage.setItem("java-roadmap-submissions", JSON.stringify(data.submissions));
        } else {
          const saved = localStorage.getItem("java-roadmap-submissions");
          if (saved) {
            try { setSubmissions(JSON.parse(saved)); } catch (e) {}
          }
        }
      })
      .catch(console.error);
  }, []);

  const syncToServer = async (newSubmissions: SubmissionsData) => {
    try {
      const res = await fetch("/api/data");
      const current = await res.json();
      await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...current, submissions: newSubmissions }),
      });
    } catch (e) { console.error(e); }
  };

  const handleFormChange = (projectId: string, field: keyof Submission, value: string) => {
    setFormData(prev => ({ ...prev, [projectId]: { ...prev[projectId], [field]: value } }));
  };

  const handleSubmit = (projectId: string, tier: "easy" | "medium" | "hard") => {
    const data = formData[projectId] || { tier, github: "", live: "" };
    if (!data.github) {
      alert("Please provide a GitHub link to submit.");
      return;
    }
    data.tier = tier;
    setSubmissions(prev => {
      const next = { ...prev, [projectId]: data };
      localStorage.setItem("java-roadmap-submissions", JSON.stringify(next));
      syncToServer(next);
      return next;
    });
    setExpandedTier(null);
  };

  const projects = roadmapData.phases.flatMap(phase => 
    phase.weeks.flatMap(week => 
      week.tasks.filter(t => t.type === "project").map(t => ({ ...t, phaseTitle: phase.title, weekTitle: week.title }))
    )
  );

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto pb-24">
      <header className="mb-12 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Projects</h1>
          <p className="text-muted text-lg">Detailed specifications and submission tracking.</p>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/" className="action-btn active" style={{ padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>Dashboard</Link>
          <Link href="/notes" className="action-btn action-btn-note active" style={{ padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>Notes</Link>
          <Link href="/interview" className="action-btn action-btn-interview active" style={{ padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>Interview Qs</Link>
            <Link href="/qabank" className="action-btn active" style={{ padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>QA Bank</Link>
        </div>
      </header>

      <div className="flex flex-col gap-10">
        {projects.map(project => {
          const submission = submissions[project.id];
          return (
            <div key={project.id} className="card relative overflow-hidden transition-all duration-300 p-0 mb-8">
              <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-xs font-bold text-muted uppercase tracking-wider">{project.phaseTitle}</span>
                <h3 className="text-2xl font-bold mt-1">{project.weekTitle}</h3>
                <p className="text-lg text-muted mt-2">{project.description}</p>
              </div>
              <div className="p-6 flex flex-col gap-6">
                {(['easy', 'medium', 'hard'] as const).map(tier => {
                  const isSubmitted = submission?.tier === tier;
                  const isExpanding = expandedTier?.projectId === project.id && expandedTier?.tier === tier;
                  const currentForm = formData[project.id] || submission || { tier, github: "", live: "" };

                  return (
                    <div key={tier} className="p-6 rounded-xl border bg-[var(--surface)] transition-all" style={{ borderColor: isSubmitted ? 'var(--primary)' : 'var(--border)' }}>
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-xl font-bold capitalize flex items-center gap-2" style={{ color: isSubmitted ? 'var(--primary)' : 'inherit' }}>
                          {isSubmitted && <span className="flex items-center justify-center bg-[var(--primary)] text-[var(--background)] rounded-full w-6 h-6 text-sm">✓</span>}
                          {tier} Tier
                        </h4>
                      </div>
                      
                      <div className="text-muted leading-relaxed whitespace-pre-wrap mb-6">
                        {(project as any).difficultyTiers[tier]}
                      </div>

                      {isSubmitted && !isExpanding ? (
                        <div className="p-4 rounded-lg bg-[var(--bg-hover)] border flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                          <div>
                            <div className="text-sm font-bold text-[var(--primary)] mb-1">Submission Approved</div>
                            <div className="flex gap-4 text-sm">
                              <a href={submission.github} target="_blank" rel="noreferrer" className="underline hover:text-[var(--primary)]">GitHub Repository</a>
                              {submission.live && <a href={submission.live} target="_blank" rel="noreferrer" className="underline hover:text-[var(--primary)]">Live Site</a>}
                            </div>
                          </div>
                          <button className="action-btn active" style={{ padding: '0.4rem 0.8rem' }} onClick={() => setExpandedTier({ projectId: project.id, tier })}>Edit Submission</button>
                        </div>
                      ) : null}

                      {(!isSubmitted && !isExpanding) ? (
                        <button className="action-btn active w-full py-3 rounded-lg font-bold text-base" onClick={() => {
                          setExpandedTier({ projectId: project.id, tier });
                          handleFormChange(project.id, 'github', currentForm.github);
                          handleFormChange(project.id, 'live', currentForm.live);
                        }}>
                          Submit {tier} Tier
                        </button>
                      ) : null}

                      {isExpanding && (
                        <div className="animate-in mt-4 p-5 rounded-xl border" style={{ backgroundColor: 'var(--bg-hover)', borderColor: 'var(--border)' }}>
                          <h5 className="font-bold mb-4">Submit {tier} Tier Details</h5>
                          <div className="flex flex-col gap-4">
                            <div>
                              <label className="block text-sm font-bold mb-1">GitHub Repository URL *</label>
                              <input type="url" placeholder="https://github.com/..." className="textarea-input w-full" style={{ height: '42px', padding: '0.5rem 0.75rem' }} value={currentForm.github} onChange={e => handleFormChange(project.id, 'github', e.target.value)} />
                            </div>
                            <div>
                              <label className="block text-sm font-bold mb-1">Live Site URL (Optional)</label>
                              <input type="url" placeholder="https://..." className="textarea-input w-full" style={{ height: '42px', padding: '0.5rem 0.75rem' }} value={currentForm.live} onChange={e => handleFormChange(project.id, 'live', e.target.value)} />
                            </div>
                            <div className="flex gap-3 mt-2">
                              <button className="action-btn active flex-1 py-2 rounded-lg font-bold" onClick={() => handleSubmit(project.id, tier)}>
                                {isSubmitted ? 'Update Submission' : 'Confirm Submission'}
                              </button>
                              <button className="action-btn flex-1 py-2 rounded-lg font-bold" onClick={() => setExpandedTier(null)}>Cancel</button>
                            </div>
                          </div>
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
    </div>
  );
}

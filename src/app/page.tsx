/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import roadmapData from "./data/roadmap.json";

type Task = {
  id: string;
  description: string;
  type: "learning" | "practice" | "project";
};

type Week = {
  id: string;
  title: string;
  tasks: Task[];
};

type Phase = {
  id: string;
  title: string;
  duration: string;
  weeks: Week[];
};

export default function TrackerDashboard() {
  const [completedTasks, setCompletedTasks] = useState<Record<string, string>>(
    {},
  );
  const [mounted, setMounted] = useState(false);
  const [activePhase, setActivePhase] = useState<string>(
    roadmapData.phases[0].id,
  );
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());

  const [notesData, setNotesData] = useState<{
    tasks: Record<string, string>;
    weeks: Record<string, string>;
    interview: Record<string, string>;
  }>({ tasks: {}, weeks: {}, interview: {} });

  const [openTaskNotes, setOpenTaskNotes] = useState<Set<string>>(new Set());
  const [openWeekNotes, setOpenWeekNotes] = useState<Set<string>>(new Set());
  const [openWeekInterview, setOpenWeekInterview] = useState<Set<string>>(
    new Set(),
  );

  const [dashboardNoteInputs, setDashboardNoteInputs] = useState<Record<string, {title: string, content: string}>>({});
  const [dashboardQaInputs, setDashboardQaInputs] = useState<Record<string, {q: string, a: string}>>({});
  const [dashboardTaskInputs, setDashboardTaskInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/data")
      .then((res) => res.json())
      .then((data) => {
        let loadedProgress = false;
        let loadedNotes = false;

        if (data.progress && Object.keys(data.progress).length > 0) {
          setCompletedTasks(data.progress);
          localStorage.setItem("java-roadmap-progress", JSON.stringify(data.progress));
          loadedProgress = true;
        }

        if (
          data.notes &&
          (Object.keys(data.notes.tasks || {}).length > 0 ||
            Object.keys(data.notes.weeks || {}).length > 0 || 
            Object.keys(data.notes.interview || {}).length > 0)
        ) {
          setNotesData(data.notes);
          localStorage.setItem("java-roadmap-notes", JSON.stringify(data.notes));
          loadedNotes = true;
        }

        if (!loadedProgress) {
          const savedProgress = localStorage.getItem("java-roadmap-progress");
          if (savedProgress) {
            try {
              const parsed = JSON.parse(savedProgress);
              if (!Array.isArray(parsed)) setCompletedTasks(parsed);
            } catch (e) {
              console.error(e);
            }
          }
        }

        if (!loadedNotes) {
          const savedNotes = localStorage.getItem("java-roadmap-notes");
          if (savedNotes) {
            try {
              setNotesData(JSON.parse(savedNotes));
            } catch (e) {
              console.error(e);
            }
          }
        }
        setMounted(true);
      })
      .catch(() => {
        setMounted(true);
      });
  }, []);

  const syncToServer = async (progress: any, notes: any) => {
    try {
      await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress, notes }),
      });
    } catch (e) {
      console.error("Failed to sync data", e);
    }
  };

  const toggleTask = (taskId: string) => {
    setCompletedTasks((prev) => {
      const next = { ...prev };
      if (next[taskId]) {
        delete next[taskId];
      } else {
        next[taskId] = new Date().toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
      localStorage.setItem("java-roadmap-progress", JSON.stringify(next));
      syncToServer(next, notesData);
      return next;
    });
  };

  const toggleWeek = (weekId: string) => {
    setCollapsedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekId)) next.delete(weekId);
      else next.add(weekId);
      return next;
    });
  };

  const toggleSet = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateNote = (
    type: "tasks" | "weeks" | "interview",
    id: string,
    value: string,
  ) => {
    setNotesData((prev) => {
      const next = { ...prev, [type]: { ...prev[type], [id]: value } };
      localStorage.setItem("java-roadmap-notes", JSON.stringify(next));
      syncToServer(completedTasks, next);
      return next;
    });
  };

  const toggleSetAndExpandWeek = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    weekId: string,
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(weekId)) next.delete(weekId);
      else next.add(weekId);
      return next;
    });
    setCollapsedWeeks((prev) => {
      const next = new Set(prev);
      next.delete(weekId);
      return next;
    });
  };

  if (!mounted) return null;

  const totalTasks = roadmapData.phases.reduce(
    (acc, phase) =>
      acc + phase.weeks.reduce((accW, week) => accW + week.tasks.length, 0),
    0,
  );

  const completedCount = Object.keys(completedTasks).length;
  const overallProgress = Math.round((completedCount / totalTasks) * 100) || 0;

  const currentPhaseData = roadmapData.phases.find(
    (p) => p.id === activePhase,
  )!;

  return (
    <div>
      <header className="mb-8">
        <div className="flex justify-between items-start mb-2 gap-4">
          <h1 className="text-3xl m-0">Java Backend Developer Roadmap</h1>
          <div className="flex gap-3 items-center">
            <Link
              href="/notes"
              className="action-btn action-btn-note active"
              style={{ padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Notes
            </Link>
            <Link
              href="/interview"
              className="action-btn action-btn-interview active"
              style={{ padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
            >Interview Qs</Link>
            <Link href="/qabank" className="action-btn active" style={{ padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>QA Bank</Link>
            <Link
              href="/projects"
              className="action-btn active"
              style={{ padding: '0 1.25rem', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap', backgroundColor: "var(--foreground)", color: "var(--background)" }}
            >
              Projects
            </Link>
          </div>
        </div>
        <p className="text-muted text-lg mb-6">
          9-month paced curriculum tracker
        </p>

        <div className="card">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-medium">Overall Progress</h2>
            <span className="font-semibold">{overallProgress}%</span>
          </div>
          <div className="progress-container">
            <div
              className="progress-bar"
              style={{ width: `${overallProgress}%` }}
            ></div>
          </div>
          <p className="text-sm text-muted mt-2">
            {completedCount} of {totalTasks} tasks completed
          </p>
        </div>
      </header>

      <div className="phases-scroll mb-8 animate-in">
        {roadmapData.phases.map((phase) => {
          const phaseTasks = phase.weeks.reduce(
            (acc, w) => acc + w.tasks.length,
            0,
          );
          const phaseCompleted = phase.weeks.reduce(
            (acc, w) =>
              acc + w.tasks.filter((t) => !!completedTasks[t.id]).length,
            0,
          );
          const phaseProgress =
            Math.round((phaseCompleted / phaseTasks) * 100) || 0;

          const isActive = activePhase === phase.id;

          return (
            <div
              key={phase.id}
              className={`card flex flex-col gap-2`}
              style={{
                minWidth: "260px",
                cursor: "pointer",
                borderColor: isActive ? "var(--primary)" : "var(--border)",
                borderWidth: isActive ? "2px" : "1px",
                padding: "1.25rem",
              }}
              onClick={() => setActivePhase(phase.id)}
            >
              <h3 className="font-medium text-lg">{phase.title}</h3>
              <p className="text-sm text-muted">{phase.duration}</p>
              <div className="progress-container mt-2">
                <div
                  className="progress-bar"
                  style={{ width: `${phaseProgress}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="animate-in" style={{ animationDelay: "0.1s" }}>
        <h2 className="text-2xl mb-6">{currentPhaseData.title} Timeline</h2>
        <div className="flex flex-col gap-6">
          {currentPhaseData.weeks.map((week) => {
            const weekTasks = week.tasks.length;
            const weekCompleted = week.tasks.filter(
              (t) => !!completedTasks[t.id],
            ).length;
            const isCollapsed = collapsedWeeks.has(week.id);
            const isProjectWeek = week.title.toLowerCase().includes("project");

            return (
              <div
                key={week.id}
                className={`card ${isProjectWeek ? "project-week" : ""}`}
              >
                <div
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => toggleWeek(week.id)}
                  style={{ marginBottom: isCollapsed ? "0" : "1.5rem" }}
                >
                  <div className="flex items-center gap-3">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: isCollapsed
                          ? "rotate(-90deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                        color: "var(--text-muted)",
                      }}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                    <h3 className="text-xl font-medium m-0">{week.title}</h3>
                  </div>
                  <div className="flex items-center gap-4">
                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className={`action-btn action-btn-note ${openWeekNotes.has(week.id) ? "active" : ""}`}
                        onClick={() =>
                          toggleSetAndExpandWeek(setOpenWeekNotes, week.id)
                        }
                      >
                        Notes
                      </button>
                      <button
                        className={`action-btn action-btn-interview ${openWeekInterview.has(week.id) ? "active" : ""}`}
                        onClick={() =>
                          toggleSetAndExpandWeek(setOpenWeekInterview, week.id)
                        }
                      >
                        Interview Qs
                      </button>
                    </div>
                    <span className="badge">
                      {weekCompleted} / {weekTasks} done
                    </span>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="flex flex-col mb-4 animate-in">
                    {openWeekNotes.has(week.id) && (
                      <div className="p-4 rounded-lg bg-[var(--bg-note)] border border-[var(--border-note)] mb-3">
                        <input 
                          placeholder="Note Title (Optional)" 
                          className="textarea-input mb-3" 
                          style={{ minHeight: 'auto', padding: '0.6rem 0.75rem', fontWeight: 600 }}
                          value={dashboardNoteInputs[week.id]?.title || ""}
                          onChange={e => setDashboardNoteInputs(p => ({...p, [week.id]: {...p[week.id], title: e.target.value}}))}
                        />
                        <textarea
                          placeholder="Write your note here... (Markdown supported! Try # Heading or **bold**)"
                          className="textarea-input textarea-note"
                          style={{ minHeight: '120px' }}
                          value={dashboardNoteInputs[week.id]?.content || ""}
                          onChange={e => setDashboardNoteInputs(p => ({...p, [week.id]: {...p[week.id], content: e.target.value}}))}
                        />
                        <div className="flex mt-3">
                          <button 
                            className="action-btn action-btn-note active font-semibold" 
                            style={{ padding: '0.5rem 1rem' }}
                            onClick={() => {
                               const note = dashboardNoteInputs[week.id];
                               if (!note?.content?.trim()) return;
                               const noteText = note.title?.trim() ? `**${note.title.trim()}**\n${note.content.trim()}` : note.content.trim();
                               const currentText = notesData.weeks[week.id] || '';
                               const separator = currentText.trim() ? '\n\n---\n\n' : '';
                               updateNote("weeks", week.id, currentText + separator + noteText);
                               setDashboardNoteInputs(p => ({...p, [week.id]: {title: "", content: ""}}));
                            }}>
                            Save Note
                          </button>
                          <Link href="/notes" className="action-btn ml-3" style={{ padding: '0.5rem 1rem' }}>Manage Saved Notes →</Link>
                        </div>
                        {notesData.weeks[week.id] && (
                          <div className="mt-3 text-sm text-[var(--color-note)]">
                            <span className="font-semibold">✓</span> You have saved notes for this week.
                          </div>
                        )}
                      </div>
                    )}
                    {openWeekInterview.has(week.id) && (
                      <div className="p-4 rounded-lg bg-[var(--bg-interview)] border border-[var(--border-interview)] mb-3">
                        <input 
                          placeholder="Question" 
                          className="textarea-input mb-3" 
                          style={{ minHeight: 'auto', padding: '0.6rem 0.75rem', fontWeight: 600 }}
                          value={dashboardQaInputs[week.id]?.q || ""}
                          onChange={e => setDashboardQaInputs(p => ({...p, [week.id]: {...p[week.id], q: e.target.value}}))}
                        />
                        <textarea
                          placeholder="Answer... (Markdown supported! Try # Heading or **bold**)"
                          className="textarea-input textarea-interview"
                          style={{ minHeight: '120px' }}
                          value={dashboardQaInputs[week.id]?.a || ""}
                          onChange={e => setDashboardQaInputs(p => ({...p, [week.id]: {...p[week.id], a: e.target.value}}))}
                        />
                        <div className="flex mt-3">
                          <button 
                            className="action-btn action-btn-interview active font-semibold" 
                            style={{ padding: '0.5rem 1rem' }}
                            onClick={() => {
                               const qa = dashboardQaInputs[week.id];
                               if (!qa?.q?.trim() || !qa?.a?.trim()) return;
                               const qaText = `**Q: ${qa.q.trim()}**\n${qa.a.trim()}`;
                               const currentText = notesData.interview[week.id] || '';
                               const separator = currentText.trim() ? '\n\n' : '';
                               updateNote("interview", week.id, currentText + separator + qaText);
                               setDashboardQaInputs(p => ({...p, [week.id]: {q: "", a: ""}}));
                            }}>
                            Save Q&A
                          </button>
                          <Link href="/interview" className="action-btn ml-3" style={{ padding: '0.5rem 1rem' }}>Manage Q&A →</Link>
                        </div>
                        {notesData.interview[week.id] && (
                          <div className="mt-3 text-sm text-[var(--color-interview)]">
                            <span className="font-semibold">✓</span> You have saved questions for this week.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!isCollapsed && (
                  <div
                    className="flex flex-col gap-3 animate-in"
                    style={{ animationDelay: "0.05s" }}
                  >
                    {week.tasks.map((task) => {
                      const isDone = !!completedTasks[task.id];
                      return (
                        <div
                          key={task.id}
                          className={`checkbox-wrapper ${isDone ? "completed" : ""}`}
                          style={{ flexWrap: "wrap" }}
                        >
                          <input
                            type="checkbox"
                            className="checkbox-input"
                            checked={isDone}
                            onChange={() => toggleTask(task.id)}
                            style={{ cursor: "pointer" }}
                          />
                          <div
                            className="flex flex-col gap-1.5 pt-0.5"
                            style={{ flex: 1, minWidth: "0" }}
                          >
                            <span className={isDone ? "text-muted" : ""}>
                              {task.description}
                            </span>
                            <div className="flex items-center justify-between w-full mt-1">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span
                                  className={`badge ${task.type === "practice" ? "badge-practice" : task.type === "project" ? "badge-project" : ""}`}
                                >
                                  {task.type}
                                </span>
                                {isDone && (
                                  <span className="text-sm text-muted">
                                    Completed {completedTasks[task.id]}
                                  </span>
                                )}
                              </div>
                              <button
                                className={`action-btn action-btn-note ${openTaskNotes.has(task.id) ? "active" : ""}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  toggleSet(setOpenTaskNotes, task.id);
                                }}
                              >
                                Note
                              </button>
                            </div>
                            {openTaskNotes.has(task.id) && (
                            <div className="p-4 rounded-lg bg-[var(--bg-note)] border border-[var(--border-note)] mt-3">
                              <textarea
                                placeholder="Write your note for this topic here... (Markdown supported!)"
                                className="textarea-input textarea-note mb-3"
                                style={{ minHeight: '100px', marginTop: 0 }}
                                value={dashboardTaskInputs[task.id] || ""}
                                onChange={e => setDashboardTaskInputs(p => ({...p, [task.id]: e.target.value}))}
                              />
                              <div className="flex">
                                <button 
                                  className="action-btn action-btn-note active font-semibold" 
                                  style={{ padding: '0.4rem 0.8rem' }}
                                  onClick={() => {
                                     const content = dashboardTaskInputs[task.id];
                                     if (!content?.trim()) return;
                                     updateNote("tasks", task.id, content.trim());
                                     setDashboardTaskInputs(p => ({...p, [task.id]: ""}));
                                  }}>
                                  Save Note
                                </button>
                                <Link href="/notes" className="action-btn ml-3" style={{ padding: '0.4rem 0.8rem' }}>Manage →</Link>
                              </div>
                              {notesData.tasks[task.id] && (
                                <div className="mt-3 text-sm text-[var(--color-note)]">
                                  <span className="font-semibold">✓</span> You have a saved note for this topic.
                                </div>
                              )}
                            </div>
                          )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

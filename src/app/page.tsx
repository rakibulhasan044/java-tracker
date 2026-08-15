"use client";

import { useState, useEffect } from "react";
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
  const [completedTasks, setCompletedTasks] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);
  const [activePhase, setActivePhase] = useState<string>(roadmapData.phases[0].id);
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());

  const [notesData, setNotesData] = useState<{
    tasks: Record<string, string>;
    weeks: Record<string, string>;
    interview: Record<string, string>;
  }>({ tasks: {}, weeks: {}, interview: {} });
  
  const [openTaskNotes, setOpenTaskNotes] = useState<Set<string>>(new Set());
  const [openWeekNotes, setOpenWeekNotes] = useState<Set<string>>(new Set());
  const [openWeekInterview, setOpenWeekInterview] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem("java-roadmap-progress");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Migration from old array format
          const migrated: Record<string, string> = {};
          parsed.forEach((id: string) => {
            migrated[id] = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          });
          setCompletedTasks(migrated);
        } else {
          setCompletedTasks(parsed);
        }
      } catch (e) {
        console.error("Failed to parse progress", e);
      }
    }
    const savedNotes = localStorage.getItem("java-roadmap-notes");
    if (savedNotes) {
      try {
        setNotesData(JSON.parse(savedNotes));
      } catch (e) {
        console.error("Failed to parse notes", e);
      }
    }
    setMounted(true);
  }, []);

  const toggleTask = (taskId: string) => {
    setCompletedTasks((prev) => {
      const next = { ...prev };
      if (next[taskId]) {
        delete next[taskId];
      } else {
        next[taskId] = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      }
      localStorage.setItem("java-roadmap-progress", JSON.stringify(next));
      return next;
    });
  };

  const toggleWeek = (weekId: string) => {
    setCollapsedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekId)) next.delete(weekId);
      else next.add(weekId);
      return next;
    });
  };

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateNote = (type: 'tasks' | 'weeks' | 'interview', id: string, value: string) => {
    setNotesData(prev => {
      const next = { ...prev, [type]: { ...prev[type], [id]: value } };
      localStorage.setItem("java-roadmap-notes", JSON.stringify(next));
      return next;
    });
  };

  if (!mounted) return null;

  const totalTasks = roadmapData.phases.reduce((acc, phase) => 
    acc + phase.weeks.reduce((accW, week) => accW + week.tasks.length, 0)
  , 0);
  
  const completedCount = Object.keys(completedTasks).length;
  const overallProgress = Math.round((completedCount / totalTasks) * 100) || 0;

  const currentPhaseData = roadmapData.phases.find(p => p.id === activePhase)!;

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl mb-2">Java Backend Developer Roadmap</h1>
        <p className="text-muted text-lg mb-6">9-month paced curriculum tracker</p>
        
        <div className="card">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-medium">Overall Progress</h2>
            <span className="font-semibold">{overallProgress}%</span>
          </div>
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${overallProgress}%` }}></div>
          </div>
          <p className="text-sm text-muted mt-2">
            {completedCount} of {totalTasks} tasks completed
          </p>
        </div>
      </header>

      <div className="phases-scroll mb-8">
        {roadmapData.phases.map((phase) => {
          const phaseTasks = phase.weeks.reduce((acc, w) => acc + w.tasks.length, 0);
          const phaseCompleted = phase.weeks.reduce((acc, w) => 
            acc + w.tasks.filter(t => !!completedTasks[t.id]).length
          , 0);
          const phaseProgress = Math.round((phaseCompleted / phaseTasks) * 100) || 0;
          
          const isActive = activePhase === phase.id;
          
          return (
            <div 
              key={phase.id} 
              className={`card flex flex-col gap-2`}
              style={{ 
                minWidth: '260px', 
                cursor: 'pointer',
                borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                borderWidth: isActive ? '2px' : '1px',
                padding: '1.25rem'
              }}
              onClick={() => setActivePhase(phase.id)}
            >
              <h3 className="font-medium text-lg">{phase.title}</h3>
              <p className="text-sm text-muted">{phase.duration}</p>
              <div className="progress-container mt-2">
                <div className="progress-bar" style={{ width: `${phaseProgress}%` }}></div>
              </div>
            </div>
          );
        })}
      </div>

      <section>
        <h2 className="text-2xl mb-6">{currentPhaseData.title} Timeline</h2>
        <div className="flex flex-col gap-6">
          {currentPhaseData.weeks.map((week) => {
            const weekTasks = week.tasks.length;
            const weekCompleted = week.tasks.filter(t => !!completedTasks[t.id]).length;
            const isCollapsed = collapsedWeeks.has(week.id);
            const isProjectWeek = week.title.toLowerCase().includes('project');
            
            return (
              <div key={week.id} className={`card ${isProjectWeek ? 'project-week' : ''}`}>
                <div 
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => toggleWeek(week.id)}
                  style={{ marginBottom: isCollapsed ? '0' : '1.5rem' }}
                >
                  <div className="flex items-center gap-3">
                    <svg 
                      width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-muted)' }}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                    <h3 className="text-xl font-medium m-0">{week.title}</h3>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button 
                        className={`action-btn action-btn-note ${openWeekNotes.has(week.id) ? 'active' : ''}`}
                        onClick={() => toggleSet(setOpenWeekNotes, week.id)}
                      >
                        Notes
                      </button>
                      <button 
                        className={`action-btn action-btn-interview ${openWeekInterview.has(week.id) ? 'active' : ''}`}
                        onClick={() => toggleSet(setOpenWeekInterview, week.id)}
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
                  <div className="flex flex-col mb-4">
                    {openWeekNotes.has(week.id) && (
                      <textarea 
                        className="textarea-input textarea-note mb-3" 
                        placeholder="Add general notes for this week..."
                        value={notesData.weeks[week.id] || ''}
                        onChange={(e) => updateNote('weeks', week.id, e.target.value)}
                      />
                    )}
                    {openWeekInterview.has(week.id) && (
                      <textarea 
                        className="textarea-input textarea-interview mb-3" 
                        placeholder="Add interview questions or prep notes for this week..."
                        value={notesData.interview[week.id] || ''}
                        onChange={(e) => updateNote('interview', week.id, e.target.value)}
                      />
                    )}
                  </div>
                )}

                {!isCollapsed && (
                  <div className="flex flex-col gap-3">
                    {week.tasks.map((task) => {
                      const isDone = !!completedTasks[task.id];
                      return (
                        <label key={task.id} className={`checkbox-wrapper ${isDone ? 'completed' : ''}`} style={{ flexWrap: 'wrap' }}>
                          <input 
                            type="checkbox" 
                            className="checkbox-input"
                            checked={isDone}
                            onChange={() => toggleTask(task.id)}
                          />
                        <div className="flex flex-col gap-1.5 pt-0.5" style={{ flex: 1, minWidth: '0' }}>
                          <span className={isDone ? 'text-muted' : ''}>
                            {task.description}
                          </span>
                          <div className="flex items-center justify-between w-full mt-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className={`badge ${task.type === 'practice' ? 'badge-practice' : task.type === 'project' ? 'badge-project' : ''}`}>
                                {task.type}
                              </span>
                              {isDone && (
                                <span className="text-sm text-muted">
                                  Completed {completedTasks[task.id]}
                                </span>
                              )}
                            </div>
                            <button 
                              className={`action-btn action-btn-note ${openTaskNotes.has(task.id) ? 'active' : ''}`}
                              onClick={(e) => { e.preventDefault(); toggleSet(setOpenTaskNotes, task.id); }}
                            >
                              Note
                            </button>
                          </div>
                          {openTaskNotes.has(task.id) && (
                            <textarea 
                              className="textarea-input textarea-note"
                              placeholder="Add a note for this topic..."
                              value={notesData.tasks[task.id] || ''}
                              onClick={(e) => e.preventDefault()}
                              onChange={(e) => updateNote('tasks', task.id, e.target.value)}
                            />
                          )}
                        </div>
                      </label>
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

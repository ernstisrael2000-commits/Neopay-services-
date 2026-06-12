import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, Play, CheckCircle2, Lock, Clock, Loader2,
  BookOpen, X, ChevronDown, ChevronUp,
  FileText, Download, Trophy,
  Video, List, StickyNote, ClipboardList, Award
} from 'lucide-react';
import { Formation, FormationModule, FormationChapter } from '../types';
import { Client } from '../types';
import { toast } from 'sonner';
import { openCertificate } from '../lib/certificateGenerator';

interface CoursePlayerProps {
  formation: Formation;
  loggedClient: Client;
  onBack: () => void;
}

type VideoInfo =
  | { type: 'youtube'; videoId: string }
  | { type: 'vimeo'; videoId: string }
  | { type: 'direct'; url: string }
  | null;

type PlayerTab = 'overview' | 'resources' | 'notes';

function parseVideoUrl(url: string): VideoInfo {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', videoId: ytMatch[1] };
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { type: 'vimeo', videoId: vimeoMatch[1] };
  if (url.startsWith('http')) return { type: 'direct', url };
  return null;
}

function getSortedModules(formation: Formation): FormationModule[] {
  return [...(formation.modules || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function getNoteKey(formationId: string, moduleId: string) {
  return `rena_notes_${formationId}_${moduleId}`;
}

export default function CoursePlayer({ formation, loggedClient, onBack }: CoursePlayerProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [currentModuleId, setCurrentModuleId] = useState<string | null>(null);
  const [lastPositionSeconds, setLastPositionSeconds] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [marking, setMarking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [navigating, setNavigating] = useState(false);
  const [activeTab, setActiveTab] = useState<PlayerTab>('overview');
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  // ── Quiz system ────────────────────────────────────────────────────────────
  const [quizResults, setQuizResults] = useState<Record<string, { passed: boolean; score: number; attempts: number }>>({});
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizChapter, setQuizChapter] = useState<FormationChapter | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizShuffledMap, setQuizShuffledMap] = useState<number[]>([]); // shuffled position → original index
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean; correct: number; total: number; passPercent: number } | null>(null);
  const [certificate, setCertificate] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const positionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const modules = getSortedModules(formation);
  const currentModule = modules.find(m => m.id === currentModuleId) ?? null;
  const videoInfo = currentModule?.videoUrl ? parseVideoUrl(currentModule.videoUrl) : null;
  const currentIdx = modules.findIndex(m => m.id === currentModuleId);

  const videoModules = modules.filter(m => !!m.videoUrl);
  const totalVideoModules = videoModules.length;
  const completedVideoCount = videoModules.filter(m => m.id && completedIds.includes(m.id)).length;
  const progressPct = totalVideoModules > 0 ? Math.round((completedVideoCount / totalVideoModules) * 100) : 0;

  const isLocked = useCallback((mod: FormationModule, idx: number): boolean => {
    if (idx === 0) return false;
    const prev = modules[idx - 1];
    if (!completedIds.includes(prev?.id ?? '')) return true;
    // If crossing chapter boundary, check if the previous chapter has an unpassed quiz
    if (prev?.chapterId && mod?.chapterId && prev.chapterId !== mod.chapterId) {
      const prevChapter = (formation.chapters || []).find(c => c.id === prev.chapterId);
      if (prevChapter?.quiz?.questions?.length) {
        return !quizResults[prev.chapterId]?.passed;
      }
    }
    return false;
  }, [modules, completedIds, quizResults, formation.chapters]);

  const isCompleted = (mod: FormationModule) => completedIds.includes(mod.id ?? '');

  // ── Load progress ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loggedClient?.id || !formation.id) return;
    fetch(`/api/formations/progress/${loggedClient.id}/${formation.id}`)
      .then(r => r.json())
      .then(data => {
        const prog = data.progress;
        if (prog) {
          setCompletedIds(prog.completedModuleIds ?? []);
          const startId = prog.currentModuleId ?? modules[0]?.id;
          if (startId) setCurrentModuleId(startId);
          setLastPositionSeconds(prog.lastPositionSeconds ?? 0);
        } else {
          if (modules[0]) setCurrentModuleId(modules[0].id ?? null);
        }
        const chapterMap: Record<string, boolean> = {};
        formation.chapters?.forEach(c => { chapterMap[c.id] = true; });
        if (!formation.chapters?.length) chapterMap['__default'] = true;
        setExpandedChapters(chapterMap);
      })
      .catch(() => { if (modules[0]) setCurrentModuleId(modules[0].id ?? null); })
      .finally(() => setLoadingProgress(false));
  }, [loggedClient.id, formation.id]);

  // ── Load quiz results ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!loggedClient?.id || !formation.id) return;
    fetch(`/api/formations/quiz/results/${loggedClient.id}/${formation.id}`)
      .then(r => r.json())
      .then(data => {
        const map: Record<string, { passed: boolean; score: number; attempts: number }> = {};
        (data.results || []).forEach((r: any) => {
          map[r.chapterId] = { passed: r.passed, score: r.score, attempts: r.attempts || 1 };
        });
        setQuizResults(map);
      })
      .catch(() => {});
  }, [loggedClient.id, formation.id]);

  // ── Load certificate ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!loggedClient?.id || !formation.id) return;
    fetch(`/api/formations/certificate/${loggedClient.id}/${formation.id}`)
      .then(r => r.json())
      .then(data => { if (data.certificate) setCertificate(data.certificate); })
      .catch(() => {});
  }, [loggedClient.id, formation.id]);

  // ── Load note for current module ───────────────────────────────────────────
  useEffect(() => {
    if (!formation.id || !currentModuleId) return;
    const saved = localStorage.getItem(getNoteKey(formation.id, currentModuleId)) || '';
    setNote(saved);
    setNoteSaved(false);
  }, [currentModuleId, formation.id]);

  const saveNote = () => {
    if (!formation.id || !currentModuleId) return;
    localStorage.setItem(getNoteKey(formation.id, currentModuleId), note);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  };

  // ── Save watch position ────────────────────────────────────────────────────
  const savePosition = useCallback((seconds: number) => {
    if (!loggedClient?.id || !formation.id || !currentModuleId) return;
    if (positionTimerRef.current) clearTimeout(positionTimerRef.current);
    positionTimerRef.current = setTimeout(() => {
      fetch('/api/formations/progress/position', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: loggedClient.id, formationId: formation.id, moduleId: currentModuleId, positionSeconds: Math.floor(seconds) }),
      }).catch(() => {});
    }, 4000);
  }, [loggedClient.id, formation.id, currentModuleId]);

  // ── Quiz helpers ───────────────────────────────────────────────────────────
  const openQuiz = useCallback((chapter: FormationChapter) => {
    const qs = chapter.quiz?.questions || [];
    // Fisher-Yates shuffle — give each student a different question order
    const indices = [...Array(qs.length).keys()];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setQuizChapter(chapter);
    setQuizShuffledMap(indices);
    setQuizAnswers(new Array(qs.length).fill(-1));
    setQuizResult(null);
    setShowQuiz(true);
  }, []);

  const submitQuiz = async () => {
    if (!quizChapter || !loggedClient?.id || !formation.id) return;
    setQuizSubmitting(true);
    try {
      // Remap answers from shuffled order back to original question order
      const originalQuestions = quizChapter.quiz?.questions || [];
      const remappedAnswers = new Array(originalQuestions.length).fill(-1);
      quizShuffledMap.forEach((originalIdx, shuffledPos) => {
        remappedAnswers[originalIdx] = quizAnswers[shuffledPos];
      });
      const res = await fetch('/api/formations/quiz/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: loggedClient.id, formationId: formation.id, chapterId: quizChapter.id, answers: remappedAnswers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setQuizResult(data);
      setQuizResults(prev => ({
        ...prev,
        [quizChapter.id]: { passed: data.passed || prev[quizChapter.id]?.passed, score: data.score, attempts: (prev[quizChapter.id]?.attempts || 0) + 1 },
      }));
    } catch (e: any) { toast.error(e.message || 'Erreur de soumission.'); }
    finally { setQuizSubmitting(false); }
  };

  // ── Mark lesson complete ───────────────────────────────────────────────────
  const markComplete = useCallback(async (moduleId?: string, autoAdvance = true) => {
    const targetId = moduleId ?? currentModuleId;
    if (!targetId || completedIds.includes(targetId) || !loggedClient?.id || !formation.id) return;
    setMarking(true);
    setJustCompleted(false);
    try {
      await fetch('/api/formations/progress/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: loggedClient.id, formationId: formation.id, moduleId: targetId }),
      });
      const newCompleted = [...completedIds, targetId];
      setCompletedIds(newCompleted);
      setJustCompleted(true);

      // Check if this module is the last in its chapter and chapter has quiz
      const completedMod = modules.find(m => m.id === targetId);
      if (completedMod?.chapterId) {
        const chapterModules = modules.filter(m => m.chapterId === completedMod.chapterId);
        const isLastInChapter = chapterModules[chapterModules.length - 1]?.id === targetId;
        const chapter = (formation.chapters || []).find(c => c.id === completedMod.chapterId);
        if (isLastInChapter && chapter?.quiz?.questions?.length && !quizResults[chapter.id]?.passed) {
          setTimeout(() => { openQuiz(chapter); setJustCompleted(false); }, 1000);
          return;
        }
      }

      if (autoAdvance) {
        const idx = modules.findIndex(m => m.id === targetId);
        if (idx < modules.length - 1) {
          setTimeout(() => { setCurrentModuleId(modules[idx + 1].id ?? null); setJustCompleted(false); }, 1600);
        }
      }
    } catch { toast.error('Erreur lors de la mise à jour de la progression.'); }
    finally { setMarking(false); }
  }, [currentModuleId, completedIds, loggedClient.id, formation.id, modules, quizResults, openQuiz]);

  // ── YouTube end detection ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      try {
        const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (data?.event === 'onStateChange' && data?.info === 0) markComplete();
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [markComplete]);

  // ── Resume direct video position ───────────────────────────────────────────
  useEffect(() => {
    if (videoInfo?.type === 'direct' && videoRef.current && lastPositionSeconds > 5) {
      videoRef.current.currentTime = lastPositionSeconds;
    }
  }, [currentModuleId]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const scrollTop = () => {
    mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToModule = (mod: FormationModule, idx: number) => {
    if (isLocked(mod, idx)) { toast.error('🔒 Terminez la leçon précédente pour débloquer celle-ci.'); return; }
    setCurrentModuleId(mod.id ?? null);
    setJustCompleted(false);
    setMobileSidebarOpen(false);
    setActiveTab('overview');
    scrollTop();
  };

  const goNext = async () => {
    if (currentIdx === -1 || currentIdx >= modules.length - 1) return;
    const next = modules[currentIdx + 1];
    const nextIdx = currentIdx + 1;
    if (isCompleted(currentModule!)) {
      if (!isLocked(next, nextIdx)) { setCurrentModuleId(next.id ?? null); scrollTop(); }
      else {
        // If locked because the current chapter has an unplayed quiz, open it
        const cur = currentModule!;
        if (cur.chapterId && next.chapterId && cur.chapterId !== next.chapterId) {
          const chapter = (formation.chapters || []).find(c => c.id === cur.chapterId);
          if (chapter?.quiz?.questions?.length && !quizResults[chapter.id]?.passed) {
            openQuiz(chapter);
            return;
          }
        }
        toast.error('🔒 La leçon suivante est verrouillée.');
      }
      return;
    }
    if (!currentModule?.videoUrl) {
      // Check ahead of time if completing this will trigger a quiz (to avoid advancing)
      const willTriggerQuiz = (() => {
        if (!currentModule?.chapterId) return false;
        const chapterModules = modules.filter(m => m.chapterId === currentModule!.chapterId);
        const isLast = chapterModules[chapterModules.length - 1]?.id === currentModuleId;
        if (!isLast) return false;
        const chapter = (formation.chapters || []).find(c => c.id === currentModule!.chapterId);
        return !!(chapter?.quiz?.questions?.length && !quizResults[chapter.id]?.passed);
      })();
      setNavigating(true);
      try {
        await markComplete(currentModuleId ?? undefined, false);
        if (!willTriggerQuiz) { setCurrentModuleId(next.id ?? null); scrollTop(); }
      }
      finally { setNavigating(false); }
      return;
    }
    toast.error('🔒 Terminez cette leçon avant de passer à la suivante.');
  };

  const goPrev = () => {
    if (currentIdx <= 0) return;
    setCurrentModuleId(modules[currentIdx - 1].id ?? null);
    setJustCompleted(false);
    scrollTop();
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  // ── Module list item (light theme) ────────────────────────────────────────
  const ModuleItem = ({ mod, idx }: { mod: FormationModule; idx: number }) => {
    const locked = isLocked(mod, idx);
    const completed = isCompleted(mod);
    const current = currentModuleId === mod.id;
    const hasVideo = !!mod.videoUrl;

    return (
      <button
        onClick={() => goToModule(mod, idx)}
        disabled={locked}
        className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all border-l-2 ${
          current
            ? 'bg-violet-50 border-violet-500'
            : locked
            ? 'opacity-40 cursor-not-allowed border-transparent'
            : 'hover:bg-gray-50 border-transparent'
        }`}
      >
        {/* Status icon */}
        <div className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black transition-colors ${
          completed ? 'bg-emerald-500' : current ? 'bg-violet-600' : 'bg-gray-200'
        }`}>
          {completed
            ? <CheckCircle2 className="h-3.5 w-3.5 text-white" />
            : locked
            ? <Lock className="h-3 w-3 text-gray-400" />
            : current
            ? <Play className="h-3 w-3 text-white fill-white" />
            : <span className="text-gray-500">{idx + 1}</span>}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold leading-snug line-clamp-2 ${
            current ? 'text-violet-700' : completed ? 'text-gray-500' : locked ? 'text-gray-400' : 'text-gray-700'
          }`}>
            {mod.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {mod.duration && (
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />{mod.duration}
              </span>
            )}
            {!hasVideo && mod.pdfUrl && (
              <span className="text-[10px] text-violet-500 flex items-center gap-1">
                <FileText className="h-2.5 w-2.5" />PDF
              </span>
            )}
          </div>
        </div>

        {current && !completed && (
          <div className="mt-1 h-2 w-2 rounded-full bg-violet-500 shrink-0 animate-pulse" />
        )}
      </button>
    );
  };

  // ── Sidebar module list ────────────────────────────────────────────────────
  const renderModuleList = () => {
    if (!formation.chapters?.length) {
      return modules.map((mod, idx) => <ModuleItem key={mod.id} mod={mod} idx={idx} />);
    }
    const groupedByChapter: Record<string, FormationModule[]> = {};
    const noChapter: FormationModule[] = [];
    modules.forEach(mod => {
      if (mod.chapterId) { groupedByChapter[mod.chapterId] = [...(groupedByChapter[mod.chapterId] || []), mod]; }
      else { noChapter.push(mod); }
    });
    return (
      <>
        {formation.chapters.map((chapter, ci) => (
          <div key={chapter.id}>
            <button
              onClick={() => toggleChapter(chapter.id)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="text-[10px] font-black text-violet-500 uppercase tracking-widest">
                {String(ci + 1).padStart(2, '0')}
              </span>
              <span className="text-xs font-black text-gray-800 flex-1 line-clamp-1">{chapter.title}</span>
              {expandedChapters[chapter.id]
                ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
            </button>
            {expandedChapters[chapter.id] && (groupedByChapter[chapter.id] || []).map(mod => {
              const globalIdx = modules.findIndex(m => m.id === mod.id);
              return <ModuleItem key={mod.id} mod={mod} idx={globalIdx} />;
            })}
          </div>
        ))}
        {noChapter.map(mod => {
          const globalIdx = modules.findIndex(m => m.id === mod.id);
          return <ModuleItem key={mod.id} mod={mod} idx={globalIdx} />;
        })}
      </>
    );
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loadingProgress) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mx-auto mb-4 w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
            <div className="absolute inset-0 rounded-full border-4 border-t-violet-600 animate-spin" />
          </div>
          <p className="text-gray-500 font-medium text-sm">Chargement du cours...</p>
        </div>
      </div>
    );
  }

  const canGoPrev = currentIdx > 0;
  const canGoNext = currentIdx < modules.length - 1;
  const currentCompleted = currentModule ? isCompleted(currentModule) : false;

  const TABS: { id: PlayerTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',   label: 'Aperçu',      icon: <BookOpen   className="h-3.5 w-3.5" /> },
    { id: 'resources',  label: 'Ressources',   icon: <FileText   className="h-3.5 w-3.5" /> },
    { id: 'notes',      label: 'Mes notes',    icon: <StickyNote className="h-3.5 w-3.5" /> },
  ];

  // ── Sidebar panel (shared between desktop + mobile) ────────────────────────
  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="p-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-900 font-black text-sm">Contenu du cours</span>
          <span className="text-[11px] text-violet-600 font-bold">{progressPct}%</span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <motion.div
            className="h-full bg-violet-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          {completedVideoCount}/{totalVideoModules} leçons terminées
        </p>
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">{renderModuleList()}</div>
      {/* Certificate banner */}
      {formation.hasCertificate && progressPct === 100 && (
        <div className="p-3 border-t border-gray-100 bg-emerald-50 shrink-0">
          <div className="flex items-center gap-2 text-emerald-600">
            <Trophy className="h-4 w-4" />
            <span className="text-xs font-bold">Cours terminé — Certificat disponible !</span>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0 z-20 shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm font-semibold shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="hidden sm:inline">Retour</span>
        </button>
        <div className="h-4 w-px bg-gray-200 shrink-0" />
        <p className="text-gray-900 font-bold text-sm flex-1 truncate">{formation.title}</p>

        {/* Desktop progress */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <div className="w-28 bg-gray-200 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-violet-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-xs font-bold text-gray-500 shrink-0">{progressPct}% complété</span>
        </div>

        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setMobileSidebarOpen(v => !v)}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
        >
          <List className="h-4 w-4" />
        </button>

        {/* Desktop sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="hidden md:flex p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
        >
          <List className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile progress stripe */}
      <div className="md:hidden h-1 bg-gray-100 shrink-0">
        <motion.div
          className="h-full bg-violet-600"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 relative">

        {/* ── Desktop sidebar ───────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.div
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="hidden md:flex flex-col bg-white border-r border-gray-200 shrink-0 overflow-hidden"
              style={{ minWidth: 0 }}
            >
              <SidebarContent />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Mobile sidebar overlay ────────────────────────────────────────── */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/30 z-40 md:hidden"
                onClick={() => setMobileSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.25 }}
                className="fixed right-0 top-14 bottom-0 w-80 max-w-[85vw] bg-white z-50 md:hidden flex flex-col shadow-2xl border-l border-gray-200"
              >
                {/* Close button row */}
                <div className="flex items-center justify-between px-4 pt-3 pb-0 shrink-0">
                  <span className="text-xs text-gray-400 font-semibold">LEÇONS</span>
                  <button
                    onClick={() => setMobileSidebarOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <SidebarContent />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <div ref={mainContentRef} className="flex-1 overflow-y-auto min-h-0 flex flex-col bg-gray-50">

          {!currentModule ? (
            <div className="flex items-center justify-center flex-1 text-gray-400">
              <div className="text-center px-4">
                <Video className="h-14 w-14 mx-auto mb-4 text-gray-300" />
                <p className="font-semibold text-sm text-gray-500">Sélectionnez une leçon pour commencer</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Video area — stays black (player standard) ─────────────── */}
              <div className="bg-black w-full shrink-0 shadow-md">
                {!currentModule.videoUrl ? (
                  <div className="aspect-video flex flex-col items-center justify-center text-gray-400 bg-gray-100">
                    <FileText className="h-12 w-12 mb-3 text-gray-300" />
                    <p className="text-sm font-semibold text-gray-500">Leçon sans vidéo</p>
                    <p className="text-xs mt-1 text-gray-400">Consultez le contenu et les ressources ci-dessous</p>
                  </div>
                ) : videoInfo?.type === 'youtube' ? (
                  <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                    <iframe
                      key={currentModule.id}
                      src={`https://www.youtube.com/embed/${videoInfo.videoId}?enablejsapi=1&rel=0&modestbranding=1&origin=${window.location.origin}`}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={currentModule.title}
                    />
                  </div>
                ) : videoInfo?.type === 'vimeo' ? (
                  <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                    <iframe
                      key={currentModule.id}
                      src={`https://player.vimeo.com/video/${videoInfo.videoId}?api=1&color=7C3AED`}
                      className="absolute inset-0 w-full h-full"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                      title={currentModule.title}
                    />
                  </div>
                ) : videoInfo?.type === 'direct' ? (
                  <video
                    key={currentModule.id}
                    ref={videoRef}
                    controls
                    playsInline
                    className="w-full aspect-video"
                    style={{ background: '#000' }}
                    onEnded={() => markComplete()}
                    onTimeUpdate={e => savePosition((e.target as HTMLVideoElement).currentTime)}
                  >
                    <source src={videoInfo.url} />
                  </video>
                ) : (
                  <div className="aspect-video flex items-center justify-center bg-gray-900 text-gray-400">
                    <p className="text-sm">URL vidéo non reconnue</p>
                  </div>
                )}
              </div>

              {/* ── Lesson info ────────────────────────────────────────────── */}
              <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6">

                {/* Title row */}
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        Leçon {currentIdx + 1} / {modules.length}
                      </span>
                      {currentCompleted && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Terminée
                        </span>
                      )}
                      {justCompleted && (
                        <motion.span
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="flex items-center gap-1 text-[11px] font-bold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full"
                        >
                          ✨ Bravo !
                        </motion.span>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">
                      {currentModule.title}
                    </h2>
                    {currentModule.description && (
                      <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{currentModule.description}</p>
                    )}
                  </div>

                  {!currentCompleted && (
                    <button
                      onClick={() => markComplete()}
                      disabled={marking}
                      className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm shadow-violet-200"
                    >
                      {marking
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">Marquer terminée</span>
                    </button>
                  )}
                </div>

                {/* Navigation buttons */}
                <div className="flex items-center gap-2 mb-6">
                  <button
                    onClick={goPrev}
                    disabled={!canGoPrev}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-300 text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Précédente
                  </button>
                  <button
                    onClick={goNext}
                    disabled={!canGoNext || navigating}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-violet-200"
                  >
                    {navigating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Suivante <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                  </button>
                </div>

                {/* ── Tabs ───────────────────────────────────────────────── */}
                <div className="border-b border-gray-200 mb-6">
                  <div className="flex gap-0 overflow-x-auto no-scrollbar">
                    {TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
                          activeTab === tab.id
                            ? 'text-violet-700 border-violet-600 bg-violet-50/50'
                            : 'text-gray-400 border-transparent hover:text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {tab.icon} {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Tab content ────────────────────────────────────────── */}
                <AnimatePresence mode="wait">
                  {activeTab === 'overview' && (
                    <motion.div key="overview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                        {currentModule.description ? (
                          <p className="text-gray-600 text-sm leading-relaxed">{currentModule.description}</p>
                        ) : (
                          <p className="text-gray-400 text-sm">Aucune description pour cette leçon.</p>
                        )}
                        {currentModule.duration && (
                          <div className="flex items-center gap-2 mt-4 text-xs text-gray-400 pt-4 border-t border-gray-50">
                            <Clock className="h-3.5 w-3.5" /> Durée estimée : {currentModule.duration}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'resources' && (
                    <motion.div key="resources" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      {currentModule.pdfUrl ? (
                        <a
                          href={currentModule.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-4 p-4 bg-white hover:bg-violet-50 rounded-2xl border border-gray-100 hover:border-violet-200 transition-all group shadow-sm"
                        >
                          <div className="h-12 w-12 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                            <FileText className="h-6 w-6 text-violet-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900">Support de cours PDF</p>
                            <p className="text-xs text-gray-400 mt-0.5">Cliquez pour télécharger</p>
                          </div>
                          <Download className="h-5 w-5 text-gray-300 group-hover:text-violet-600 transition-colors shrink-0" />
                        </a>
                      ) : (
                        <div className="text-center py-14 bg-white rounded-2xl border border-gray-100 shadow-sm">
                          <FileText className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                          <p className="text-sm text-gray-400">Aucune ressource pour cette leçon.</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'notes' && (
                    <motion.div key="notes" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs text-gray-400 font-semibold">Notes pour cette leçon</p>
                          <button
                            onClick={saveNote}
                            className={`text-xs font-bold px-4 py-1.5 rounded-lg transition-all ${
                              noteSaved
                                ? 'bg-emerald-100 text-emerald-600 border border-emerald-200'
                                : 'bg-violet-100 text-violet-700 hover:bg-violet-200 border border-violet-200'
                            }`}
                          >
                            {noteSaved ? '✓ Sauvegardé' : 'Sauvegarder'}
                          </button>
                        </div>
                        <textarea
                          value={note}
                          onChange={e => setNote(e.target.value)}
                          placeholder="Commencez à écrire vos notes ici... Elles sont sauvegardées localement."
                          className="w-full h-48 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 transition-all resize-none"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Certificate banner ─────────────────────────────────────── */}
              {formation.hasCertificate && progressPct === 100 && (
                <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pb-8">
                  {certificate ? (
                    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
                      <div className="h-12 w-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                        <Award className="h-6 w-6 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-amber-800 font-black text-sm">🎓 Certificat obtenu !</p>
                        <p className="text-amber-600 text-xs mt-0.5">
                          Émis le {certificate.issuedAt?.seconds ? new Date(certificate.issuedAt.seconds * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                          {certificate.issuedBy && ` par ${certificate.issuedBy}`}
                        </p>
                        <code className="text-[11px] font-mono text-amber-700 bg-amber-100 px-2 py-0.5 rounded mt-1 inline-block">{certificate.certificateCode}</code>
                      </div>
                      <button
                        onClick={() => openCertificate({
                          userName: certificate.userName || loggedClient.name || 'Étudiant',
                          formationTitle: certificate.formationTitle || formation.title,
                          certificateCode: certificate.certificateCode,
                          issuedBy: certificate.issuedBy,
                          issuedAt: certificate.issuedAt,
                          pdfUrl: certificate.pdfUrl,
                        })}
                        className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-amber-200"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Télécharger</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
                      <div className="h-12 w-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                        <Trophy className="h-6 w-6 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-amber-800 font-black text-sm">🎉 Félicitations ! Cours terminé</p>
                        <p className="text-amber-600 text-xs mt-0.5">Votre certificat sera émis par l'équipe Rena.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Quiz Modal ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showQuiz && quizChapter && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    <span className="text-xs font-black uppercase tracking-widest opacity-70">Quiz d'évaluation</span>
                  </div>
                  {!quizResult && (
                    <button onClick={() => setShowQuiz(false)} className="rounded-full bg-white/10 hover:bg-white/20 p-1.5 transition-all">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <h2 className="text-xl font-black mt-2">{quizChapter.title}</h2>
                <p className="text-white/70 text-xs mt-1">
                  {quizChapter.quiz?.questions?.length} question{(quizChapter.quiz?.questions?.length ?? 0) > 1 ? 's' : ''} · Seuil de réussite : {quizChapter.quiz?.passPercent ?? 80}%
                </p>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {quizResult ? (
                  /* Results screen */
                  <div className="text-center py-4">
                    <div className={`h-20 w-20 mx-auto rounded-full flex items-center justify-center mb-4 ${quizResult.passed ? 'bg-emerald-100' : 'bg-red-100'}`}>
                      {quizResult.passed
                        ? <Award className="h-10 w-10 text-emerald-500" />
                        : <BookOpen className="h-10 w-10 text-red-400" />}
                    </div>

                    {quizResult.passed ? (
                      <>
                        <h3 className="text-2xl font-black text-emerald-600">🎉 Félicitations !</h3>
                        <p className="text-base font-bold text-emerald-700 mt-1">Vous avez passé le cours</p>
                        <p className="text-4xl font-black text-gray-900 mt-3">{quizResult.score}%</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {quizResult.correct} / {quizResult.total} bonnes réponses · Seuil : {quizResult.passPercent}%
                        </p>
                        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left">
                          <p className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 shrink-0" /> Chapitre suivant débloqué
                          </p>
                          <p className="text-xs text-emerald-600 mt-1">Vous pouvez continuer votre progression.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <h3 className="text-2xl font-black text-red-500">Quiz non réussi</h3>
                        <p className="text-4xl font-black text-gray-900 mt-3">{quizResult.score}%</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {quizResult.correct} / {quizResult.total} bonnes réponses · Seuil requis : {quizResult.passPercent}%
                        </p>
                        <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4 text-left">
                          <p className="text-sm font-bold text-red-700 flex items-center gap-2">
                            <BookOpen className="h-4 w-4 shrink-0" /> Vous devez relire toute la formation pour continuer
                          </p>
                          <p className="text-xs text-red-600 mt-1">Révisez le contenu du chapitre et réessayez.</p>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  /* Questions — displayed in shuffled order */
                  quizShuffledMap.map((origIdx, qi) => {
                    const q = quizChapter.quiz!.questions[origIdx];
                    return (
                      <div key={q.id + qi} className="space-y-2">
                        <p className="text-sm font-bold text-gray-900">
                          <span className="text-violet-500 mr-1">Q{qi + 1}.</span> {q.question}
                        </p>
                        <div className="space-y-2">
                          {(q.options || []).map((opt, oi) => (
                            <button
                              key={oi}
                              onClick={() => {
                                const next = [...quizAnswers];
                                next[qi] = oi;
                                setQuizAnswers(next);
                              }}
                              className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                                quizAnswers[qi] === oi
                                  ? 'border-violet-500 bg-violet-50 text-violet-800'
                                  : 'border-gray-100 bg-gray-50 hover:border-violet-200 hover:bg-violet-50/50 text-gray-700'
                              }`}
                            >
                              <span className="inline-block w-6 h-6 rounded-full border-2 border-current mr-2 text-center text-xs leading-5 font-black shrink-0">
                                {String.fromCharCode(65 + oi)}
                              </span>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-gray-100 shrink-0">
                {quizResult ? (
                  <div className="flex gap-3">
                    {!quizResult.passed && (
                      <button
                        onClick={() => {
                          // Re-shuffle on retry so questions appear in a different order
                          if (quizChapter) openQuiz(quizChapter);
                        }}
                        className="flex-1 py-3 rounded-2xl border-2 border-violet-200 text-violet-700 font-bold text-sm hover:bg-violet-50 transition-all"
                      >
                        Réessayer
                      </button>
                    )}
                    <button
                      onClick={() => setShowQuiz(false)}
                      className="flex-1 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition-all"
                    >
                      {quizResult.passed ? 'Continuer le cours' : 'Fermer'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={submitQuiz}
                    disabled={quizSubmitting || quizAnswers.some(a => a === -1)}
                    className="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    {quizSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                    Valider les réponses
                  </button>
                )}
                {!quizResult && (
                  <p className="text-center text-xs text-gray-400 mt-2">
                    {quizAnswers.filter(a => a !== -1).length} / {quizChapter.quiz?.questions?.length ?? 0} réponses
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Play, Loader2, BarChart3, Zap, Brain, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, XCircle, Clock, Database, Activity } from 'lucide-react';
import Link from 'next/link';
import { VectorStore } from '@/services/vectorStore';
import { EvaluationService, generateQueriesFromStore, createAutoDataset } from '@/services/evaluationService';
import { generateTrainingPairs, downloadTrainingData } from '@/services/trainingData';
import type { EvalRunResult, EvalRunConfig, PerQueryRetrievalResult, PerQueryGenerationResult } from '@/types/evaluation';
import { DEFAULT_PIPELINE_MODE, type PipelineMode } from '@/lib/constants';
import { clsx } from 'clsx';

/* ───── Small reusable components ───── */

function MetricCard({ label, value, suffix, icon: Icon, subtitle }: {
  label: string; value: number | string; suffix?: string; color?: string; icon: any; subtitle?: string;
}) {
  const display = typeof value === 'number'
    ? (value < 0 ? 'N/A' : value >= 1 && value < 100 ? value.toFixed(1) : (value * 100).toFixed(1))
    : value;
  const showSuffix = typeof value === 'number' && value >= 0 ? (suffix || '%') : '';

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-crisp-xs transition-all hover:shadow-crisp-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {display}<span className="text-lg text-slate-500 font-normal">{showSuffix}</span>
          </p>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-slate-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ value, label, max = 1 }: { value: number; label?: string; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = pct >= 70 ? 'bg-emerald-600' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-3">
      {label && <span className="w-20 text-xs text-slate-600 truncate font-medium">{label}</span>}
      <div className="flex-1 h-2 rounded-full bg-slate-100 border border-slate-200/60 overflow-hidden">
        <div className={clsx("h-full rounded-full transition-all duration-700", barColor)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-14 text-right text-xs font-mono text-slate-700 font-semibold">{(value * 100).toFixed(1)}%</span>
    </div>
  );
}

function ExpandableSection({ title, icon: Icon, children, defaultOpen = false }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-crisp-xs overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-cyan-600" />
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-200 p-5 bg-white text-slate-700">{children}</div>}
    </div>
  );
}

import { EvalStore } from '@/services/evalStore';

/* ───── Main Evaluate Page ───── */

export default function EvaluatePage() {
  const [result, setResult] = useState<EvalRunResult | null>(null);
  const [history, setHistory] = useState<EvalRunResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [docCount, setDocCount] = useState(0);
  const [k, setK] = useState(5);
  const [runGeneration, setRunGeneration] = useState(false);
  const [pipelineMode, setPipelineMode] = useState<PipelineMode>(DEFAULT_PIPELINE_MODE);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      const store = EvalStore.getInstance();
      const runs = await store.getRuns();
      setHistory(runs);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const store = VectorStore.getInstance();
        await store.init();
        setDocCount(store.getUniqueFilenames().length);
      } catch { setDocCount(0); }
      await loadHistory();
    })();
  }, []);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setCurrentStep('Initializing...');

    try {
      const store = VectorStore.getInstance();
      await store.init();

      const dataset = createAutoDataset();
      dataset.queries = generateQueriesFromStore(store);

      if (dataset.queries.length === 0) {
        throw new Error('No documents in knowledge base. Upload PDFs first.');
      }

      const config: EvalRunConfig = { k, runGeneration, datasetId: dataset.id, pipelineMode };
      const evalService = new EvaluationService();

      const evalResult = await evalService.runFullEvaluation(dataset, config, (partial) => {
        if (partial.progress !== undefined) setProgress(partial.progress);
        if (partial.currentStep) setCurrentStep(partial.currentStep);
      });

      setResult(evalResult);
      
      // Save to indexeddb
      if (evalResult.status === 'completed') {
        const evalStore = EvalStore.getInstance();
        await evalStore.saveRun(evalResult);
        await loadHistory();
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setIsRunning(false);
    }
  }, [k, runGeneration, pipelineMode]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs shadow-crisp-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-serif font-bold tracking-tight text-slate-900">
                The Archive{' '}
                <span className="text-slate-500 text-xs font-sans font-normal">· Empirical Benchmark Suite</span>
              </h1>
              <p className="text-xs text-slate-500 font-mono">RAG Pipeline Quality & Groundedness Metrics</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <Database className="h-3.5 w-3.5 text-blue-600" />
            <span>{docCount} manuscript{docCount !== 1 ? 's' : ''} indexed</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Config Panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-crisp-xs">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            <div className="flex-1 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 font-serif">
                <Activity className="h-4 w-4 text-blue-600" /> Benchmark Configuration
              </h2>
              <div className="flex flex-wrap gap-6">
                {history.length > 0 && (
                  <div>
                    <label className="block text-xs text-slate-600 mb-1.5 font-medium">View Past Run</label>
                    <select 
                      onChange={e => {
                        if (e.target.value === 'new') {
                          setResult(null);
                        } else {
                          const run = history.find(h => h.id === e.target.value);
                          if (run) setResult(run);
                        }
                      }} 
                      value={result?.id || 'new'}
                      disabled={isRunning}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-blue-900 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50 shadow-crisp-xs font-mono"
                    >
                      <option value="new">-- Current / New Run --</option>
                      {history.map(h => (
                        <option key={h.id} value={h.id}>
                          {new Date(h.timestamp).toLocaleString()} ({h.config.pipelineMode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-slate-600 mb-1.5 font-medium">Top-K Retrieval</label>
                  <select value={k} onChange={e => setK(Number(e.target.value))} disabled={isRunning}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50 shadow-crisp-xs font-mono">
                    {[3, 5, 10, 15, 20].map(v => <option key={v} value={v}>k = {v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1.5 font-medium">Pipeline Mode</label>
                  <select value={pipelineMode} onChange={e => setPipelineMode(e.target.value as PipelineMode)} disabled={isRunning}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50 shadow-crisp-xs font-mono">
                    <option value="baseline">Baseline (BM25 + Dense)</option>
                    <option value="enhanced">Enhanced (+ Cross-Encoder)</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" checked={runGeneration} onChange={e => setRunGeneration(e.target.checked)}
                      disabled={isRunning} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20" />
                    <span className="text-sm text-slate-700">Include Generation Metrics</span>
                    <span className="text-[10px] text-slate-500 font-mono">(in-browser LLM)</span>
                  </label>
                </div>
              </div>
            </div>
            <button onClick={handleRun} disabled={isRunning || docCount === 0}
              className={clsx(
                "flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all shadow-crisp-xs",
                isRunning ? "bg-slate-200 text-slate-400 cursor-wait shadow-none" :
                docCount === 0 ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none" :
                "bg-blue-600 text-white hover:bg-blue-700 shadow-crisp-xs hover:shadow-crisp-sm active:scale-95"
              )}>
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {isRunning ? 'Running...' : 'Run Benchmark'}
            </button>
          </div>

          {/* Progress bar */}
          {isRunning && (
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-xs text-slate-500 font-mono">
                <span>{currentStep}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-crisp-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" /> {error}
            </div>
          )}
        </div>

        {/* Empty State */}
        {!result && !isRunning && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <BarChart3 className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg font-serif font-medium text-slate-700">No evaluation results yet</p>
            <p className="text-sm mt-1 text-slate-500">{docCount > 0 ? 'Click "Run Benchmark" to evaluate retrieval & generation quality' : 'Index academic manuscripts in the archive first'}</p>
          </div>
        )}

        {/* Results */}
        {result && result.status === 'completed' && (
          <>
            {/* ── Retrieval Metrics ── */}
            {result.retrieval && (
              <section className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-serif font-bold tracking-wide text-slate-900 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-600" /> Retrieval Relevance Metrics
                  </h2>
                  <button
                    onClick={() => {
                      const allPairs = result.retrieval!.perQueryResults.flatMap(q => {
                        const mappedDocs = q.retrievedDocs.map(d => ({
                          content: d.snippet,
                          source: d.source,
                          score: d.score,
                          isRelevant: d.isRelevant
                        }));
                        return generateTrainingPairs(q.query, mappedDocs);
                      });
                      downloadTrainingData(allPairs, `archive-training-data-${Date.now()}.jsonl`);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 shadow-crisp-xs transition-colors font-mono"
                  >
                    <Database className="w-3.5 h-3.5 text-blue-600" /> Export Training Data (JSONL)
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard label="MRR" value={result.retrieval.mrr} icon={BarChart3} color="" subtitle="Mean Reciprocal Rank" />
                  <MetricCard label={`Precision@${result.retrieval.k}`} value={result.retrieval.precisionAtK} icon={CheckCircle2} color="" subtitle="Relevant in top-k / k" />
                  <MetricCard label={`Recall@${result.retrieval.k}`} value={result.retrieval.recallAtK} icon={Database} color="" subtitle="Coverage of relevant docs" />
                  <MetricCard label="NDCG" value={result.retrieval.ndcg} icon={Activity} color="" subtitle="Normalized DCG" />
                </div>

                <ExpandableSection title="Per-Query Retrieval Breakdown" icon={BarChart3}>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {result.retrieval.perQueryResults.map((q: PerQueryRetrievalResult, i: number) => (
                      <div key={q.queryId} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3 shadow-crisp-xs">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] text-slate-500 font-mono font-medium">Q{i + 1}</span>
                            <p className="text-sm text-slate-900 font-medium truncate max-w-lg">{q.query}</p>
                          </div>
                          <span className="text-xs text-slate-500 font-mono">{q.latencyMs.toFixed(0)}ms</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <ScoreBar value={q.reciprocalRank} label="RR" />
                          <ScoreBar value={q.precisionAtK} label={`P@${result.retrieval!.k}`} />
                          <ScoreBar value={q.recallAtK} label={`R@${result.retrieval!.k}`} />
                          <ScoreBar value={q.ndcg} label="NDCG" />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {q.retrievedDocs.map((d, j) => (
                            <span
                              key={j}
                              className={clsx(
                                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium font-mono",
                                d.isRelevant
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : "bg-white text-slate-600 border border-slate-200"
                              )}
                            >
                              {d.isRelevant ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" /> : <XCircle className="h-2.5 w-2.5 text-slate-400" />}
                              #{d.rank} {d.source} ({(d.score * 100).toFixed(0)}%)
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ExpandableSection>
              </section>
            )}

            {/* ── Generation Metrics ── */}
            {result.generation && (
              <section className="space-y-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-emerald-600" /> Generation Quality Metrics
                  <span className="text-[10px] text-slate-500 font-normal normal-case font-mono">(RAGAS-Framework)</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <MetricCard label="Groundedness" value={result.generation.averageGroundedness} icon={Brain} color="" subtitle="Faithfulness to context" />
                  <MetricCard label="Correctness" value={result.generation.averageCorrectness} icon={CheckCircle2} color="" subtitle="Factual accuracy" />
                  <MetricCard label="Completeness" value={result.generation.averageCompleteness} icon={Database} color="" subtitle="Source coverage" />
                </div>

                <ExpandableSection title="Per-Query Generation Breakdown" icon={Brain}>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {result.generation.perQueryResults.map((q: PerQueryGenerationResult, i: number) => (
                      <div key={q.queryId} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3 shadow-crisp-xs">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] text-slate-500 font-mono font-medium">Q{i + 1}</span>
                            <p className="text-sm text-slate-900 font-medium truncate max-w-lg">{q.query}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-slate-500 font-mono">{q.latencyMs.toFixed(0)}ms</span>
                            <p className="text-[10px] text-slate-500 font-mono">{q.tokensGenerated} tokens</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <ScoreBar value={q.groundedness} label="Ground." />
                          <ScoreBar value={q.correctness >= 0 ? q.correctness : 0} label="Correct." />
                          <ScoreBar value={q.completeness} label="Complete." />
                        </div>
                        <details className="group">
                          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 transition-colors">
                            View generated answer
                          </summary>
                          <div className="mt-2 rounded-lg bg-white p-3 text-xs text-slate-700 leading-relaxed max-h-40 overflow-y-auto border border-slate-200 shadow-crisp-xs">
                            {q.generatedAnswer}
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                </ExpandableSection>
              </section>
            )}

            {/* ── Efficiency Metrics ── */}
            {result.efficiency && (
              <section className="space-y-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-amber-800 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-600" /> System Efficiency Metrics
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard label="Avg Retrieval" value={result.efficiency.avgRetrievalLatencyMs.toFixed(1)} suffix="ms" icon={Clock} color="" subtitle="Embedding + cosine search" />
                  <MetricCard label="P95 Retrieval" value={result.efficiency.p95RetrievalLatencyMs.toFixed(1)} suffix="ms" icon={Activity} color="" subtitle="95th percentile" />
                  {result.efficiency.avgGenerationLatencyMs > 0 && (
                    <MetricCard label="Avg TTFT" value={result.efficiency.avgTimeToFirstTokenMs.toFixed(0)} suffix="ms" icon={Zap} color="" subtitle="Time to First Token" />
                  )}
                  {result.efficiency.peakMemoryUsageMb !== null && (
                    <MetricCard label="Heap Usage" value={result.efficiency.peakMemoryUsageMb.toFixed(1)} suffix="MB" icon={Database} color="" subtitle="JS heap size" />
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-crisp-xs">
                  <p className="text-xs text-slate-500 mb-3 font-medium">Latency Distribution</p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-600">Total queries</span><span className="text-slate-900 font-mono font-semibold">{result.efficiency.totalQueriesRun}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Avg total latency</span><span className="text-slate-900 font-mono font-semibold">{result.efficiency.avgTotalLatencyMs.toFixed(0)}ms</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Avg retrieval</span><span className="text-slate-900 font-mono font-semibold">{result.efficiency.avgRetrievalLatencyMs.toFixed(1)}ms</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">P95 retrieval</span><span className="text-slate-900 font-mono font-semibold">{result.efficiency.p95RetrievalLatencyMs.toFixed(1)}ms</span></div>
                    {result.efficiency.avgGenerationLatencyMs > 0 && <>
                      <div className="flex justify-between"><span className="text-slate-600">Avg generation</span><span className="text-slate-900 font-mono font-semibold">{result.efficiency.avgGenerationLatencyMs.toFixed(0)}ms</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">P95 generation</span><span className="text-slate-900 font-mono font-semibold">{result.efficiency.p95GenerationLatencyMs.toFixed(0)}ms</span></div>
                    </>}
                  </div>
                </div>
              </section>
            )}

            {/* Formulas Reference */}
            <ExpandableSection title="Metric Formulas Reference" icon={BarChart3}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600 leading-relaxed">
                <div className="space-y-3">
                  <h4 className="text-slate-900 font-semibold text-sm">Retrieval Metrics</h4>
                  <div><strong className="text-blue-800">MRR</strong> = (1/U) × Σ(1/rank<sub>i</sub>), where rank<sub>i</sub> is the position of the first relevant result for query i.</div>
                  <div><strong className="text-blue-800">Precision@k</strong> = (relevant in top-k) / k</div>
                  <div><strong className="text-blue-800">Recall@k</strong> = (relevant in top-k) / (total relevant for query)</div>
                  <div><strong className="text-blue-800">NDCG</strong> = DCG / IDCG, using graded relevance with logarithmic discount.</div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-slate-900 font-semibold text-sm">Generation Metrics</h4>
                  <div><strong className="text-emerald-800">Groundedness</strong>: Fraction of answer sentences whose content words overlap ≥40% with retrieved context.</div>
                  <div><strong className="text-emerald-800">Correctness</strong>: Overlap ratio of expected answer fragments found in the generated response.</div>
                  <div><strong className="text-emerald-800">Completeness</strong>: Fraction of ground-truth relevant documents cited in the answer.</div>
                </div>
              </div>
            </ExpandableSection>

            {/* Timestamp */}
            <p className="text-center text-[10px] text-slate-500 pb-4 font-mono">
              Evaluation completed at {new Date(result.timestamp).toLocaleString()} · Run ID: {result.id.slice(0, 8)}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

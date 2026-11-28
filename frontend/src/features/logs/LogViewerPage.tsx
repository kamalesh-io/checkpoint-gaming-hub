import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  Check,
  Clock,
  Copy,
  Download,
  Pause,
  Play,
  RefreshCw,
  Terminal,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/SearchInput';
import { useDebounce } from '@/hooks/useDebounce';
import { systemApi, type LogEntry } from '@/services/systemApi';
import { useToastStore } from '@/stores/toastStore';
import { cn } from '@/utils/cn';

type LogLevel = 'ALL' | 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';

export function LogViewerPage() {
  const addToast = useToastStore((s) => s.addToast);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<LogLevel>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const logContainerRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchQuery, 250);

  const fetchLogs = async () => {
    try {
      const res = await systemApi.getLogs({
        level: selectedLevel === 'ALL' ? undefined : selectedLevel,
        search: debouncedSearch.trim() || undefined,
        limit: 1000,
      });
      setLogs(res.logs ?? []);
      setLastUpdated(new Date());
    } catch {
      // Backend might be offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
  }, [selectedLevel, debouncedSearch]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void fetchLogs();
    }, 2500);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedLevel, debouncedSearch]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleCopyLogs = async () => {
    if (logs.length === 0) return;
    const text = logs
      .map((l) => `${l.timestamp} [${l.level}] ${l.logger} (${l.location}): ${l.message}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast({
        type: 'success',
        title: 'Logs Copied',
        description: `Copied ${logs.length} log lines to clipboard.`,
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Copy Failed',
        description: 'Unable to write logs to clipboard.',
      });
    }
  };

  const handleClearLogs = async () => {
    try {
      await systemApi.clearLogs();
      setLogs([]);
      addToast({
        type: 'info',
        title: 'Logs Cleared',
        description: 'In-memory log buffer was emptied.',
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Failed to Clear',
        description: 'Unable to clear backend log buffer.',
      });
    }
  };

  const handleDownloadLogs = () => {
    if (logs.length === 0) return;
    const text = logs
      .map((l) => `${l.timestamp} [${l.level}] ${l.logger} (${l.location}): ${l.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checkpoint_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const levelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return 'text-danger bg-danger/15 border-danger/30';
      case 'WARNING':
      case 'WARN':
        return 'text-warning bg-warning/15 border-warning/30';
      case 'DEBUG':
        return 'text-accent-violet bg-accent-violet/15 border-accent-violet/30';
      case 'INFO':
      default:
        return 'text-accent-blue bg-accent-blue/15 border-accent-blue/30';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] space-y-4 px-6 sm:px-10 lg:px-14 pb-6">
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-outline/75 bg-secondary-background/90 backdrop-blur-md p-5 shadow-card shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-active/15 border border-accent-active/30 text-accent-active">
            <Terminal className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-headline text-headline-md text-on-background">System Logs</h1>
              <Badge tone="accent" size="sm" className="tabular-nums font-mono">
                {logs.length} lines
              </Badge>
            </div>
            <p className="text-body-sm text-muted flex items-center gap-2 mt-0.5">
              <span>CHECKPOINT sidecar service runtime output</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="h-3.5 w-3.5" />
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            data-nav-item="true"
            onClick={() => setAutoRefresh(!autoRefresh)}
            leftIcon={autoRefresh ? <Pause className="h-3.5 w-3.5 text-success" /> : <Play className="h-3.5 w-3.5" />}
            className={autoRefresh ? 'text-success hover:text-success' : ''}
          >
            {autoRefresh ? 'Live Polling' : 'Paused'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            data-nav-item="true"
            onClick={() => void fetchLogs()}
            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            data-nav-item="true"
            onClick={handleCopyLogs}
            leftIcon={copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          >
            {copied ? 'Copied' : 'Copy Logs'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            data-nav-item="true"
            onClick={handleDownloadLogs}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            Export
          </Button>

          <Button
            variant="danger"
            size="sm"
            data-nav-item="true"
            onClick={handleClearLogs}
            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Level Filters */}
        <div className="flex items-center gap-1.5 bg-surface-elevated/70 p-1 rounded-xl border border-outline/60">
          {(['ALL', 'INFO', 'WARNING', 'ERROR', 'DEBUG'] as LogLevel[]).map((level) => {
            const active = selectedLevel === level;
            return (
              <button
                key={level}
                type="button"
                data-nav-item="true"
                onClick={() => setSelectedLevel(level)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all',
                  active
                    ? 'bg-accent-active text-black shadow-sm font-bold'
                    : 'text-muted hover:text-on-background hover:bg-surface/50'
                )}
              >
                {level}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <SearchInput
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder="Filter logs (e.g. steam, igdb, error, process)..."
            className="h-9 bg-secondary-background/90"
          />
          <button
            type="button"
            data-nav-item="true"
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              'px-2.5 py-1.5 rounded-lg border text-caption font-semibold flex items-center gap-1.5 transition-colors shrink-0',
              autoScroll
                ? 'bg-accent-active/20 border-accent-active text-accent-active'
                : 'bg-surface/40 border-outline/60 text-muted hover:text-on-background'
            )}
            title="Auto-scroll to latest log entries"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            <span>Scroll Lock</span>
          </button>
        </div>
      </div>

      {/* Terminal Display Console */}
      <div
        ref={logContainerRef}
        tabIndex={0}
        data-nav-item="true"
        aria-label="System log console stream"
        className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-outline/75 bg-[#0A0D12] p-4 font-mono text-xs text-on-surface shadow-2xl focus:outline-none focus:ring-1 focus:ring-accent-active select-text"
      >
        {loading && logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted gap-2.5">
            <RefreshCw className="h-5 w-5 animate-spin text-accent-active" />
            <span>Connecting to live local log stream...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              compact
              icon={<Terminal className="h-6 w-6" />}
              title="No Log Records Found"
              description={
                searchQuery
                  ? `No logs matched the search filter "${searchQuery}".`
                  : 'The backend service has not emitted any log messages under the selected level yet.'
              }
            />
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, idx) => (
              <div
                key={`${log.timestamp}-${idx}`}
                className="group flex items-start gap-3 py-1 px-1.5 rounded hover:bg-white/[0.04] transition-colors leading-relaxed"
              >
                {/* Timestamp */}
                <span className="text-muted/75 shrink-0 tabular-nums select-none">
                  {log.timestamp}
                </span>

                {/* Level Pill */}
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 border select-none',
                    levelColor(log.level)
                  )}
                >
                  {log.level}
                </span>

                {/* Logger / Location */}
                <span className="text-accent-active/85 shrink-0 hidden md:inline max-w-[160px] truncate">
                  [{log.logger}]
                </span>

                {/* Log message */}
                <span className="flex-1 text-on-surface/90 break-words whitespace-pre-wrap">
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export default LogViewerPage;

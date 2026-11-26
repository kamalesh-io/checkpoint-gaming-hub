import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  Gamepad2,
  Info,
  Layers,
  Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useGamingStatsQuery } from '@/hooks/queries';
import { buildGameDetailsRoute } from '@/routes/routes';
import { formatHoursLogged } from '@/utils/format';

type DatePreset = 'all' | 'year' | '90d' | '30d';

export function StatisticsPage() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<DatePreset>('all');

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (preset === '30d') {
      const past = new Date();
      past.setDate(now.getDate() - 30);
      return { startDate: past.toISOString().slice(0, 10), endDate: now.toISOString().slice(0, 10) };
    }
    if (preset === '90d') {
      const past = new Date();
      past.setDate(now.getDate() - 90);
      return { startDate: past.toISOString().slice(0, 10), endDate: now.toISOString().slice(0, 10) };
    }
    if (preset === 'year') {
      const past = new Date(now.getFullYear(), 0, 1);
      return { startDate: past.toISOString().slice(0, 10), endDate: now.toISOString().slice(0, 10) };
    }
    return { startDate: undefined, endDate: undefined };
  }, [preset]);

  const { data: stats, isLoading, isError, refetch } = useGamingStatsQuery(startDate, endDate);

  const maxGenreHours = useMemo(() => {
    if (!stats?.hours_by_genre || stats.hours_by_genre.length === 0) return 1;
    return Math.max(...stats.hours_by_genre.map((g) => g.hours_played), 1);
  }, [stats]);

  const maxMonthHours = useMemo(() => {
    if (!stats?.monthly_activity || stats.monthly_activity.length === 0) return 1;
    return Math.max(...stats.monthly_activity.map((m) => m.hours_played), 1);
  }, [stats]);

  const fullYearHeatmap = useMemo(() => {
    const map = new Map<string, { minutes: number; session_count: number }>();
    if (stats?.heatmap) {
      stats.heatmap.forEach((h) => map.set(h.date, { minutes: h.minutes, session_count: h.session_count }));
    }
    const days: { date: string; minutes: number; session_count: number }[] = [];
    const today = new Date();
    for (let i = 364; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const match = map.get(ds) ?? { minutes: 0, session_count: 0 };
      days.push({ date: ds, minutes: match.minutes, session_count: match.session_count });
    }
    return days;
  }, [stats]);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-surface-darker/60" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="p-6">
        <ErrorState
          title="Failed to Load Statistics"
          message="Could not calculate gaming analytics from local SQLite database."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const completionPct = Math.round(stats.backlog_completion_pct ?? 0);

  return (
    <div className="space-y-8 p-6 pb-24">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-headline text-headline-xl font-bold tracking-tight text-on-background">
              Gaming Statistics & Analytics
            </h1>
            <Badge tone="accent" size="sm">
              Honest Metrics (SQLite)
            </Badge>
          </div>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Zero fabricated telemetry. Playtime, status velocity, and genre analytics derived purely
            from your library.
          </p>
        </div>

        {/* Date Filter Presets */}
        <div className="flex rounded-xl border border-outline/70 bg-surface-darker/70 p-1">
          <button
            data-nav-item="true"
            onClick={() => setPreset('all')}
            className={`rounded-lg px-3 py-1.5 text-label-md font-semibold transition-colors ${
              preset === 'all'
                ? 'bg-accent-primary text-surface-darker font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-background'
            }`}
          >
            All Time
          </button>
          <button
            data-nav-item="true"
            onClick={() => setPreset('year')}
            className={`rounded-lg px-3 py-1.5 text-label-md font-semibold transition-colors ${
              preset === 'year'
                ? 'bg-accent-primary text-surface-darker font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-background'
            }`}
          >
            This Year
          </button>
          <button
            data-nav-item="true"
            onClick={() => setPreset('90d')}
            className={`rounded-lg px-3 py-1.5 text-label-md font-semibold transition-colors ${
              preset === '90d'
                ? 'bg-accent-primary text-surface-darker font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-background'
            }`}
          >
            90 Days
          </button>
          <button
            data-nav-item="true"
            onClick={() => setPreset('30d')}
            className={`rounded-lg px-3 py-1.5 text-label-md font-semibold transition-colors ${
              preset === '30d'
                ? 'bg-accent-primary text-surface-darker font-bold shadow-sm'
                : 'text-on-surface-variant hover:text-on-background'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-outline/70 bg-secondary-background/85 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Gamepad2 className="h-4 w-4 text-accent-primary" />
            <span className="text-label-sm font-semibold uppercase">Total Games</span>
          </div>
          <p className="mt-2 font-headline text-headline-lg font-bold text-on-background tabular-nums">
            {stats.total_games}
          </p>
        </div>

        <div className="rounded-2xl border border-outline/70 bg-secondary-background/85 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Clock className="h-4 w-4 text-accent-primary" />
            <span className="text-label-sm font-semibold uppercase">Playtime</span>
          </div>
          <p className="mt-2 font-headline text-headline-lg font-bold text-accent-primary tabular-nums truncate">
            {stats.total_hours_logged > 0
              ? formatHoursLogged(stats.total_hours_logged)
              : '0.0 hrs'}
          </p>
        </div>

        <div className="rounded-2xl border border-outline/70 bg-secondary-background/85 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-label-sm font-semibold uppercase">Completed</span>
          </div>
          <p className="mt-2 font-headline text-headline-lg font-bold text-success tabular-nums">
            {stats.completed + stats.one_hundred_percent}
          </p>
        </div>

        <div className="rounded-2xl border border-outline/70 bg-secondary-background/85 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Flame className="h-4 w-4 text-warning" />
            <span className="text-label-sm font-semibold uppercase">Now Playing</span>
          </div>
          <p className="mt-2 font-headline text-headline-lg font-bold text-warning tabular-nums">
            {stats.currently_playing}
          </p>
        </div>

        <div className="rounded-2xl border border-outline/70 bg-secondary-background/85 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Layers className="h-4 w-4 text-on-surface-variant" />
            <span className="text-label-sm font-semibold uppercase">Backlog</span>
          </div>
          <p className="mt-2 font-headline text-headline-lg font-bold text-on-background tabular-nums">
            {stats.planned}
          </p>
        </div>

        <div className="rounded-2xl border border-outline/70 bg-secondary-background/85 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Trophy className="h-4 w-4 text-accent-gold" />
            <span className="text-label-sm font-semibold uppercase">Completion Rate</span>
          </div>
          <p className="mt-2 font-headline text-headline-lg font-bold text-accent-gold tabular-nums">
            {completionPct}%
          </p>
        </div>
      </div>

      {/* Split Section: Genre Playtime + Monthly Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Genre Hours Bar Chart */}
        <div className="rounded-2xl border border-outline/70 bg-secondary-background/85 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent-primary" />
              <h3 className="font-headline text-headline-sm font-bold text-on-background">
                Hours by Genre
              </h3>
            </div>
            <Badge tone="accent" size="sm">
              Honest Sums
            </Badge>
          </div>

          {/* Honest Calculation Disclaimer Banner */}
          <div className="flex items-start gap-2.5 rounded-xl border border-outline/60 bg-surface-dark/70 p-3 text-caption text-on-surface-variant">
            <Info className="h-4 w-4 shrink-0 text-accent-primary mt-0.5" />
            <span>
              Each genre bar represents hours in games tagged with that genre. Because games
              frequently carry multiple genre tags (e.g. RPG + Action), individual genre sums exceed
              total unique playtime.
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {(!stats.hours_by_genre || stats.hours_by_genre.length === 0) ? (
              <p className="text-body-sm text-muted">No genre playtime recorded yet.</p>
            ) : (
              stats.hours_by_genre.slice(0, 8).map((genre) => {
                const pct = Math.round((genre.hours_played / maxGenreHours) * 100);
                return (
                  <div key={genre.genre} className="space-y-1">
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="font-semibold text-on-background">{genre.genre}</span>
                      <span className="tabular-nums font-mono text-accent-primary">
                        {formatHoursLogged(genre.hours_played)} ({genre.game_count} games)
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-surface-dark overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-primary transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Monthly Activity Breakdown */}
        <div className="rounded-2xl border border-outline/70 bg-secondary-background/85 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent-primary" />
              <h3 className="font-headline text-headline-sm font-bold text-on-background">
                Monthly Playtime Activity
              </h3>
            </div>
            <Badge tone="neutral" size="sm">
              Logged Sessions
            </Badge>
          </div>

          <p className="text-body-sm text-on-surface-variant">
            Hours logged across recent calendar months based on actual play sessions.
          </p>

          <div className="space-y-3 pt-2">
            {(!stats.monthly_activity || stats.monthly_activity.length === 0) ? (
              <p className="text-body-sm text-muted">No monthly activity recorded yet.</p>
            ) : (
              stats.monthly_activity.slice(0, 8).map((m) => {
                const pct = Math.round((m.hours_played / maxMonthHours) * 100);
                return (
                  <div key={m.month} className="space-y-1">
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="font-semibold text-on-background">{m.month}</span>
                      <span className="tabular-nums font-mono text-accent-primary">
                        {formatHoursLogged(m.hours_played)} • {m.sessions_count} sessions
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-surface-dark overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-active transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Split: Most Played Games + Platform Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Played Games (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-outline/70 bg-secondary-background/85 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent-gold" />
              <h3 className="font-headline text-headline-sm font-bold text-on-background">
                Most Played Games
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            {(!stats.most_played_games || stats.most_played_games.length === 0) ? (
              <p className="text-body-sm text-muted">No logged gameplay yet.</p>
            ) : (
              stats.most_played_games.slice(0, 5).map((game, idx) => (
                <div
                  key={game.entry_id}
                  data-nav-item="true"
                  onClick={() => navigate(buildGameDetailsRoute(game.entry_id))}
                  className="flex items-center justify-between rounded-xl border border-outline/60 bg-surface-dark/80 p-3 hover:border-accent-primary/60 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-darker font-bold text-accent-gold tabular-nums">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="font-headline text-body-md font-bold text-on-background">
                        {game.title}
                      </h4>
                      <p className="text-caption text-on-surface-variant">
                        {game.playing_status}
                      </p>
                    </div>
                  </div>

                  <span className="font-mono text-body-md font-bold text-accent-primary tabular-nums">
                    {formatHoursLogged(game.hours_played)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Platform Breakdown */}
        <div className="rounded-2xl border border-outline/70 bg-secondary-background/85 p-6 shadow-sm space-y-4">
          <h3 className="font-headline text-headline-sm font-bold text-on-background">
            Platform Distribution
          </h3>

          <div className="space-y-3">
            {(!stats.platform_distribution || stats.platform_distribution.length === 0) ? (
              <p className="text-body-sm text-muted">No platform data available.</p>
            ) : (
              stats.platform_distribution.map((p) => (
                <div
                  key={p.platform}
                  className="flex items-center justify-between rounded-xl border border-outline/60 bg-surface-dark/70 p-3"
                >
                  <span className="font-headline text-body-sm font-semibold text-on-background">
                    {p.platform}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge tone="accent" size="sm">
                      {p.game_count} games
                    </Badge>
                    <span className="text-caption text-on-surface-variant tabular-nums">
                      {formatHoursLogged(p.hours_played)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 365-Day Activity Heatmap Grid */}
      <div className="rounded-2xl border border-outline/70 bg-secondary-background/85 p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-headline-sm font-bold text-on-background">
            365-Day Activity Heatmap
          </h3>
          <span className="text-caption text-on-surface-variant">
            Daily playtime intensity over the past year
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 p-2 bg-surface-dark/60 rounded-xl max-h-[140px] overflow-y-auto">
          {fullYearHeatmap.map((day) => {
            const hours = day.minutes / 60;
            const intensity =
              hours === 0
                ? 'bg-surface-elevated/40'
                : hours < 1
                ? 'bg-accent-primary/30'
                : hours < 3
                ? 'bg-accent-primary/60'
                : 'bg-accent-primary';

            return (
              <div
                key={day.date}
                title={`${day.date}: ${hours.toFixed(1)} hrs (${day.session_count} sessions)`}
                className={`h-3 w-3 rounded-sm ${intensity} transition-transform hover:scale-125`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

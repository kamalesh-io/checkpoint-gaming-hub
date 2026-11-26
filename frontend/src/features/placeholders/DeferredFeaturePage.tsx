import type { ElementType } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Compass, Home, Library } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ROUTES } from '@/routes/routes';

export interface DeferredFeaturePageProps {
  title: string;
  phaseLabel: string;
  description: string;
  plannedCapabilities: string[];
  icon: ElementType;
}

/**
 * Honest roadmap-aligned placeholder for features scheduled in Phases 3-6.
 * Never fabricates placeholder game rows, schedules, sessions, or charts.
 */
export function DeferredFeaturePage({
  title,
  phaseLabel,
  description,
  plannedCapabilities,
  icon: Icon,
}: DeferredFeaturePageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const inBigPicture = location.pathname.startsWith(ROUTES.BIG_PICTURE);
  const homeRoute = inBigPicture ? ROUTES.BIG_PICTURE : ROUTES.OVERVIEW;
  const libraryRoute = inBigPicture ? `${ROUTES.BIG_PICTURE}/library` : ROUTES.LIBRARY;
  const discoverRoute = inBigPicture ? `${ROUTES.BIG_PICTURE}/discover` : ROUTES.DISCOVER;

  return (
    <div className="mx-auto max-w-4xl py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge tone="accent" size="sm" className="mb-2">
            {phaseLabel}
          </Badge>
          <h1 className="font-headline text-headline-lg text-on-background">{title}</h1>
        </div>
      </div>

      <EmptyState
        icon={<Icon className="h-7 w-7" />}
        title={`${title} activates in ${phaseLabel}`}
        description={description}
        actions={
          <>
            <Button
              variant="accent"
              leftIcon={<Home className="h-4 w-4" />}
              onClick={() => navigate(homeRoute)}
            >
              Return to Overview
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Library className="h-4 w-4" />}
              onClick={() => navigate(libraryRoute)}
            >
              Browse My Library
            </Button>
            <Button
              variant="ghost"
              leftIcon={<Compass className="h-4 w-4" />}
              onClick={() => navigate(discoverRoute)}
            >
              Discover IGDB Games
            </Button>
          </>
        }
      />

      <div className="rounded-2xl border border-outline/75 bg-secondary-background/70 p-6">
        <h2 className="font-headline text-headline-sm text-on-background mb-3">
          Scoped Capabilities ({phaseLabel})
        </h2>
        <ul className="grid gap-2.5 sm:grid-cols-2 text-body-sm text-muted">
          {plannedCapabilities.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 rounded-lg bg-surface/55 border border-outline/60 px-3 py-2.5"
            >
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent-active shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

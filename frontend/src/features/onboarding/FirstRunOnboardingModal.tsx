import { useState } from 'react';
import {
  ArrowRight,
  Check,
  Database,
  Gamepad2,
  Link2,
  Shield,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useSteamConnectMutation } from '@/hooks/queries/usePhase6Queries';
import { useToastStore } from '@/stores/toastStore';

interface FirstRunOnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export function FirstRunOnboardingModal({ open, onClose }: FirstRunOnboardingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [steamId, setSteamId] = useState('');
  const [steamApiKey, setSteamApiKey] = useState('');
  const steamConnect = useSteamConnectMutation();
  const addToast = useToastStore((s) => s.addToast);

  const handleFinish = async () => {
    if (steamId.trim()) {
      try {
        await steamConnect.mutateAsync({
          steam_id_64: steamId.trim(),
          api_key: steamApiKey.trim() || null,
        });
        addToast({
          title: 'Steam Connected',
          description: 'Linked your Steam account to CHECKPOINT.',
          tone: 'success',
        });
      } catch {
        // Silently proceed, credentials can be updated later in Settings
      }
    }
    onClose();
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Welcome to CHECKPOINT Gaming Hub"
      subtitle="Personal, local-first video game library manager for Windows."
      size="md"
    >
      <div className="space-y-6 pt-3">
        {/* Progress Step Pills */}
        <div className="flex items-center justify-center gap-2">
          <div
            className={`h-2 rounded-full transition-all ${
              step === 1 ? 'w-8 bg-accent-primary' : 'w-2 bg-outline'
            }`}
          />
          <div
            className={`h-2 rounded-full transition-all ${
              step === 2 ? 'w-8 bg-accent-primary' : 'w-2 bg-outline'
            }`}
          />
          <div
            className={`h-2 rounded-full transition-all ${
              step === 3 ? 'w-8 bg-accent-primary' : 'w-2 bg-outline'
            }`}
          />
        </div>

        {step === 1 && (
          <div className="space-y-4 text-center py-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-primary/20 text-accent-primary">
              <Database className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-headline text-headline-md text-on-background">
                Local-First & Privacy Architecture
              </h3>
              <p className="text-body-sm text-muted max-w-sm mx-auto">
                CHECKPOINT stores all your games, playtime, journals, and backups directly on your PC in high-performance SQLite. No cloud account required.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-left">
              <div className="rounded-xl border border-outline/60 bg-surface-darker/60 p-3 space-y-1">
                <span className="text-xs font-semibold text-accent-primary flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  DPAPI Protection
                </span>
                <p className="text-xs text-muted">
                  API credentials encrypted using your Windows user account key.
                </p>
              </div>
              <div className="rounded-xl border border-outline/60 bg-surface-darker/60 p-3 space-y-1">
                <span className="text-xs font-semibold text-accent-primary flex items-center gap-1.5">
                  <Gamepad2 className="h-3.5 w-3.5" />
                  10-Foot Ready
                </span>
                <p className="text-xs text-muted">
                  Full Xbox, DualSense, and Big Picture Mode controller support.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <h3 className="font-headline text-headline-md text-on-background flex items-center gap-2">
                <Link2 className="h-5 w-5 text-accent-primary" />
                Optional Steam Integration
              </h3>
              <p className="text-body-sm text-muted">
                Connect your Steam account to import your library, sync playtime, and track achievements. You can also skip this and manage games manually.
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-outline/70 bg-surface-darker/70 p-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-on-background">
                  SteamID64 or Steam Profile URL (Optional)
                </label>
                <Input
                  value={steamId}
                  onChange={(e) => setSteamId(e.target.value)}
                  placeholder="e.g. 76561198000000000 or steamcommunity.com/id/user"
                  data-nav-item="true"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-on-background">
                  Steam Web API Key (Optional)
                </label>
                <Input
                  type="password"
                  value={steamApiKey}
                  onChange={(e) => setSteamApiKey(e.target.value)}
                  placeholder="32-character hexadecimal key"
                  data-nav-item="true"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-center py-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-gold/20 text-accent-gold">
              <Sparkles className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-headline text-headline-md text-on-background">
                You're All Set!
              </h3>
              <p className="text-body-sm text-muted max-w-sm mx-auto">
                Discover new titles, prioritize your backlog queue, schedule sessions, and enjoy a unified Windows gaming experience.
              </p>
            </div>

            <div className="rounded-xl border border-outline/60 bg-surface-darker/60 p-4 text-xs text-muted text-left space-y-1.5">
              <p className="font-semibold text-on-background">Quick Shortcuts:</p>
              <p>• Press <kbd className="rounded bg-outline/50 px-1.5 py-0.5 text-on-background">F11</kbd> to toggle Fullscreen</p>
              <p>• Press <kbd className="rounded bg-outline/50 px-1.5 py-0.5 text-on-background">Guide / Xbox Button</kbd> to enter Big Picture Mode</p>
              <p>• Full database backups available anytime in Settings</p>
            </div>
          </div>
        )}

        {/* Modal Navigation Buttons */}
        <div className="flex items-center justify-between border-t border-outline/50 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            data-nav-item="true"
          >
            Skip Onboarding
          </Button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                data-nav-item="true"
              >
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                variant="accent"
                size="sm"
                rightIcon={<ArrowRight className="h-4 w-4" />}
                onClick={() => setStep((s) => (s + 1) as 2 | 3)}
                data-nav-item="true"
              >
                Next
              </Button>
            ) : (
              <Button
                variant="accent"
                size="sm"
                leftIcon={<Check className="h-4 w-4" />}
                onClick={handleFinish}
                data-nav-item="true"
              >
                Start Using CHECKPOINT
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

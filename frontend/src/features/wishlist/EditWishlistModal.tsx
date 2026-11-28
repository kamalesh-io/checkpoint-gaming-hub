import { useState, useEffect, type FormEvent } from 'react';
import { Tag, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useUpdateWishlistItemMutation } from '@/hooks/queries/usePhase5Queries';
import { useToastStore } from '@/stores/toastStore';
import type { WishlistItemRead } from '@/types';

interface EditWishlistModalProps {
  open: boolean;
  item: WishlistItemRead | null;
  onClose: () => void;
}

export function EditWishlistModal({ open, item, onClose }: EditWishlistModalProps) {
  const updateMutation = useUpdateWishlistItemMutation();
  const addToast = useToastStore((s) => s.addToast);

  const [priority, setPriority] = useState<string>('Medium');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [currency, setCurrency] = useState<string>('INR');
  const [storePreference, setStorePreference] = useState<string>('Any');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setPriority(item.priority || 'Medium');
      setTargetPrice(item.target_price !== null && item.target_price !== undefined ? String(item.target_price) : '');
      setCurrency(item.currency || 'INR');
      setStorePreference(item.store_preference || 'Any');
      setNotes(item.notes || '');
      setFormError(null);
    }
  }, [item]);

  if (!item) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    let parsedTargetPrice: number | null = null;
    if (targetPrice.trim() !== '') {
      const p = parseFloat(targetPrice.trim());
      if (isNaN(p) || p < 0) {
        setFormError('Target price must be a valid positive number.');
        return;
      }
      parsedTargetPrice = Math.round(p * 100) / 100;
    }

    try {
      await updateMutation.mutateAsync({
        id: item.id,
        payload: {
          priority,
          target_price: parsedTargetPrice,
          currency,
          store_preference: storePreference,
          notes: notes.trim() || undefined,
        },
      });

      addToast({
        tone: 'success',
        title: 'Wishlist Item Updated',
        message: `Preferences updated for "${item.game.title}".`,
      });

      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to update wishlist item.');
    }
  };

  const currencySymbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£';

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={`Edit Wishlist: ${item.game.title}`}
      subtitle="Update target purchase price, preferred store, and priority."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {formError && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-body-sm text-danger">
            {formError}
          </div>
        )}

        {/* Priority & Store */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1">
              Purchase Priority
            </label>
            <Select
              data-nav-item="true"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={[
                { value: 'High', label: 'High Priority' },
                { value: 'Medium', label: 'Medium Priority' },
                { value: 'Low', label: 'Low Priority' },
              ]}
            />
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1">
              Preferred Store
            </label>
            <Select
              data-nav-item="true"
              value={storePreference}
              onChange={(e) => setStorePreference(e.target.value)}
              options={[
                { value: 'Any', label: 'Any Store' },
                { value: 'Steam', label: 'Steam' },
                { value: 'Epic Games', label: 'Epic Games Store' },
                { value: 'GOG', label: 'GOG' },
                { value: 'PlayStation Store', label: 'PlayStation Store' },
                { value: 'Xbox', label: 'Xbox' },
                { value: 'Nintendo eShop', label: 'Nintendo eShop' },
              ]}
            />
          </div>
        </div>

        {/* Target Price & Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-accent-primary" />
                Target Purchase Price
              </span>
              {targetPrice && (
                <button
                  type="button"
                  onClick={() => setTargetPrice('')}
                  className="text-caption text-accent-primary hover:underline"
                >
                  Clear Price
                </button>
              )}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-on-surface-variant">
                {currencySymbol}
              </span>
              <Input
                data-nav-item="true"
                type="number"
                step="any"
                min="0"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="e.g., 999"
                className="pl-8"
              />
            </div>
            <p className="mt-1 text-caption text-on-surface-variant">
              Leave blank to disable target discount tracking for this title.
            </p>
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1">
              Currency
            </label>
            <Select
              data-nav-item="true"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              options={[
                { value: 'INR', label: 'INR (₹)' },
                { value: 'USD', label: 'USD ($)' },
                { value: 'EUR', label: 'EUR (€)' },
                { value: 'GBP', label: 'GBP (£)' },
              ]}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-label-sm font-medium text-on-surface-variant mb-1">
            Personal Notes
          </label>
          <textarea
            data-nav-item="true"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g., Waiting for sale, or gift idea..."
            className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background placeholder:text-muted focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline/50">
          <Button data-nav-item="true" type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-nav-item="true"
            type="submit"
            variant="primary"
            disabled={updateMutation.isPending}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

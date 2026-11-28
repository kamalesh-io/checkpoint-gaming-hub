import { useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { FolderPlus, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCreateCollectionMutation, useUpdateCollectionMutation } from '@/hooks/queries';
import { useToastStore } from '@/stores/toastStore';
import { soundManager } from '@/audio/soundManager';
import type { CollectionRead } from '@/types';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionToEdit?: CollectionRead | null;
}

export function CreateCollectionModal({
  isOpen,
  onClose,
  collectionToEdit,
}: CreateCollectionModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const createMutation = useCreateCollectionMutation();
  const updateMutation = useUpdateCollectionMutation();

  const [name, setName] = useState(collectionToEdit?.name ?? '');
  const [description, setDescription] = useState(collectionToEdit?.description ?? '');
  const [bannerUrl, setBannerUrl] = useState(collectionToEdit?.banner_url ?? '');
  const [isPinned, setIsPinned] = useState(collectionToEdit?.is_pinned ?? false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast({
        tone: 'error',
        title: 'Invalid File',
        message: 'Please choose an image file (PNG, JPG, WebP, GIF).',
      });
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      addToast({
        tone: 'warning',
        title: 'Image Too Large',
        message: 'Please choose an image under 8 MB for optimal performance.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setBannerUrl(dataUrl);
        addToast({
          tone: 'info',
          title: 'Banner Image Loaded',
          message: `${file.name} ready to save with collection.`,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (collectionToEdit) {
        await updateMutation.mutateAsync({
          id: collectionToEdit.id,
          payload: {
            name: name.trim(),
            description: description.trim() || null,
            banner_url: bannerUrl.trim() || null,
            is_pinned: isPinned,
          },
        });
        soundManager.playDone();
        addToast({ tone: 'success', title: 'Collection Updated', message: `Saved "${name}".` });
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          description: description.trim() || null,
          banner_url: bannerUrl.trim() || null,
          is_pinned: isPinned,
        });
        soundManager.playDone();
        addToast({ tone: 'success', title: 'Collection Created', message: `Created "${name}".` });
      }
      onClose();
    } catch {
      addToast({ tone: 'error', title: 'Action Failed', message: 'Could not save collection.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-outline/80 bg-surface-darker p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-outline/70 pb-3">
          <div className="flex items-center gap-2 text-accent-primary">
            <FolderPlus className="h-5 w-5" />
            <h3 className="font-headline text-headline-sm font-bold text-on-background">
              {collectionToEdit ? 'Edit Collection' : 'Create New Collection'}
            </h3>
          </div>
          <button
            data-nav-item="true"
            onClick={onClose}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-elevated hover:text-on-background"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
              Collection Name
            </label>
            <input
              data-nav-item="true"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Soulslike Masterpieces, Cozy Deck Games"
              className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background focus:outline-none focus:ring-1 focus:ring-accent-primary"
            />
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
              Description (optional)
            </label>
            <textarea
              data-nav-item="true"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief theme or description"
              className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent-primary"
            />
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface-variant mb-1.5">
              Custom Banner Image (optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleImageFileSelect}
            />
            <div className="flex items-center gap-2">
              <input
                data-nav-item="true"
                type="text"
                value={bannerUrl.startsWith('data:') ? 'Local Image Attached (' + (bannerUrl.length > 50 ? bannerUrl.slice(0, 30) + '...' : bannerUrl) + ')' : bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://.../banner.jpg or click Upload Image"
                className="w-full rounded-xl border border-outline/70 bg-surface-dark px-3 py-2 text-body-sm text-on-background placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent-primary"
              />
              <Button
                data-nav-item="true"
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => fileInputRef.current?.click()}
                leftIcon={<Upload className="h-4 w-4" />}
              >
                Upload
              </Button>
            </div>

            {bannerUrl && (
              <div className="relative mt-2.5 overflow-hidden rounded-xl border border-outline/70 bg-surface-dark aspect-[16/6] max-h-36 flex items-center justify-center">
                <img
                  src={bannerUrl}
                  alt="Banner preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  data-nav-item="true"
                  onClick={() => setBannerUrl('')}
                  className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-black/75 px-2 py-1 text-xs text-error hover:bg-black transition-colors"
                  title="Remove custom banner"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-body-sm text-on-background">
            <input
              data-nav-item="true"
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded border-outline/70 bg-surface-dark text-accent-primary focus:ring-accent-primary"
            />
            <span>Pin collection to top of library</span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline/60">
            <Button data-nav-item="true" variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              data-nav-item="true"
              variant="primary"
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {collectionToEdit ? 'Save Changes' : 'Create Collection'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

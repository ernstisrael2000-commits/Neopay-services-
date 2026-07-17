import React, { useState } from 'react';
import { Camera, Check, X, Pencil } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';

interface PhotoUrlEditorProps {
  currentUrl?: string;
  onSave: (url: string) => Promise<void>;
  className?: string;
}

export default function PhotoUrlEditor({ currentUrl, onSave, className = '' }: PhotoUrlEditorProps) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(currentUrl || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(url.trim());
      toast.success('Photo mise à jour !');
      setEditing(false);
    } catch {
      toast.error('Erreur lors de la mise à jour.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={`flex items-center gap-2 text-xs text-primary font-bold py-2 px-3 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors ${className}`}
      >
        <Camera className="h-3.5 w-3.5" />
        {currentUrl ? 'Changer la photo' : 'Ajouter une photo de profil'}
      </button>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">URL de la photo</p>
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://example.com/photo.jpg"
          className="flex-1 h-10 rounded-xl bg-gray-50 border-0 text-sm"
          autoFocus
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="h-10 rounded-xl bg-primary text-white border-0 px-3"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { setUrl(currentUrl || ''); setEditing(false); }}
          className="h-10 rounded-xl px-3"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {url && (
        <img
          src={url}
          alt="Aperçu"
          className="h-14 w-14 rounded-xl object-cover border border-gray-100"
          onError={e => (e.target as HTMLImageElement).style.display = 'none'}
        />
      )}
    </div>
  );
}

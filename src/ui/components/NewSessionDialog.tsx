import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui/components/ui/dialog';
import { Button } from '@/ui/components/ui/button';
import { Input } from '@/ui/components/ui/input';
import { ScrollArea } from '@/ui/components/ui/scroll-area';

interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: { name: string; topic: string; models: string[] }) => void;
}

export function NewSessionDialog({ open, onOpenChange, onCreate }: NewSessionDialogProps) {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      fetch('/api/models')
        .then(res => res.json())
        .then(data => setAvailableModels(data.models || []))
        .catch(() => setAvailableModels([]));
      
      setName('');
      setTopic('');
      setSelectedModels([]);
    }
  }, [open]);

  const handleSubmit = () => {
    if (!name || !topic || selectedModels.length < 2) return;
    onCreate({ name, topic, models: selectedModels });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Discussion</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Session Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. AI Ethics" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Topic</label>
            <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="What to discuss?" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Participants (Select at least 2)</label>
            <ScrollArea className="h-[200px] border rounded-md p-2">
              <div className="space-y-2">
                {availableModels.map(model => (
                  <label key={model} className="flex items-center space-x-2 cursor-pointer hover:bg-muted p-1 rounded">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedModels.includes(model)}
                      onChange={e => {
                        if (e.target.checked) setSelectedModels([...selectedModels, model]);
                        else setSelectedModels(selectedModels.filter(m => m !== model));
                      }}
                    />
                    <span className="text-sm">{model}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!name || !topic || selectedModels.length < 2}>
            Create Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

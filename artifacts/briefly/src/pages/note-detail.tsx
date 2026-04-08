import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetNote, getGetNoteQueryKey,
  useUpdateNote,
  useUpdateNoteTags,
  useArchiveNote,
  useDeleteNote,
  useMoveNote,
  useListCollections, getListCollectionsQueryKey
} from "@workspace/api-client-react";
import { ArrowLeft, Clock, History, Tag, Archive, Trash2, FolderInput, MoreVertical, Library, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";

export function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const noteId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: note, isLoading, error } = useGetNote(noteId, {
    query: { enabled: !isNaN(noteId), queryKey: getGetNoteQueryKey(noteId) }
  });

  const { data: collections } = useListCollections({
    query: { queryKey: getListCollectionsQueryKey() }
  });

  const updateNote = useUpdateNote();
  const updateTags = useUpdateNoteTags();
  const archiveNote = useArchiveNote();
  const deleteNote = useDeleteNote();
  const moveNote = useMoveNote();

  // Local state for editing
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error" | "">("");
  
  // Tag management
  const [tagInput, setTagInput] = useState("");
  
  // Dialogs
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [moveCollectionId, setMoveCollectionId] = useState<string>("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Auto-save logic
  const initializedForId = useRef<number | null>(null);
  const lastSaved = useRef({ title: "", body: "" });
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mutateFnRef = useRef(updateNote.mutate);
  mutateFnRef.current = updateNote.mutate;

  useEffect(() => {
    if (note && initializedForId.current !== noteId) {
      initializedForId.current = noteId;
      setTitle(note.title);
      setBody(note.body);
      lastSaved.current = { title: note.title, body: note.body };
      setSaveStatus("");
    }
  }, [note, noteId]);

  const triggerSave = useCallback((newTitle: string, newBody: string) => {
    if (initializedForId.current !== noteId) return;
    if (newTitle === lastSaved.current.title && newBody === lastSaved.current.body) return;

    setSaveStatus("saving");
    mutateFnRef.current(
      { id: noteId, data: { title: newTitle, body: newBody } },
      {
        onSuccess: (data) => {
          lastSaved.current = { title: newTitle, body: newBody };
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus(""), 2000);
          queryClient.setQueryData(getGetNoteQueryKey(noteId), (old: Record<string, unknown> | undefined) => 
            old ? { ...old, title: data.title, body: data.body, updatedAt: data.updatedAt } : old
          );
        },
        onError: () => {
          setSaveStatus("error");
        }
      }
    );
  }, [noteId, queryClient]);

  // Debounce changes
  useEffect(() => {
    if (initializedForId.current !== noteId) return;
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      triggerSave(title, body);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [title, body, noteId, triggerSave]);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim() && note) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!note.tags.includes(newTag)) {
        const newTags = [...note.tags, newTag];
        updateTags.mutate({ id: noteId, data: { tags: newTags } }, {
          onSuccess: () => {
            setTagInput("");
            queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) });
          }
        });
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (note) {
      const newTags = note.tags.filter(t => t !== tagToRemove);
      updateTags.mutate({ id: noteId, data: { tags: newTags } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) });
        }
      });
    }
  };

  const handleMove = () => {
    if (moveCollectionId) {
      moveNote.mutate({ id: noteId, data: { collectionId: parseInt(moveCollectionId, 10) } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) });
          setIsMoveOpen(false);
        }
      });
    }
  };

  const handleArchive = () => {
    if (note) {
      archiveNote.mutate({ id: noteId, data: { archived: !note.archived } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) });
        }
      });
    }
  };

  const handleDelete = () => {
    deleteNote.mutate({ id: noteId }, {
      onSuccess: () => {
        setLocation(note?.collectionId ? `/collections/${note.collectionId}` : "/");
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col p-8 max-w-4xl mx-auto w-full h-screen">
        <Skeleton className="h-4 w-32 mb-8" />
        <Skeleton className="h-12 w-3/4 mb-4" />
        <Skeleton className="h-8 w-full mb-2" />
        <Skeleton className="h-8 w-full mb-2" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="p-8 text-center py-20">
        <h2 className="text-2xl font-bold">Note not found</h2>
        <Button variant="link" asChild className="mt-4"><Link href="/">Back to Dashboard</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full h-[100dvh]">
      
      {/* Top Bar */}
      <header className="shrink-0 p-4 px-6 md:px-8 border-b border-border/30 flex items-center justify-between bg-background z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="-ml-2 text-muted-foreground hover:text-foreground">
            <Link href={`/collections/${note.collectionId}`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex flex-col">
            <Link href={`/collections/${note.collectionId}`} className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
              <Library className="w-3 h-3" /> {note.collectionName || "Collection"}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground w-16 text-right">
            {saveStatus === "saving" && "Saving..."}
            {saveStatus === "saved" && <span className="text-primary flex items-center justify-end gap-1"><Save className="w-3 h-3" /> Saved</span>}
            {saveStatus === "error" && <span className="text-destructive">Error</span>}
          </span>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs px-2 gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Tags
                {note.tags.length > 0 && <Badge variant="secondary" className="ml-1 px-1 py-0 h-4 text-[10px]">{note.tags.length}</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3">
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Tags</h4>
                <div className="flex flex-wrap gap-1.5">
                  {note.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1 pr-1">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="hover:bg-muted p-0.5 rounded-full">
                        &times;
                      </button>
                    </Badge>
                  ))}
                  {note.tags.length === 0 && <span className="text-xs text-muted-foreground">No tags added</span>}
                </div>
                <Input 
                  placeholder="Add tag and press Enter" 
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  className="h-8 text-sm"
                />
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Note Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsMoveOpen(true)}>
                <FolderInput className="w-4 h-4 mr-2" /> Move to Collection
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="w-4 h-4 mr-2" /> {note.archived ? "Unarchive" : "Archive"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Editor Area */}
      <main className="flex-1 overflow-y-auto px-6 md:px-12 py-10">
        <div className="max-w-3xl mx-auto space-y-6">
          {note.archived && (
            <div className="bg-muted text-muted-foreground p-3 rounded-lg text-sm flex items-center justify-center gap-2 mb-6">
              <Archive className="w-4 h-4" /> This note is archived and read-only.
            </div>
          )}

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={note.archived}
            placeholder="Note Title"
            className="w-full text-4xl md:text-5xl font-serif font-bold bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground/40 text-foreground"
          />

          <div className="flex items-center gap-4 text-xs text-muted-foreground border-b border-border/40 pb-6 mb-6">
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Updated {format(new Date(note.updatedAt), "MMM d, h:mm a")}</span>
            <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> {note.revisions?.length || 0} revisions</span>
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={note.archived}
            placeholder="Start typing..."
            className="w-full min-h-[50vh] text-lg leading-relaxed bg-transparent border-none outline-none focus:ring-0 resize-none placeholder:text-muted-foreground/40 text-foreground"
          />
        </div>
      </main>

      {/* Move Dialog */}
      <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Note</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select onValueChange={setMoveCollectionId} value={moveCollectionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a collection" />
              </SelectTrigger>
              <SelectContent>
                {collections?.filter(c => c.id !== note.collectionId).map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveOpen(false)}>Cancel</Button>
            <Button onClick={handleMove} disabled={!moveCollectionId || moveNote.isPending}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteNote.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

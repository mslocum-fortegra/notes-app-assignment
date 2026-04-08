import { useState } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetDashboard, 
  getGetDashboardQueryKey,
  useGetDashboardStats,
  getGetDashboardStatsQueryKey,
  useGetActivityFeed,
  getGetActivityFeedQueryKey,
  useListCollections,
  getListCollectionsQueryKey,
  useCreateCollection,
  useCreateNote,
  useListNotes,
  getListNotesQueryKey
} from "@workspace/api-client-react";
import { 
  FileText, 
  Library, 
  Clock, 
  Archive, 
  Users, 
  Plus, 
  Activity,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isNewColOpen, setIsNewColOpen] = useState(false);
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  
  const [newColName, setNewColName] = useState("");
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteColId, setNewNoteColId] = useState("");

  const { data: dashboard, isLoading: isLoadingDashboard } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey() }
  });

  const { data: stats, isLoading: isLoadingStats } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() }
  });

  const { data: allNotes } = useListNotes(undefined, {
    query: { queryKey: getListNotesQueryKey() }
  });

  const { data: activityFeed } = useGetActivityFeed({ limit: 10 }, {
    query: { queryKey: getGetActivityFeedQueryKey({ limit: 10 }) }
  });

  const { data: collections } = useListCollections({
    query: { queryKey: getListCollectionsQueryKey() }
  });

  const createCollection = useCreateCollection();
  const createNote = useCreateNote();

  const handleCreateCollection = () => {
    if (!newColName.trim()) return;
    createCollection.mutate({ data: { name: newColName, visibility: "private" } }, {
      onSuccess: (col) => {
        setIsNewColOpen(false);
        setNewColName("");
        queryClient.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setLocation(`/collections/${col.id}`);
      }
    });
  };

  const handleCreateNote = () => {
    if (!newNoteTitle.trim() || !newNoteColId) return;
    createNote.mutate({ data: { title: newNoteTitle, collectionId: parseInt(newNoteColId, 10) } }, {
      onSuccess: (note) => {
        setIsNewNoteOpen(false);
        setNewNoteTitle("");
        setNewNoteColId("");
        queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setLocation(`/notes/${note.id}`);
      }
    });
  };

  return (
    <div className="flex-1 p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground mt-1">Here is what is happening in your workspace.</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isNewColOpen} onOpenChange={setIsNewColOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">New Collection</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Collection</DialogTitle></DialogHeader>
              <div className="py-4">
                <Input placeholder="Collection Name" value={newColName} onChange={e => setNewColName(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewColOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateCollection} disabled={!newColName.trim() || createCollection.isPending}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isNewNoteOpen} onOpenChange={setIsNewNoteOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Note
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Note</DialogTitle></DialogHeader>
              <div className="py-4 space-y-4">
                <Input placeholder="Note Title" value={newNoteTitle} onChange={e => setNewNoteTitle(e.target.value)} />
                <Select value={newNoteColId} onValueChange={setNewNoteColId}>
                  <SelectTrigger><SelectValue placeholder="Select a collection" /></SelectTrigger>
                  <SelectContent>
                    {collections?.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewNoteOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateNote} disabled={!newNoteTitle.trim() || !newNoteColId || createNote.isPending}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Notes" 
          value={stats?.totalNotes} 
          icon={FileText} 
          isLoading={isLoadingStats} 
        />
        <StatCard 
          title="Collections" 
          value={stats?.totalCollections} 
          icon={Library} 
          isLoading={isLoadingStats} 
        />
        <StatCard 
          title="Shared With You" 
          value={stats?.sharedCollections} 
          icon={Users} 
          isLoading={isLoadingStats} 
        />
        <StatCard 
          title="Archived" 
          value={stats?.archivedNotes} 
          icon={Archive} 
          isLoading={isLoadingStats} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Notes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-semibold text-foreground">Recent Notes</h2>
            <Link href="/search?sort=recent" className="text-sm font-medium text-primary hover:underline flex items-center">
              View all <ArrowRight className="ml-1 w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isLoadingDashboard ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)
            ) : dashboard?.recentNotes.length === 0 ? (
              <div className="col-span-full py-12 text-center border border-dashed rounded-xl bg-card/50">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                <h3 className="text-sm font-medium">No notes yet</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first note to get started.</p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/notes/new">Create Note</Link>
                </Button>
              </div>
            ) : (
              dashboard?.recentNotes.map((note) => (
                <Link key={note.id} href={`/notes/${note.id}`}>
                  <Card className="h-full hover-elevate transition-all cursor-pointer border-card-border/60 hover:border-primary/30 group">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start mb-2">
                        {note.collectionName ? (
                          <Badge variant="secondary" className="text-xs font-normal rounded-sm px-2 py-0.5 bg-secondary/50">
                            {note.collectionName}
                          </Badge>
                        ) : <div />}
                        <span className="text-xs text-muted-foreground flex items-center">
                          <Clock className="w-3 h-3 mr-1 inline" />
                          {format(new Date(note.updatedAt), "MMM d")}
                        </span>
                      </div>
                      <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                        {note.title || "Untitled Note"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        {note.body || "No content"}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-semibold text-foreground">Activity</h2>
            <Activity className="w-5 h-5 text-muted-foreground" />
          </div>
          
          <Card className="border-card-border/60">
            <CardContent className="p-0">
              {isLoadingDashboard ? (
                <div className="p-4 space-y-4">
                  {Array(5).fill(0).map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : dashboard?.recentActivity.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No recent activity
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {dashboard?.recentActivity.map((event) => (
                    <div key={event.id} className="p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                        <ActivityIcon type={event.type} />
                      </div>
                      <div>
                        <p className="text-sm leading-snug">
                          <span className="font-medium text-foreground">{event.actorName || "Someone"}</span>
                          {" "}
                          <ActivityText type={event.type} />
                          {" "}
                          {event.entityTitle && (
                            <span className="font-medium text-foreground">{event.entityTitle}</span>
                          )}
                        </p>
                        <span className="text-xs text-muted-foreground mt-0.5 block">
                          {format(new Date(event.createdAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, isLoading }: { title: string; value: number | undefined; icon: React.ComponentType<{ className?: string }>; isLoading: boolean }) {
  return (
    <Card className="border-card-border/60">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="text-2xl font-bold text-foreground">{value ?? 0}</p>
          )}
        </div>
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "note_created":
    case "note_edited":
      return <FileText className="w-4 h-4 text-primary" />;
    case "note_archived":
    case "note_deleted":
      return <Archive className="w-4 h-4 text-destructive" />;
    case "collection_created":
    case "collection_shared":
      return <Library className="w-4 h-4 text-primary" />;
    case "member_added":
    case "member_removed":
      return <Users className="w-4 h-4 text-primary" />;
    default:
      return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
}

function ActivityText({ type }: { type: string }) {
  switch (type) {
    case "note_created": return "created note";
    case "note_edited": return "updated note";
    case "note_archived": return "archived note";
    case "note_deleted": return "deleted note";
    case "collection_created": return "created collection";
    case "collection_shared": return "shared collection";
    case "member_added": return "added a member to";
    case "member_removed": return "removed a member from";
    default: return "performed an action on";
  }
}

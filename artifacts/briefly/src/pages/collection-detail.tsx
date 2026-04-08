import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetCollection, getGetCollectionQueryKey,
  useUpdateCollection,
  useDeleteCollection,
  useAddCollectionMember,
  useRemoveCollectionMember,
  useListUsers, getListUsersQueryKey,
  useCreateNote
} from "@workspace/api-client-react";
import { Library, Plus, Search, Settings, MoreVertical, Globe, Lock, Users, Trash2, Edit, FileText, ArrowLeft, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@workspace/replit-auth-web";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const editFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  visibility: z.enum(["private", "shared"]).default("private"),
});

const inviteFormSchema = z.object({
  userId: z.string().min(1, "User is required"),
  role: z.enum(["editor", "viewer"]).default("viewer"),
});

export function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const collectionId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data: collection, isLoading, error } = useGetCollection(collectionId, {
    query: { enabled: !isNaN(collectionId), queryKey: getGetCollectionQueryKey(collectionId) }
  });

  const { data: usersList } = useListUsers({
    query: { queryKey: getListUsersQueryKey(), enabled: isInviteOpen }
  });

  const updateCollection = useUpdateCollection();
  const deleteCollection = useDeleteCollection();
  const addMember = useAddCollectionMember();
  const removeMember = useRemoveCollectionMember();
  const createNote = useCreateNote();

  const editForm = useForm<z.infer<typeof editFormSchema>>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      name: "",
      description: "",
      visibility: "private",
    },
  });

  const inviteForm = useForm<z.infer<typeof inviteFormSchema>>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      userId: "",
      role: "viewer",
    },
  });

  // Init edit form
  if (collection && editForm.getValues("name") === "" && !isEditOpen) {
    editForm.reset({
      name: collection.name,
      description: collection.description || "",
      visibility: collection.visibility === "shared" ? "shared" : "private",
    });
  }

  const isOwner = collection?.ownerId === user?.id;

  const onEditSubmit = (values: z.infer<typeof editFormSchema>) => {
    updateCollection.mutate({ id: collectionId, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCollectionQueryKey(collectionId) });
        setIsEditOpen(false);
      }
    });
  };

  const onDelete = () => {
    deleteCollection.mutate({ id: collectionId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
        setLocation("/collections");
      }
    });
  };

  const onInviteSubmit = (values: z.infer<typeof inviteFormSchema>) => {
    addMember.mutate({ id: collectionId, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCollectionQueryKey(collectionId) });
        setIsInviteOpen(false);
        inviteForm.reset();
      }
    });
  };

  const onRemoveMember = (userId: string) => {
    removeMember.mutate({ id: collectionId, userId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCollectionQueryKey(collectionId) });
      }
    });
  };

  const handleCreateNote = () => {
    createNote.mutate({ data: { title: "Untitled Note", collectionId } }, {
      onSuccess: (note) => {
        setLocation(`/notes/${note.id}`);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
        <Skeleton className="h-8 w-24 mb-4" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="col-span-2 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="p-8 max-w-6xl mx-auto w-full text-center py-20">
        <h2 className="text-2xl font-bold">Collection not found</h2>
        <Button variant="link" asChild className="mt-4"><Link href="/collections">Back to Collections</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="mb-4">
        <Link href="/collections" className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Collections
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-border/50">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="secondary" className="text-xs font-normal">
              {collection.visibility === "shared" ? (
                <><Globe className="w-3 h-3 mr-1 inline" /> Shared</>
              ) : (
                <><Lock className="w-3 h-3 mr-1 inline" /> Private</>
              )}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Created {format(new Date(collection.createdAt), "MMM d, yyyy")}
            </span>
          </div>
          <h1 className="text-4xl font-serif font-bold text-foreground">{collection.name}</h1>
          {collection.description && (
            <p className="text-lg text-muted-foreground mt-2 max-w-2xl">{collection.description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={handleCreateNote}>
            <Plus className="w-4 h-4 mr-2" /> Note
          </Button>

          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Manage Collection</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                  <Edit className="w-4 h-4 mr-2" /> Edit Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="notes" className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> Notes
          </TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Members ({collection.members?.length || 1})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="space-y-6">
          {collection.notes?.length === 0 ? (
            <div className="py-16 text-center border border-dashed rounded-xl bg-card/50">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-foreground">This collection is empty</h3>
              <p className="text-muted-foreground mt-1 mb-4">Create a note to start organizing your thoughts here.</p>
              <Button onClick={handleCreateNote}>Create Note</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collection.notes?.map((note) => (
                <Link key={note.id} href={`/notes/${note.id}`}>
                  <Card className="h-full hover-elevate transition-all cursor-pointer border-card-border/60 hover:border-primary/30 group">
                    <CardHeader className="p-5 pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(note.updatedAt), "MMM d, yyyy")}
                        </span>
                      </div>
                      <CardTitle className="text-lg font-serif group-hover:text-primary transition-colors">
                        {note.title || "Untitled Note"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {note.body || "No content"}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-semibold">Collaborators</h2>
            {isOwner && collection.visibility === "shared" && (
              <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" /> Invite
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Collaborator</DialogTitle>
                    <DialogDescription>
                      Add someone to this collection to collaborate on notes.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...inviteForm}>
                    <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-4">
                      <FormField
                        control={inviteForm.control}
                        name="userId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>User</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a user" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {usersList?.map(u => (
                                  <SelectItem key={u.id} value={u.id} disabled={collection.members?.some(m => m.userId === u.id)}>
                                    {u.firstName} {u.lastName} ({u.email})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={inviteForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="editor">Editor (can edit notes)</SelectItem>
                                <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={addMember.isPending}>
                          {addMember.isPending ? "Inviting..." : "Send Invite"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {collection.visibility === "private" ? (
            <div className="p-6 border border-border/50 rounded-xl bg-card text-center">
              <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-foreground font-medium">This collection is private</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Only you can view and edit notes here.</p>
              {isOwner && (
                <Button variant="outline" onClick={() => {
                  editForm.setValue("visibility", "shared");
                  setIsEditOpen(true);
                }}>Change to Shared</Button>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border/50 rounded-xl divide-y divide-border/50 overflow-hidden">
              {collection.members?.map((member) => (
                <div key={member.userId} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={member.userProfileImageUrl || undefined} />
                      <AvatarFallback>{member.userName?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm text-foreground">{member.userName || member.userEmail}</p>
                      <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                    </div>
                  </div>
                  {isOwner && member.userId !== collection.ownerId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-destructive" onClick={() => onRemoveMember(member.userId)}>
                          Remove access
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Collection</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibility</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="shared">Shared</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updateCollection.isPending}>Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Collection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this collection? All notes inside will also be deleted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={onDelete} disabled={deleteCollection.isPending}>
              {deleteCollection.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

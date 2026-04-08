import { useState } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListCollections, 
  getListCollectionsQueryKey,
  useCreateCollection 
} from "@workspace/api-client-react";
import { Library, Plus, Search, Users, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  visibility: z.enum(["private", "shared"]).default("private"),
});

export function Collections() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: collections, isLoading } = useListCollections({
    query: { queryKey: getListCollectionsQueryKey() }
  });

  const createCollection = useCreateCollection();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      visibility: "private",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createCollection.mutate({ data: values }, {
      onSuccess: (newCollection) => {
        queryClient.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
        setIsCreateOpen(false);
        form.reset();
        setLocation(`/collections/${newCollection.id}`);
      }
    });
  };

  const filteredCollections = collections?.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-1 p-8 max-w-6xl mx-auto w-full space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Collections</h1>
          <p className="text-muted-foreground mt-1">Organize your notes into shared or private spaces.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Collection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Collection</DialogTitle>
              <DialogDescription>
                A collection is a group of notes. You can share it with others or keep it private.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Marketing Ideas" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="What is this collection for?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="visibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visibility</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select visibility" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="private">Private</SelectItem>
                          <SelectItem value="shared">Shared</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createCollection.isPending}>
                    {createCollection.isPending ? "Creating..." : "Create Collection"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search collections..." 
          className="pl-9 bg-card"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)
        ) : filteredCollections?.length === 0 ? (
          <div className="col-span-full py-16 text-center border border-dashed rounded-xl bg-card/50">
            <Library className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground">No collections found</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              {searchQuery ? "Try a different search term." : "Create your first collection to get started."}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreateOpen(true)}>Create Collection</Button>
            )}
          </div>
        ) : (
          filteredCollections?.map((collection) => (
            <Link key={collection.id} href={`/collections/${collection.id}`}>
              <Card className="h-full hover-elevate transition-all cursor-pointer border-card-border/60 hover:border-primary/30 group flex flex-col">
                <CardHeader className="p-5 pb-3">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="text-xs font-normal">
                      {collection.visibility === "shared" ? (
                        <><Globe className="w-3 h-3 mr-1 inline" /> Shared</>
                      ) : (
                        <><Lock className="w-3 h-3 mr-1 inline" /> Private</>
                      )}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-serif group-hover:text-primary transition-colors">
                    {collection.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {collection.description || "No description"}
                  </p>
                </CardContent>
                <CardFooter className="p-5 pt-0 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 mt-4 pt-4">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center">
                      <Library className="w-3.5 h-3.5 mr-1.5" />
                      {collection.noteCount} notes
                    </span>
                    {collection.visibility === "shared" && (
                      <span className="flex items-center">
                        <Users className="w-3.5 h-3.5 mr-1.5" />
                        {collection.memberCount} members
                      </span>
                    )}
                  </div>
                </CardFooter>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

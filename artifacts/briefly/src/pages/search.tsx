import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { 
  useSearchNotes, getSearchNotesQueryKey,
  useListCollections, getListCollectionsQueryKey,
  useListTags, getListTagsQueryKey
} from "@workspace/api-client-react";
import { Search as SearchIcon, Filter, Clock, FileText, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import type { SearchNotesParams, SearchNotesSort } from "@workspace/api-client-react";

export function Search() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [collectionId, setCollectionId] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");
  const [sort, setSort] = useState<SearchNotesSort>("relevant");

  const { data: collections } = useListCollections({
    query: { queryKey: getListCollectionsQueryKey() }
  });

  const { data: tags } = useListTags({
    query: { queryKey: getListTagsQueryKey() }
  });

  const searchParams: SearchNotesParams = { q: debouncedQ, sort };
  if (collectionId !== "all") searchParams.collectionId = parseInt(collectionId, 10);
  if (tag !== "all") searchParams.tag = tag;

  const { data: searchResults, isLoading, isFetching } = useSearchNotes(searchParams, {
    query: { 
      queryKey: getSearchNotesQueryKey(searchParams),
    }
  });

  return (
    <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full h-[100dvh]">
      <div className="p-8 border-b border-border/50 shrink-0 bg-background/95 backdrop-blur z-10 sticky top-0">
        <h1 className="text-3xl font-serif font-bold text-foreground mb-6">Search Notes</h1>
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search across all notes..." 
              className="pl-10 h-12 text-base bg-card border-card-border"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>
          
          <div className="flex items-center gap-3 shrink-0 overflow-x-auto pb-1 md:pb-0">
            <Select value={collectionId} onValueChange={setCollectionId}>
              <SelectTrigger className="w-[160px] h-12">
                <SelectValue placeholder="Collection" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Collections</SelectItem>
                {collections?.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger className="w-[140px] h-12">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {tags?.map(t => (
                  <SelectItem key={t.tag} value={t.tag}>{t.tag} ({t.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v: string) => setSort(v as SearchNotesSort)}>
              <SelectTrigger className="w-[140px] h-12">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevant">Most Relevant</SelectItem>
                <SelectItem value="recent">Recently Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-muted/20">
        {isLoading || (isFetching && !searchResults) ? (
          <div className="space-y-4">
            {Array(4).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : searchResults?.results.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-medium text-foreground">No notes found</h3>
            <p>Try adjusting your search terms or filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground mb-4">
              Found {searchResults?.total} results
            </p>
            {searchResults?.results.map(({ note, snippet, score }) => (
              <Link key={note.id} href={`/notes/${note.id}`}>
                <Card className="hover-elevate transition-all cursor-pointer border-card-border/60 hover:border-primary/30 group">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                      <h3 className="text-xl font-serif font-medium group-hover:text-primary transition-colors">
                        {note.title || "Untitled Note"}
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                        {note.collectionName && (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {note.collectionName}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {format(new Date(note.updatedAt), "MMM d")}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {snippet || "No content matched"}
                    </p>
                    
                    {note.tags && note.tags.length > 0 && (
                      <div className="mt-4 flex gap-1.5 flex-wrap">
                        {note.tags.map(t => (
                          <Badge key={t} variant="outline" className="text-[10px] bg-background/50 text-muted-foreground">#{t}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

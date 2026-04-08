import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetUserSettings, getGetUserSettingsQueryKey,
  useUpdateUserSettings,
  useListCollections, getListCollectionsQueryKey
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Settings as SettingsIcon, Bell, User, Library } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const profileFormSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters."),
});

const prefsFormSchema = z.object({
  notificationsEnabled: z.boolean(),
  defaultCollectionId: z.string().nullable().optional(),
});

export function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetUserSettings({
    query: { queryKey: getGetUserSettingsQueryKey() }
  });

  const { data: collections } = useListCollections({
    query: { queryKey: getListCollectionsQueryKey() }
  });

  const updateSettings = useUpdateUserSettings();

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { displayName: "" },
  });

  const prefsForm = useForm<z.infer<typeof prefsFormSchema>>({
    resolver: zodResolver(prefsFormSchema),
    defaultValues: { notificationsEnabled: true, defaultCollectionId: null },
  });

  useEffect(() => {
    if (settings) {
      profileForm.reset({ displayName: settings.displayName || "" });
      prefsForm.reset({ 
        notificationsEnabled: settings.notificationsEnabled,
        defaultCollectionId: settings.defaultCollectionId ? settings.defaultCollectionId.toString() : null
      });
    }
  }, [settings, profileForm, prefsForm]);

  const onProfileSubmit = (values: z.infer<typeof profileFormSchema>) => {
    updateSettings.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Profile updated" });
        queryClient.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      }
    });
  };

  const onPrefsSubmit = (values: z.infer<typeof prefsFormSchema>) => {
    const payload = {
      notificationsEnabled: values.notificationsEnabled,
      defaultCollectionId: values.defaultCollectionId && values.defaultCollectionId !== "none" ? parseInt(values.defaultCollectionId, 10) : null
    };
    updateSettings.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "Preferences saved" });
        queryClient.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-8">
        <Skeleton className="h-10 w-48 mb-8" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and app preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-2">
          <div className="flex items-center gap-3 p-4 bg-card border border-card-border rounded-xl">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback>{user?.firstName?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <Badge variant="secondary" className="mt-1 text-[10px] uppercase">
                {settings?.role}
              </Badge>
            </div>
          </div>
          <div className="text-sm text-muted-foreground p-4">
            Your account is managed via Replit authentication.
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-serif">
                <User className="w-5 h-5" /> Profile
              </CardTitle>
              <CardDescription>Update how you appear to other collaborators.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                  <FormField
                    control={profileForm.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>This name will appear on notes you edit.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={updateSettings.isPending}>Save Profile</Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-serif">
                <SettingsIcon className="w-5 h-5" /> Preferences
              </CardTitle>
              <CardDescription>Customize your workspace experience.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...prefsForm}>
                <form onSubmit={prefsForm.handleSubmit(onPrefsSubmit)} className="space-y-6">
                  
                  <FormField
                    control={prefsForm.control}
                    name="notificationsEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/50 p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base flex items-center gap-2">
                            <Bell className="w-4 h-4 text-muted-foreground" />
                            Email Notifications
                          </FormLabel>
                          <FormDescription>
                            Receive emails when someone shares a collection with you.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={prefsForm.control}
                    name="defaultCollectionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Library className="w-4 h-4 text-muted-foreground" />
                          Default Collection
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "none"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a collection" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None (Dashboard)</SelectItem>
                            {collections?.map(c => (
                              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          New notes created from the dashboard will default to this collection.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={updateSettings.isPending}>Save Preferences</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

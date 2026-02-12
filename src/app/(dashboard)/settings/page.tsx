"use client";

import { Link as LinkIcon, Zap, User, History, Bell } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLog } from "@/components/audit/audit-log";
import { NotificationPreferences } from "@/components/settings/notification-preferences";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1">
            <History className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Account
                </CardTitle>
                <CardDescription>
                  Manage your profile and subscription
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Manage Account
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  Connected Channels
                </CardTitle>
                <CardDescription>
                  Connect your marketplace accounts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>eBay</span>
                  <Button size="sm">Connect</Button>
                </div>
                <div className="flex items-center justify-between">
                  <span>Poshmark</span>
                  <Button size="sm" variant="outline" disabled>
                    Assisted
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span>Mercari</span>
                  <Button size="sm" variant="outline" disabled>
                    Assisted
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Autopilot Settings
                </CardTitle>
                <CardDescription>
                  Configure automation rules for offers, repricing, and more
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/settings/autopilot">
                  <Button variant="outline" className="w-full">
                    Configure Autopilot
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationPreferences />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}

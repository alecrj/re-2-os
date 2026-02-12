"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UserProfile() {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  const { name, email } = session.user;

  return (
    <div className="border-t p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          {name && (
            <p className="text-sm font-medium truncate">{name}</p>
          )}
          {email && (
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 w-full justify-start text-muted-foreground"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}

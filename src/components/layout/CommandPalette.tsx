import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useVertical } from "@/lib/VerticalContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { config } = useVertical();

  function go(to: string) {
    onOpenChange(false);
    navigate(to);
  }

  const navItems = config.navigation.flatMap((g) => g.items);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a page or action…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.to}
                value={item.label}
                onSelect={() => go(item.to)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick actions">
          <CommandItem value="new agent" onSelect={() => go("/agents")}>
            <span className="mr-2">+</span>
            New agent
          </CommandItem>
          <CommandItem value="new campaign" onSelect={() => go("/campaigns/new")}>
            <span className="mr-2">+</span>
            New campaign
          </CommandItem>
          <CommandItem value="add knowledge" onSelect={() => go("/knowledge")}>
            <span className="mr-2">+</span>
            Add knowledge source
          </CommandItem>
          <CommandItem value="get phone number" onSelect={() => go("/numbers")}>
            <span className="mr-2">+</span>
            Get a phone number
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          <CommandItem value="settings" onSelect={() => go("/settings")}>
            <span className="mr-2 text-muted-foreground">⚙</span>
            Organization settings
          </CommandItem>
          <CommandItem value="billing" onSelect={() => go("/billing")}>
            <span className="mr-2 text-muted-foreground">$</span>
            Billing & usage
          </CommandItem>
          <CommandItem value="integrations" onSelect={() => go("/integrations")}>
            <span className="mr-2 text-muted-foreground">⚡</span>
            Integrations
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

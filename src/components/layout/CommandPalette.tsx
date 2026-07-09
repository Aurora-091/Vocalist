import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
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
import { listContacts, listAgents } from "@/lib/db";
import { Phone, Bot, User } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Contact = { id: string; name: string | null; e164: string };
type Agent = { id: string; name: string };

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { config } = useVertical();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    if (!open) {
      setContacts([]);
      setQuery("");
      return;
    }
    listAgents()
      .then((a) => setAgents(a.slice(0, 8).map((r: any) => ({ id: r.id, name: r.name }))))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setContacts([]);
      return;
    }
    listContacts({ q: debouncedQuery, limit: 6 })
      .then((rows) =>
        setContacts(rows.map((r: any) => ({ id: r.id, name: r.name, e164: r.e164 })))
      )
      .catch(() => {});
  }, [debouncedQuery]);

  function handleValueChange(v: string) {
    setQuery(v);
  }

  function go(to: string) {
    onOpenChange(false);
    navigate(to);
  }

  const navItems = config.navigation.flatMap((g) => g.items);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search contacts, agents, or jump to a page..."
        value={query}
        onValueChange={handleValueChange}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {contacts.length > 0 && (
          <>
            <CommandGroup heading="Contacts">
              {contacts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`contact ${c.name || ""} ${c.e164}`}
                  onSelect={() => go(`/contacts`)}
                >
                  <User className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{c.name || "Unnamed"}</span>
                  <span className="text-xs text-muted-foreground font-mono">{c.e164}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {agents.length > 0 && (
          <>
            <CommandGroup heading="Agents">
              {agents.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`agent ${a.name}`}
                  onSelect={() => go(`/agents/${a.id}`)}
                >
                  <Bot className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{a.name}</span>
                  <span className="text-xs text-muted-foreground">Open</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

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
            <Phone className="mr-2 h-4 w-4" />
            Get a phone number
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          <CommandItem value="settings" onSelect={() => go("/settings")}>
            Organization settings
          </CommandItem>
          <CommandItem value="billing" onSelect={() => go("/billing")}>
            Billing & usage
          </CommandItem>
          <CommandItem value="integrations" onSelect={() => go("/integrations")}>
            Integrations
          </CommandItem>
          <CommandItem value="playbooks" onSelect={() => go("/integrations/playbooks")}>
            Playbooks
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

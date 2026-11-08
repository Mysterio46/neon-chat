import { CheckIcon, ChevronDownIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NEON_MODELS, getNeonModel, type NeonModelId } from "@/lib/neon-models";
import { cn } from "@/lib/utils";

export function ModelPicker({
  value,
  onChange,
  disabled,
}: {
  value: NeonModelId;
  onChange: (id: NeonModelId) => void;
  disabled?: boolean;
}) {
  const current = getNeonModel(value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={`Model: ${current.label}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[15px] font-medium text-composer-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 data-[state=open]:bg-accent"
      >
        {current.label}
        <ChevronDownIcon className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-72 rounded-2xl p-2">
        <DropdownMenuLabel className="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Choose a Neon model
        </DropdownMenuLabel>
        {NEON_MODELS.map((m) => {
          const active = m.id === value;
          return (
            <DropdownMenuItem
              key={m.id}
              onSelect={() => onChange(m.id)}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5", active && "bg-accent")}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.tagline}</span>
              </div>
              {active ? <CheckIcon className="size-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

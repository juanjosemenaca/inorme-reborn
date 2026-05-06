import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type SearchableSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SearchableSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  /** Texto con valor vacío */
  placeholder?: string;
  /** Placeholder del campo de búsqueda */
  searchPlaceholder?: string;
  /** Mensaje cuando no hay coincidencias */
  emptyText?: string;
  disabled?: boolean;
  /** Clases del botón disparador (mismo estilo base que SelectTrigger) */
  className?: string;
  contentClassName?: string;
  /** Si es false, no se muestra la caja de búsqueda (listas muy cortas) */
  searchable?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export const SearchableSelect = React.forwardRef<HTMLButtonElement, SearchableSelectProps>(
  function SearchableSelect(
    {
      value,
      onValueChange,
      options,
      placeholder = "Seleccionar\u2026",
      searchPlaceholder = "Buscar\u2026",
      emptyText = "Sin coincidencias.",
      disabled,
      className,
      contentClassName,
      searchable = true,
      id,
      "aria-invalid": ariaInvalid,
      "aria-describedby": ariaDescribedBy,
    },
    ref
  ) {
    const [open, setOpen] = React.useState(false);
    const [cmdKey, setCmdKey] = React.useState(0);
    const [panelWidth, setPanelWidth] = React.useState<number>();
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLButtonElement | null) => {
        triggerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      },
      [ref]
    );

    const selected = options.find((o) => o.value === value);

    const handleOpenChange = (next: boolean) => {
      setOpen(next);
      if (next) {
        setCmdKey((k) => k + 1);
        queueMicrotask(() => {
          const el = triggerRef.current;
          if (el) setPanelWidth(el.offsetWidth);
        });
      }
    };

    return (
      <Popover open={open} onOpenChange={handleOpenChange} modal>
        <PopoverTrigger asChild>
          <Button
            ref={setRefs}
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-between px-3 py-2 font-normal ring-offset-background",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              !selected && "text-muted-foreground",
              className
            )}
          >
            <span className="truncate text-left">{selected ? selected.label : placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn("p-0", contentClassName)}
          style={{
            width: panelWidth ? Math.max(panelWidth, 200) : undefined,
            minWidth: panelWidth ? undefined : 220,
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command key={cmdKey} shouldFilter={searchable}>
            {searchable && <CommandInput placeholder={searchPlaceholder} />}
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    keywords={[opt.label]}
                    disabled={opt.disabled}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4 shrink-0", value === opt.value ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
);

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PasswordInputWithToggleProps = Omit<React.ComponentProps<typeof Input>, "type">;

/**
 * Campo contraseña con botón para mostrar/ocultar lo escrito (útil en login y formularios admin).
 */
const PasswordInputWithToggle = React.forwardRef<HTMLInputElement, PasswordInputWithToggleProps>(
  ({ className, ...props }, ref) => {
    const [show, setShow] = React.useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={show ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground sm:h-10 sm:w-10"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={show}
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </Button>
      </div>
    );
  }
);
PasswordInputWithToggle.displayName = "PasswordInputWithToggle";

export { PasswordInputWithToggle };

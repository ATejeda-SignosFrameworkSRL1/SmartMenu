import { Loader2, type LucideProps } from "lucide-react";

import { cn } from "../lib/cn";

function Spinner({ className, ...props }: LucideProps) {
  return (
    <Loader2
      role="status"
      aria-label="Cargando"
      className={cn("h-4 w-4 animate-spin text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Spinner };

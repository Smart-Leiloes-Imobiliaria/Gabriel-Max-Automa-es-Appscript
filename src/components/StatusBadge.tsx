import { cn } from "@/lib/utils";
import type { DeadlineStatus } from "@/lib/db";

const map: Record<DeadlineStatus, string> = {
  "Dentro do prazo": "bg-success/10 text-success border-success/20",
  "Escalonado": "bg-warning/10 text-warning border-warning/30",
  "Atrasado Escalonado": "bg-escalated/10 text-escalated border-escalated/30",
};

export function DeadlineBadge({ status }: { status: DeadlineStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", map[status])}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function ScheduleStatusBadge({ status }: { status: string }) {
  const tone =
    status === "Videoconferência agendada" ? "bg-info/10 text-info border-info/20"
    : status === "Realizada" || status === "Concluída" ? "bg-success/10 text-success border-success/20"
    : status === "Cancelada" ? "bg-destructive/10 text-destructive border-destructive/20"
    : status === "Aguardando confirmação" ? "bg-warning/10 text-warning border-warning/30"
    : "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", tone)}>
      {status}
    </span>
  );
}

import { GraduationCap } from "lucide-react";

export default function Brand({ large = false }: { large?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={
          large
            ? "flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            : "flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
        }
      >
        <GraduationCap className={large ? "size-6" : "size-5"} aria-hidden />
      </span>
      <span
        className={`font-heading font-semibold ${large ? "text-2xl" : "text-lg"}`}
      >
        Ujianku
      </span>
    </span>
  );
}

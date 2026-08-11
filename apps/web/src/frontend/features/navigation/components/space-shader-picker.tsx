import { cn } from "@/lib/utils";
import { SpacePic } from "@features/navigation/components/space-pic";
import {
  SPACE_SHADERS,
  type SpaceShaderId,
} from "@features/navigation/lib/space-shaders";

export function SpaceShaderPicker({
  value,
  onChange,
  className,
}: {
  value: SpaceShaderId;
  onChange: (id: SpaceShaderId) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-6 gap-1.5", className)}>
      {SPACE_SHADERS.map((preset) => {
        const selected = preset.id === value;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            aria-label={preset.label}
            aria-pressed={selected}
            className={cn(
              "rounded-md p-0.5 transition-colors",
              selected
                ? "bg-muted ring-1 ring-foreground/20"
                : "hover:bg-muted/60",
            )}
          >
            <SpacePic shaderId={preset.id} size="sm" className="size-7" />
          </button>
        );
      })}
    </div>
  );
}

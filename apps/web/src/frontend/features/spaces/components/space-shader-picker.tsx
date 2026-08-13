import { cn } from "@/lib/utils";
import { SpacePic } from "@features/spaces/components/space-pic";
import {
  SPACE_SHADERS,
  type SpaceShaderId,
} from "@features/spaces/lib/space-shaders";

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
    <div className={cn("flex flex-wrap gap-1.5 p-0.5", className)}>
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
              "size-7 rounded-sm",
              selected && "ring-2 ring-foreground/40",
            )}
          >
            <SpacePic
              shaderId={preset.id}
              size="sm"
              className="size-7 hover:opacity-90"
            />
          </button>
        );
      })}
    </div>
  );
}

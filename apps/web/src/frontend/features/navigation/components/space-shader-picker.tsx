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
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-xs text-muted-foreground">Space pic</p>
      <div className="grid grid-cols-4 gap-2">
        {SPACE_SHADERS.map((preset) => {
          const selected = preset.id === value;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md p-1.5 text-left transition-colors",
                selected
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
              aria-pressed={selected}
            >
              <SpacePic shaderId={preset.id} size="md" className="size-10" />
              <span className="w-full truncate text-center text-[10px] leading-none">
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

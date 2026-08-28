import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

export const spinnerVariants = cva("relative", {
  defaultVariants: { size: "md" },
  variants: {
    size: {
      lg: "size-24 [stroke-width:1.5px]",
      md: "size-12 [stroke-width:1.25px]",
      sm: "size-8 [stroke-width:1px]",
    },
  },
})

const ORBITS = [
  {
    angle: 30,
    entrance:
      "animate-[spinner-orbit-in_0.3s_ease-out_0.1s_both] motion-reduce:animate-[spinner-orbit-pulse_2.4s_ease-in-out_infinite]",
    tilt: "[transform:rotate(30deg)_rotateX(63.187deg)]",
  },
  {
    angle: 90,
    entrance:
      "animate-[spinner-orbit-in_0.3s_ease-out_0.2s_both] motion-reduce:animate-[spinner-orbit-pulse_2.4s_ease-in-out_-0.8s_infinite]",
    tilt: "[transform:rotate(90deg)_rotateX(63.187deg)]",
  },
  {
    angle: -30,
    entrance:
      "animate-[spinner-orbit-in_0.3s_ease-out_0.3s_both] motion-reduce:animate-[spinner-orbit-pulse_2.4s_ease-in-out_-1.6s_infinite]",
    tilt: "[transform:rotate(-30deg)_rotateX(63.187deg)]",
  },
] as const

const ATOM_TURN =
  "absolute inset-0 [transform-style:preserve-3d] animate-[spinner-atom-turn_8s_linear_infinite] motion-reduce:animate-none"

function Spinner({
  className,
  label = "Loading",
  size = "md",
}: {
  className?: string
  label?: string | null
  size?: VariantProps<typeof spinnerVariants>["size"]
}) {
  const decorative = label === null

  return (
    <span
      aria-hidden={decorative || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-muted-foreground",
        className,
      )}
      role={decorative ? undefined : "status"}
    >
      <span aria-hidden="true" className={spinnerVariants({ size })}>
        <svg className="absolute inset-0 size-full" viewBox="0 0 76 76">
          <circle
            cx="38"
            cy="38"
            fill="none"
            r="36.85"
            stroke="currentColor"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx="38"
            cy="38"
            fill="none"
            r="2.3"
            stroke="currentColor"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className={ATOM_TURN}>
          {ORBITS.map((orbit) => (
            <span
              className={cn("absolute inset-0 opacity-35", orbit.tilt, orbit.entrance)}
              key={orbit.angle}
            >
              <svg className="size-full" viewBox="0 0 76 76">
                <circle
                  cx="38"
                  cy="38"
                  fill="none"
                  r="36.8"
                  stroke="currentColor"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </span>
          ))}
        </span>
      </span>
      {decorative ? null : <span className="sr-only">{label}</span>}
    </span>
  )
}

export { Spinner }

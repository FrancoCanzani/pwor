import { Hashvatar } from "hashvatar/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const sizeMap = {
  xs: 16,
  sm: 24,
  default: 32,
  lg: 40,
} as const;

export function UserAvatar({
  name,
  email,
  image,
  size = "default",
  className,
}: {
  name: string;
  email: string;
  image?: string | null;
  size?: keyof typeof sizeMap;
  className?: string;
}) {
  const label = name.trim() || email;
  const hash = email.trim() || name.trim() || "odiseum";
  const px = sizeMap[size];
  const avatarSize = size === "xs" ? "sm" : size;

  return (
    <Avatar
      size={avatarSize}
      className={cn("rounded-none", size === "xs" && "!size-4", className)}
    >
      {image ? <AvatarImage src={image} alt={label} /> : null}
      <AvatarFallback className="rounded-none overflow-hidden p-0">
        <Hashvatar
          hash={hash}
          size={px}
          className="!rounded-none"
          style={{ borderRadius: 0, width: "100%", height: "100%" }}
        />
      </AvatarFallback>
    </Avatar>
  );
}

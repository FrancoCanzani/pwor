import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { sessionQueryOptions } from "@lib/session";

export function SiteAuthButton({
  size = "sm",
  variant = "secondary",
}: {
  size?: "sm" | "lg";
  variant?: "secondary" | "default";
}) {
  const { data: session } = useQuery(sessionQueryOptions);

  if (session) {
    return (
      <Button size={size} variant={variant} render={<Link to="/inbox" />}>
        Go to app
      </Button>
    );
  }

  return (
    <Button size={size} variant={variant} render={<Link to="/login" />}>
      Sign in
    </Button>
  );
}

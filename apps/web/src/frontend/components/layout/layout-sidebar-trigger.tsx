import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

export function LayoutSidebarTrigger({
  className,
}: {
  className?: string;
}) {
  const { isMobile, state } = useSidebar();
  if (!isMobile && state !== "collapsed") return null;
  return <SidebarTrigger className={className} />;
}

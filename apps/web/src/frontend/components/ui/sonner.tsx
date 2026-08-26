import {
  CheckCircledIcon,
  Cross2Icon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
  InfoCircledIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";
import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      closeButton
      icons={{
        success: <CheckCircledIcon className="size-3.5" />,
        info: <InfoCircledIcon className="size-3.5" />,
        warning: <ExclamationTriangleIcon className="size-3.5" />,
        error: <CrossCircledIcon className="size-3.5" />,
        loading: <UpdateIcon className="size-3.5 animate-spin" />,
        close: <Cross2Icon className="size-3" />,
      }}
      style={
        {
          "--width": "fit-content",
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "0.5rem",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast !w-fit !max-w-sm !px-3 !py-2 !gap-2 !shadow-[0_1px_2px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]",
          title: "text-xs font-normal",
          description: "text-xs",
          icon: "size-3.5",
          closeButton:
            "!static !inset-auto !size-4 !translate-none !transform-none !rounded-sm !border-0 !bg-transparent text-muted-foreground ml-auto",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

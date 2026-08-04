import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { uploadVaultItem } from "@features/vault/api";

export function VaultUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const queryClient = useQueryClient();
  const { workspaceId } = useParams({ from: "/_app/$workspaceId" });

  async function handleChange(files: FileList | null) {
    if (!files || files.length === 0 || pending) return;

    const list = Array.from(files);
    setPending(true);

    try {
      await Promise.all(
        list.map(async (file) => {
          const toastId = toast.loading(`Uploading ${file.name}…`);
          try {
            await uploadVaultItem(file, workspaceId);
            toast.success(`${file.name} added to Vault`, { id: toastId });
          } catch {
            toast.error(`Failed to upload ${file.name}`, { id: toastId });
          }
        }),
      );
      await queryClient.invalidateQueries({
        queryKey: ["vault", "items"],
      });
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void handleChange(e.target.files)}
      />
      <Button
        type="button"
        variant="new"
        className="w-full"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        Upload
      </Button>
    </>
  );
}

import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { workspacesQueryOptions } from "@features/workspaces/api";

import { ProfileStep } from "./profile-step";
import { WorkspaceStep } from "./workspace-step";

const routeApi = getRouteApi("/_app/onboarding/");

export function OnboardingPage() {
  const { user } = routeApi.useRouteContext();
  const navigate = useNavigate();
  const { data: workspaces } = useQuery(workspacesQueryOptions);
  const [step, setStep] = useState<"profile" | "workspace">(
    user.name.trim() ? "workspace" : "profile",
  );

  async function handleProfileDone() {
    if ((workspaces?.length ?? 0) > 0) {
      await navigate({ to: "/" });
    } else {
      setStep("workspace");
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-6">
      <div className="w-full max-w-[320px]">
        <h1 className="mb-1.5 font-pixel text-lg font-normal tracking-tight leading-tight">
          Pwor
        </h1>
        <p className="mb-6 text-xs leading-normal text-muted-foreground">
          {step === "profile"
            ? "Tell us your name. Avatar is optional."
            : "Give your first space a name — Work, Life, whatever fits."}
        </p>

        {step === "workspace" ? (
          <WorkspaceStep />
        ) : (
          <ProfileStep
            defaultName={user.name.trim() || ""}
            onDone={() => void handleProfileDone()}
          />
        )}
      </div>
    </main>
  );
}

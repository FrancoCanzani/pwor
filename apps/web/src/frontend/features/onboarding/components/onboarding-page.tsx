import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { spacesQueryOptions } from "@features/spaces/api";

import { ProfileStep } from "./profile-step";
import { SpaceStep } from "./space-step";

const routeApi = getRouteApi("/_app/onboarding/");

export function OnboardingPage() {
  const { user } = routeApi.useRouteContext();
  const navigate = useNavigate();
  const { data: spaces } = useQuery(spacesQueryOptions);
  const [step, setStep] = useState<"profile" | "space">(
    user.name.trim() ? "space" : "profile",
  );

  async function handleProfileDone() {
    if ((spaces?.length ?? 0) > 0) {
      await navigate({ to: "/inbox" });
    } else {
      setStep("space");
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-safe-5 py-safe-6">
      <div className="w-full max-w-[320px]">
        <h1 className="mb-1.5 text-lg font-normal tracking-tight leading-tight">
          Pwor
        </h1>
        <p className="mb-6 text-xs leading-normal text-muted-foreground">
          {step === "profile"
            ? "Tell us your name. Avatar is optional."
            : "Give your first space a name — Work, Life, whatever fits."}
        </p>

        {step === "space" ? (
          <SpaceStep />
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

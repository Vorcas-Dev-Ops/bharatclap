import { redirect } from "next/navigation";

export default function OnboardingKycRedirect() {
  redirect("/provider/onboarding?step=5");
}

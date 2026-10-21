import { redirect } from "next/navigation";

export default function OnboardingServicesRedirect() {
  redirect("/provider/onboarding?step=2");
}

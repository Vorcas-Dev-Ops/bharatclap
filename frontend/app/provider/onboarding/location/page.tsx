import { redirect } from "next/navigation";

export default function OnboardingLocationRedirect() {
  redirect("/provider/onboarding?step=3");
}

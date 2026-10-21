import { redirect } from "next/navigation";

export default function OnboardingReviewRedirect() {
  redirect("/provider/onboarding?step=6");
}

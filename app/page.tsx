import type { Metadata } from "next";
import { BentoApp } from "./bento-app";
import { loadPlannerData } from "@/lib/planner-data";

export const metadata: Metadata = {
  title: "Bento — A happier week, one meal at a time",
  description:
    "Plan breakfast, snacks, and lunch with simple food building blocks and gentle variety guidance.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const { foods, plans } = await loadPlannerData();
  return <BentoApp initialFoods={foods} initialPlans={plans} />;
}

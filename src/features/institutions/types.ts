export type Institution = {
  id: string;
  slug: string;
  name: string;
  initial: string;
  color_token: "rf" | "ac" | "fi" | "intl" | "cr" | "fu" | "cx";
};
export type ResearchRequest = {
  id: string;
  requested_name: string;
  status: "queued" | "reviewing" | "promoted" | "rejected";
};

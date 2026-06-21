export const planCatalog = {
  free: {
    label: "Free",
    calls: 10,
    agents: 1,
    price: "0",
    description: "Perfect for testing your first AI voice agent.",
    features: ["1 AI agent", "10 calls / month", "Text knowledge base", "Post-call summaries", "Shared platform number"],
  },
  pro: {
    label: "Pro",
    calls: 200,
    agents: 3,
    price: "3999",
    description: "For growing teams running regular outbound campaigns.",
    features: [
      "3 AI agents",
      "200 calls / month",
      "PDF & URL knowledge",
      "Lead scoring & outcomes",
      "Priority support",
    ],
    popular: true,
  },
  enterprise: {
    label: "Enterprise",
    calls: 500,
    agents: 5,
    price: "8999",
    description: "Higher volume for teams running daily outbound campaigns.",
    features: [
      "5 AI agents",
      "500 calls / month",
      "Full analytics suite",
      "Admin usage dashboard",
      "Dedicated onboarding",
    ],
  },
} as const;

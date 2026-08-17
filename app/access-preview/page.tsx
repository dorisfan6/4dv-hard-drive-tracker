import { AccessAdmin } from "../AccessAdmin";

const sampleRequests = [
  {
    email: "maya.chen@4dv.ai",
    displayName: "Maya Chen",
    note: "Post-production team — managing transfers and final archive handoff.",
    status: "pending" as const,
    requestedAt: "2026-08-17 10:42:00",
    reviewedAt: "",
    reviewedBy: "",
  },
  {
    email: "noah.kim@4dv.ai",
    displayName: "Noah Kim",
    note: "Needs read and update access for the data center inventory.",
    status: "pending" as const,
    requestedAt: "2026-08-17 09:18:00",
    reviewedAt: "",
    reviewedBy: "",
  },
  {
    email: "lena@4dv.ai",
    displayName: "Lena Ortiz",
    note: "Studio operations.",
    status: "approved" as const,
    requestedAt: "2026-08-14 15:02:00",
    reviewedAt: "2026-08-14 15:30:00",
    reviewedBy: "yinuofan@4dv.ai",
  },
];

export default function AccessPreviewPage() {
  return (
    <AccessAdmin
      owner={{ email: "yinuofan@4dv.ai", displayName: "Yinuo Fan" }}
      initialRequests={sampleRequests}
      signOutPath="/"
      preview
    />
  );
}

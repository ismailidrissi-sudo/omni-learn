import { Plus_Jakarta_Sans } from "next/font/google";

const trainerFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-trainer",
  display: "swap",
});

export default function TrainerSegmentLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${trainerFont.variable} min-h-screen bg-[#FAFAF8]`}>{children}</div>;
}

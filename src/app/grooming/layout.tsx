import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dog Grooming – Paw & Co",
  description: "Book a bath, full groom, or nail trim for your dog.",
};

export default function GroomingLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}

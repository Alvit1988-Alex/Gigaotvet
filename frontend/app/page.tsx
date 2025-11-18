import dynamic from "next/dynamic";

const AppShell = dynamic(() => import("../src/components/layout/AppShell"), { ssr: false });

export default function HomePage() {
  return <AppShell />;
}

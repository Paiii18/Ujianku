import type { GetServerSideProps } from "next";

// Belum ada landing page: arahkan ke login. Proxy (F1.6) yang membawa user login ke dashboardnya.
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/login", permanent: false },
});

export default function Home() {
  return null;
}

import AppShell from "@/components/layout/AppShell";
import EmptyDashboard from "@/components/layout/EmptyDashboard";
import SubscriptionCard from "@/components/school/SubscriptionCard";
import { requireRole, type ShellProps } from "@/lib/requireRole";
import { renewWhatsAppLink } from "@/lib/whatsapp";

type Props = ShellProps & {
  subscription: {
    activeUntil: string;
    daysLeft: number;
    whatsappHref: string | null;
  } | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const getServerSideProps = requireRole(
  "school_admin",
  async (_ctx, supabase) => {
    const { data: school } = await supabase.rpc("my_school").maybeSingle();
    if (!school?.active_until) return { subscription: null };
    return {
      subscription: {
        activeUntil: school.active_until,
        daysLeft: Math.floor(
          (new Date(school.active_until).getTime() - Date.now()) / DAY_MS,
        ),
        whatsappHref: renewWhatsAppLink(school),
      },
    };
  },
);

export default function SchoolDashboard({ user, subscription }: Props) {
  return (
    <AppShell user={user} title="Dashboard">
      <div className="flex flex-col gap-4">
        <EmptyDashboard
          name={user.fullName}
          text="Ringkasan kelas, guru, murid, dan ujian akan tampil di sini."
        />
        {subscription && <SubscriptionCard {...subscription} />}
      </div>
    </AppShell>
  );
}

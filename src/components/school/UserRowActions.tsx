import { useRouter } from "next/router";
import { toast } from "sonner";
import ConfirmAction from "@/components/admin/ConfirmAction";
import EditUserDialog, {
  type ManagedUser,
} from "@/components/school/EditUserDialog";
import ResetPasswordDialog from "@/components/school/ResetPasswordDialog";
import { callApi } from "@/lib/api";
import type { ManagedRole } from "@/lib/schoolUser";

// Tombol aksi per baris tabel guru/murid: ubah, reset password, nonaktifkan/aktifkan.
export default function UserRowActions({
  role,
  user,
}: {
  role: ManagedRole;
  user: ManagedUser;
}) {
  const router = useRouter();

  async function setActive(isActive: boolean) {
    const body = await callApi(`/api/school/users/${user.id}`, "PATCH", {
      action: "active",
      isActive,
    });
    if ("error" in body) {
      toast.error(body.error);
      return;
    }
    toast.success(
      `${user.fullName} ${isActive ? "diaktifkan" : "dinonaktifkan"}`,
    );
    await router.replace(router.asPath);
  }

  return (
    <div className="flex justify-end gap-2">
      <EditUserDialog role={role} user={user} />
      <ResetPasswordDialog userId={user.id} fullName={user.fullName} />
      {user.isActive ? (
        <ConfirmAction
          label="Nonaktifkan"
          variant="destructive"
          title={`Nonaktifkan ${user.fullName}?`}
          description="Akun tidak bisa login dan langsung keluar dari aplikasi. Data tetap tersimpan dan akun bisa diaktifkan kembali."
          confirmLabel="Nonaktifkan"
          onConfirm={() => setActive(false)}
        />
      ) : (
        <ConfirmAction
          label="Aktifkan"
          variant="outline"
          title={`Aktifkan ${user.fullName}?`}
          description="Akun bisa login kembali dengan password terakhirnya."
          confirmLabel="Aktifkan"
          onConfirm={() => setActive(true)}
        />
      )}
    </div>
  );
}

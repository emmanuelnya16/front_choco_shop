import { AdminAuthGuard } from '@/features/admin/auth/AdminAuthGuard';
import { AdminLayout } from '@/features/admin/layout/AdminLayout';

export default function AdminRootShell() {
  return (
    <AdminAuthGuard>
      <AdminLayout />
    </AdminAuthGuard>
  );
}


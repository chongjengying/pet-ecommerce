"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminFilterBar from "@/components/admin/ui/AdminFilterBar";
import AdminModal from "@/components/admin/ui/AdminModal";
import AdminStatCard from "@/components/admin/ui/AdminStatCard";
import AdminTable from "@/components/admin/ui/AdminTable";
import { useAdminToast } from "@/components/admin/ui/AdminToast";
import { formatDateTimeKualaLumpur } from "@/lib/dateTime";

type UserRow = {
  id: string;
  email: string;
  username: string;
  role: "admin" | "customer";
  status: "active" | "inactive" | "suspended" | "deleted";
  created_at: string | null;
  updated_at: string | null;
};

const STATUSES: UserRow["status"][] = ["active", "inactive", "suspended", "deleted"];
const ROLES: UserRow["role"][] = ["customer", "admin"];

function prettyDate(value: string | null): string {
  return formatDateTimeKualaLumpur(value);
}

export default function AdminUsersManager() {
  const { pushToast } = useAdminToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | UserRow["status"]>("all");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRow["role"]>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const [creating, setCreating] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRow["role"]>("customer");
  const [newStatus, setNewStatus] = useState<UserRow["status"]>("active");

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as { users?: UserRow[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load users.");
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter !== "all" && user.status !== statusFilter) return false;
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (!q) return true;
      return user.email.toLowerCase().includes(q) || user.username.toLowerCase().includes(q);
    });
  }, [users, query, roleFilter, statusFilter]);

  const createUser = async () => {
    if (!newEmail.trim() || !newUsername.trim() || !newPassword.trim()) {
      pushToast("error", "Email, username, and password are required.");
      return;
    }
    try {
      setCreating(true);
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
          status: newStatus,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { users?: UserRow[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Failed to create user.");
      setUsers(Array.isArray(data.users) ? data.users : []);
      setNewEmail("");
      setNewUsername("");
      setNewPassword("");
      setNewRole("customer");
      setNewStatus("active");
      pushToast("success", "User created.");
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  };

  const updateUser = async (id: string, changes: Partial<UserRow>) => {
    try {
      setSavingId(id);
      const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Failed to update user.");
      setUsers((prev) =>
        prev.map((user) =>
          user.id === id
            ? {
                ...user,
                ...changes,
              }
            : user
        )
      );
      pushToast("success", "User updated.");
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : String(error));
    } finally {
      setSavingId(null);
    }
  };

  const softDelete = async () => {
    if (!deletingUser) return;
    try {
      setSavingId(deletingUser.id);
      const response = await fetch(`/api/admin/users/${encodeURIComponent(deletingUser.id)}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Failed to delete user.");
      setUsers((prev) => prev.map((user) => (user.id === deletingUser.id ? { ...user, status: "deleted" } : user)));
      pushToast("success", "User soft-deleted.");
      setDeletingUser(null);
    } catch (error) {
      pushToast("error", error instanceof Error ? error.message : String(error));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard label="Total Users" value={users.length} />
        <AdminStatCard label="Active" value={users.filter((user) => user.status === "active").length} />
        <AdminStatCard label="Suspended" value={users.filter((user) => user.status === "suspended").length} />
        <AdminStatCard label="Deleted" value={users.filter((user) => user.status === "deleted").length} />
      </section>

      <AdminFilterBar>
        <label className="relative w-full max-w-xl">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by email or username"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-400/80 focus:bg-white"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "all" | UserRow["status"])}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700"
        >
          <option value="all">All status</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as "all" | UserRow["role"])}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700"
        >
          <option value="all">All roles</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </AdminFilterBar>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.55)]">
        <h3 className="text-sm font-semibold text-slate-900">Create User</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <input
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="Email"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
          />
          <input
            value={newUsername}
            onChange={(event) => setNewUsername(event.target.value)}
            placeholder="Username"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
          />
          <input
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Password"
            type="password"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
          />
          <select
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as UserRow["role"])}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={newStatus}
              onChange={(event) => setNewStatus(event.target.value as UserRow["status"])}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void createUser()}
              disabled={creating}
              className="rounded-xl bg-gradient-to-b from-cyan-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </section>

      <AdminTable
        columns={["User", "Role", "Status", "Created", "Actions"]}
        loading={loading}
        isEmpty={!loading && filteredUsers.length === 0}
        emptyState={<p className="text-sm text-slate-500">No users found.</p>}
        minWidthClassName="min-w-[860px]"
      >
        {filteredUsers.map((user) => (
          <tr key={user.id} className="border-b border-slate-100">
            <td className="px-4 py-3">
              <p className="text-sm font-medium text-slate-900">{user.email}</p>
              <p className="text-xs text-slate-500">@{user.username || "-"}</p>
            </td>
            <td className="px-4 py-3">
              <select
                value={user.role}
                onChange={(event) => void updateUser(user.id, { role: event.target.value as UserRow["role"] })}
                disabled={savingId === user.id}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase text-slate-700"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </td>
            <td className="px-4 py-3">
              <select
                value={user.status}
                onChange={(event) => void updateUser(user.id, { status: event.target.value as UserRow["status"] })}
                disabled={savingId === user.id}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase text-slate-700"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </td>
            <td className="px-4 py-3 text-sm text-slate-600">{prettyDate(user.created_at)}</td>
            <td className="px-4 py-3">
              <button
                type="button"
                onClick={() => setDeletingUser(user)}
                disabled={savingId === user.id || user.status === "deleted"}
                className="rounded-lg px-2 py-1 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                Soft delete
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>

      <AdminModal
        open={Boolean(deletingUser)}
        title="Soft Delete User?"
        description={deletingUser ? `Set ${deletingUser.email} to deleted status?` : undefined}
        confirmLabel="Delete"
        destructive
        loading={Boolean(savingId)}
        onCancel={() => {
          if (savingId) return;
          setDeletingUser(null);
        }}
        onConfirm={() => void softDelete()}
      />
    </div>
  );
}

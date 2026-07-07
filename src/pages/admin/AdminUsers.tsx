import { useEffect, useState, useCallback } from "react";
import { Search } from "lucide-react";
import { adminApi, type AdminUser, type PaginatedResult } from "../../lib/admin-api";
import { api } from "../../lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function AdminUsers() {
  const [result, setResult] = useState<PaginatedResult<AdminUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<any>(null);
  const [_detailLoading, _setDetailLoading] = useState(false);

  const [showPlanSelect, setShowPlanSelect] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("starter");
  const [planLoading, setPlanLoading] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [suspendLoading, setSuspendLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers({ page, q });
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [page, q]);

  useEffect(() => { load(); }, [load]);

  async function viewUser(id: string) {
    _setDetailLoading(true);
    try {
      const data = await adminApi.getUserDetail(id);
      setDetail(data);
      setSelectedPlan(data.orgs?.plan_id || "starter");
      setShowPlanSelect(false);
    } finally {
      _setDetailLoading(false);
    }
  }

  async function handleChangePlan() {
    setPlanLoading(true);
    try {
      await adminApi.updateUser(detail.id, { plan_id: selectedPlan });
      toast.success("Plan updated");
      setDetail((prev: any) => ({
        ...prev,
        orgs: prev.orgs ? { ...prev.orgs, plan_id: selectedPlan } : { name: "---", plan_id: selectedPlan }
      }));
      setShowPlanSelect(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update plan");
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleResetPassword() {
    setPasswordResetLoading(true);
    try {
      await api.post(`/v1/admin/users/${detail.id}/reset-password`);
      toast.success("Password reset email sent");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    } finally {
      setPasswordResetLoading(false);
    }
  }

  async function handleSuspendAccount() {
    setSuspendLoading(true);
    try {
      await adminApi.updateUser(detail.id, { suspended: true });
      toast.success("Account suspended");
    } catch (err: any) {
      toast.error(err.message || "Failed to suspend account");
    } finally {
      setSuspendLoading(false);
    }
  }

  const totalPages = result ? Math.ceil(result.total / result.limit) : 1;

  if (detail) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setDetail(null)}>Back</Button>
          <h1 className="text-2xl font-semibold">{detail.display_name || detail.email}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Profile</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd>{detail.email}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Role</dt><dd className="capitalize">{detail.role}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Org</dt><dd>{detail.orgs?.name || "---"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Plan</dt><dd className="capitalize">{detail.orgs?.plan_id || "---"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Signup</dt><dd>{new Date(detail.created_at).toLocaleDateString()}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Last Active</dt><dd>{detail.last_active ? new Date(detail.last_active).toLocaleString() : "Never"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Platform Role</dt><dd>{detail.platform_role || "None"}</dd></div>
            </dl>
          </div>

          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Usage</h2>
            <dl className="space-y-3 text-sm">
              {Object.entries(detail.usage || {}).length === 0 && (
                <p className="text-muted-foreground">No usage data</p>
              )}
              {Object.entries(detail.usage || {}).map(([kind, amount]) => (
                <div key={kind} className="flex justify-between">
                  <dt className="text-muted-foreground capitalize">{kind.replace(/_/g, " ")}</dt>
                  <dd className="font-mono">{typeof amount === "number" ? amount.toFixed(2) : String(amount)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Actions Card */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4 max-w-2xl">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Change Plan Action */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium block">Change Plan</label>
              {!showPlanSelect ? (
                <Button 
                  className="w-full justify-start text-left font-normal" 
                  variant="outline" 
                  onClick={() => {
                    setSelectedPlan(detail.orgs?.plan_id || "starter");
                    setShowPlanSelect(true);
                  }}
                >
                  Change Plan...
                </Button>
              ) : (
                <div className="space-y-2">
                  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="growth">Growth</SelectItem>
                      <SelectItem value="scale">Scale</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1" 
                      disabled={planLoading}
                      onClick={handleChangePlan}
                    >
                      {planLoading ? "Saving..." : "Confirm"}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      disabled={planLoading}
                      onClick={() => setShowPlanSelect(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Reset Password Action */}
            <div className="space-y-2 flex flex-col justify-end">
              <label className="text-xs text-muted-foreground font-medium block">Password Reset</label>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleResetPassword}
                disabled={passwordResetLoading}
              >
                {passwordResetLoading ? "Sending..." : "Reset Password"}
              </Button>
            </div>

            {/* Suspend Account Action */}
            <div className="space-y-2 flex flex-col justify-end">
              <label className="text-xs text-muted-foreground font-medium block">Account Status</label>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full" disabled={suspendLoading}>
                    {suspendLoading ? "Suspending..." : "Suspend Account"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will suspend this user's account immediately. They will not be able to log in or access platform features.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                      onClick={handleSuspendAccount}
                    >
                      Suspend
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Users</h1>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Org</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Signup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && !result && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {result?.data.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No users found</td></tr>
              )}
              {result?.data.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => viewUser(user.id)}
                >
                  <td className="px-4 py-3 font-medium">{user.display_name || "---"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{user.orgs?.name || "---"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <Badge variant="secondary" className="text-xs capitalize">{user.orgs?.plan_id || "---"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize hidden lg:table-cell">{user.role}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{new Date(user.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {result && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {result.total} total users
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LockIcon, WarningCircleIcon, CheckCircleIcon } from '@phosphor-icons/react';
import { authService } from '../services/api';
import Avatar from '../components/ui/Avatar';

export default function AccountPage() {
  const qc = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: me, isLoading } = useQuery({ queryKey: ['me'], queryFn: authService.me });

  const freezeMutation = useMutation({
    mutationFn: authService.freeze,
    onSuccess: () => {
      setShowConfirm(false);
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Account</h1>

      {isLoading ? (
        <div className="h-32 bg-muted rounded-lg animate-pulse" />
      ) : me && (
        <>
          <div className="bg-card border border-border rounded-lg shadow-sm p-5 mb-6 flex items-center gap-3">
            <Avatar name={me.fullName} size={44} />
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{me.fullName}</p>
              <p className="text-sm text-muted-foreground truncate">{me.email}</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <LockIcon size={18} className="text-destructive" weight="regular" />
              <h2 className="text-sm font-semibold text-foreground">Freeze account</h2>
            </div>

            {me.frozen ? (
              <div className="flex items-center gap-1.5 text-sm text-warning bg-warning/5 border border-warning/20 rounded-lg px-3 py-2">
                <WarningCircleIcon size={16} weight="fill" />
                Your account is frozen. Sending money is disabled until an admin unfreezes it.
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  If you suspect your account is compromised, freeze it immediately to stop any outgoing
                  transfers. Only an admin can unfreeze it afterward — this is intentional, so an attacker who
                  has your session can't just undo it.
                </p>
                <button
                  type="button"
                  onClick={() => setShowConfirm(true)}
                  className="w-full border border-destructive text-destructive text-sm font-semibold py-2.5 rounded-lg hover:bg-destructive/5 transition-colors"
                >
                  Freeze my account
                </button>
              </>
            )}

            {freezeMutation.error && (
              <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive mt-3">
                <WarningCircleIcon size={14} weight="fill" />
                Something went wrong — please try again.
              </p>
            )}
          </div>
        </>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 max-w-sm w-full">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <LockIcon size={26} weight="fill" className="text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Freeze your account?</h2>
            <p className="text-sm text-muted-foreground mb-5">
              This immediately blocks all outgoing transfers. You will not be able to undo this yourself —
              only an admin can unfreeze your account afterward.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowConfirm(false)}
                className="flex-1 border border-border text-sm font-semibold py-2.5 rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button type="button" onClick={() => freezeMutation.mutate()} disabled={freezeMutation.isPending}
                className="flex-1 bg-destructive text-white text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5"
              >
                {freezeMutation.isPending
                  ? 'Freezing…'
                  : <><CheckCircleIcon size={16} weight="fill" /> Yes, freeze it</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

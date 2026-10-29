import { useState } from "react";
import { Outlet } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import ConfirmDiscardDialog from "../../components/ui/ConfirmDiscardDialog";
import ConfirmSaveDialog from "../../components/ui/ConfirmSaveDialog";
import UnsavedChangesBar from "../../components/ui/UnsavedChangesBar";
import type { UserSession } from "../../domain/models";
import { useWorkspace } from "../../hooks/useWorkspace";

type Props = { session: UserSession; signOut: () => void };

export default function Workspace({ session, signOut }: Props) {
  const workspace = useWorkspace(session.id);
  const [signOutRequested, setSignOutRequested] = useState(false);
  const requestSignOut = () => {
    if (workspace.isDirty()) setSignOutRequested(true);
    else signOut();
  };
  return (
    <>
      <AppLayout
        session={session}
        apiStatus={workspace.apiStatus}
        hasUnsavedChanges={workspace.hasUnsavedChanges}
        recipeCount={workspace.counts.recipes}
        productionCount={workspace.counts.productions}
        salesCount={workspace.counts.sales}
        marketCount={workspace.counts.market}
        signOut={requestSignOut}
        exportWorkbook={() => void workspace.exportWorkbook()}
      >
        {workspace.hasUnsavedChanges && (
          <UnsavedChangesBar
            busy={workspace.apiStatus === "saving"}
            onDiscard={workspace.discardChanges}
            onSave={() => void workspace.saveChanges().catch(() => { /* Cancelled, or reported by the workspace. */ })}
          />
        )}
        {workspace.isLoading ? <div role="status">Carregando seus dados...</div> : <Outlet context={workspace} />}
      </AppLayout>
      <ConfirmDeleteDialog
        pendingDelete={workspace.pendingDelete}
        onCancel={() => workspace.setPendingDelete(null)}
        onConfirm={() => void workspace.confirmDelete()}
      />
      <ConfirmSaveDialog
        message={workspace.pendingSaveMessage}
        onCancel={() => workspace.resolvePendingSave(false)}
        onConfirm={() => workspace.resolvePendingSave(true)}
      />
      <ConfirmDiscardDialog
        open={workspace.isLeavingBlocked || signOutRequested}
        onStay={() => {
          setSignOutRequested(false);
          workspace.leaveScreen(true);
        }}
        onDiscard={() => {
          if (signOutRequested) {
            setSignOutRequested(false);
            workspace.discardChanges();
            signOut();
          } else workspace.leaveScreen(false);
        }}
      />
    </>
  );
}

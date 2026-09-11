import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Trash2, ReceiptText } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import { ConfirmSheet, EmptyState, Pill } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { useData } from '../hooks/useData.jsx';
import { useTransaction } from '../hooks/useFinance.js';
import { goBack } from '../utils/nav.js';

export default function TransactionDetail() {
  const { id } = useParams();
  const tx = useTransaction(id);
  const { remove } = useData();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);

  if (tx === undefined) return null; // loading
  if (!tx) {
    return (
      <div className="mx-auto max-w-lg">
        <PageHeader title="Not found" back="/transactions" />
        <EmptyState icon={ReceiptText} title="This entry no longer exists" text="It may have been deleted on another device." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title={tx.type === 'income' ? 'Edit income' : 'Edit expense'}
        back="/transactions"
        actions={
          <button type="button" className="btn-danger btn size-10 p-0" onClick={() => setConfirm(true)} aria-label="Delete">
            <Trash2 className="size-5" />
          </button>
        }
      />
      {tx._status !== 'synced' && (
        <div className="mb-4">
          <Pill tone={tx._status === 'failed' ? 'failed' : 'pending'}>{tx._status === 'failed' ? 'Sync failed — see Sync status' : 'Saved on this device · waiting to sync'}</Pill>
        </div>
      )}
      <TransactionForm key={tx.id} type={tx.type} initial={tx} onDone={() => goBack(navigate, '/transactions')} submitLabel="Save changes" />
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this entry?"
        message="It will be removed from this device now and from your other devices when they sync."
        onConfirm={async () => {
          await remove('transactions', tx.id);
          toast('Deleted');
          goBack(navigate, '/transactions');
        }}
      />
    </div>
  );
}

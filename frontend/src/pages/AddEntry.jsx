import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import LoanForm from '../components/LoanForm.jsx';
import { Segmented } from '../components/ui.jsx';
import { goBack } from '../utils/nav.js';

const TYPES = [
  { value: 'expense', label: 'Expense', activeClass: 'text-expense!' },
  { value: 'income', label: 'Income', activeClass: 'text-income!' },
  { value: 'lent', label: 'Lent', activeClass: 'text-lent!' },
  { value: 'borrowed', label: 'Borrowed', activeClass: 'text-borrowed!' },
];

/** The "+" screen: one place to record any kind of money movement, fast. */
export default function AddEntry() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const type = TYPES.some((t) => t.value === params.get('type')) ? params.get('type') : 'expense';
  const personId = params.get('person');
  const done = () => goBack(navigate, '/');

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Add entry" back="/" />
      <Segmented
        className="mb-5"
        options={TYPES}
        value={type}
        onChange={(t) => setParams((p) => ({ ...Object.fromEntries(p), type: t }), { replace: true })}
      />
      {type === 'expense' || type === 'income' ? (
        <TransactionForm key={type} type={type} onDone={done} />
      ) : (
        <LoanForm key={type} direction={type} presetPersonId={personId} onDone={done} submitLabel={type === 'lent' ? 'Save money lent' : 'Save money borrowed'} />
      )}
    </div>
  );
}

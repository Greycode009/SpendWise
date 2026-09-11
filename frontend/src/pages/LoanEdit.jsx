import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import LoanForm from '../components/LoanForm.jsx';
import { Segmented } from '../components/ui.jsx';
import { useLoan } from '../hooks/useFinance.js';
import { useState } from 'react';
import { goBack } from '../utils/nav.js';

export default function LoanEdit() {
  const { id } = useParams();
  const loan = useLoan(id);
  const navigate = useNavigate();
  const [direction, setDirection] = useState(null);

  if (!loan) return null;
  const dir = direction || loan.direction;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Edit loan" back={`/loans/${id}`} />
      <Segmented
        className="mb-5"
        value={dir}
        onChange={setDirection}
        options={[
          { value: 'lent', label: 'I lent', activeClass: 'text-lent!' },
          { value: 'borrowed', label: 'I borrowed', activeClass: 'text-borrowed!' },
        ]}
      />
      <LoanForm
        key={loan.id}
        direction={dir}
        initial={loan}
        minAmount={loan.repaid}
        submitLabel="Save changes"
        onDone={() => goBack(navigate, `/loans/${id}`)}
      />
    </div>
  );
}

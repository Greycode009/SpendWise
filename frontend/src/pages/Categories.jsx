import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import { CategorySheet } from '../components/sheets.jsx';
import { CategoryIcon, ConfirmSheet, Section } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { useData } from '../hooks/useData.jsx';
import { useCategories } from '../hooks/useFinance.js';

export default function Categories() {
  const categories = useCategories();
  const { remove } = useData();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // category | 'new' | null
  const [deleting, setDeleting] = useState(null);

  const groups = [
    { type: 'expense', title: 'Expense categories' },
    { type: 'income', title: 'Income categories' },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Categories"
        back="/settings"
        actions={
          <button type="button" className="btn-primary btn" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> New
          </button>
        }
      />
      {groups.map((g) => (
        <Section key={g.type} title={g.title}>
          <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
            {(categories || [])
              .filter((c) => c.type === g.type)
              .map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEditing(c)}>
                    <CategoryIcon category={c} size="sm" />
                    <span className="truncate font-medium">{c.name}</span>
                  </button>
                  <button type="button" className="btn-ghost btn size-9 p-0 text-slate-400" onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
          </div>
        </Section>
      ))}

      <CategorySheet open={Boolean(editing)} onClose={() => setEditing(null)} category={editing === 'new' ? null : editing} />
      <ConfirmSheet
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={`Delete “${deleting?.name}”?`}
        message="Existing entries in this category are kept and will show as uncategorized."
        onConfirm={async () => {
          await remove('categories', deleting.id);
          toast('Category deleted');
        }}
      />
    </div>
  );
}

import { useFetch } from '../hooks';
import TagPicker from './TagPicker';

// Editable tags card for a record detail page — pass the record's current
// `.tags` and an async `onChange(tagIds)` that PATCHes and reloads the record.
export default function TagsCard({ tags, onChange }) {
  const { data: allTags } = useFetch('/api/tags');
  const selectedIds = (tags || []).map((t) => t.id);
  return (
    <div className="card">
      <h2>Tags</h2>
      <TagPicker allTags={allTags} selectedIds={selectedIds} onChange={onChange} />
    </div>
  );
}

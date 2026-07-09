// Toggleable pill multi-select for the fixed tag vocabulary. `selectedIds` and
// the ids inside `allTags` are numbers throughout.
export default function TagPicker({ allTags, selectedIds, onChange }) {
  if (!allTags || allTags.length === 0) {
    return <div className="hint">No tags yet — add some in Settings → Tags.</div>;
  }
  const toggle = (id) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };
  return (
    <div className="tag-picker">
      {allTags.map((t) => {
        const selected = selectedIds.includes(t.id);
        return (
          <button
            type="button"
            key={t.id}
            className={`tag-pill${selected ? ' selected' : ''}`}
            style={selected ? { background: `${t.color}1f`, color: t.color, borderColor: t.color } : undefined}
            onClick={() => toggle(t.id)}
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

export default function Loading() {
  return (
    <div className="wrap section fmc-shell" aria-busy="true">
      <div className="state-panel"><div className="skeleton" style={{ width: '60%' }} /><div className="skeleton" /><div className="skeleton" style={{ width: '80%' }} /></div>
    </div>
  );
}

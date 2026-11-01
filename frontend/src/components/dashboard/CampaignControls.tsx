type Props = {
  limit: number;
  starting: boolean;
  onLimitChange: (limit: number) => void;
  onStart: () => void;
};

export function CampaignControls({ limit, starting, onLimitChange, onStart }: Props) {
  return (
    <>
      <button className="primary" onClick={onStart} disabled={starting}>
        {starting ? "Starting..." : "Start campaign"}
        <span aria-hidden="true">→</span>
      </button>
      <div className="control-row">
        <label htmlFor="batch">Batch size</label>
        <input
          id="batch"
          type="number"
          min="1"
          max="500"
          value={limit}
          onChange={(event) => {
            const value = Number(event.target.value);
            onLimitChange(Math.min(500, Math.max(1, value || 1)));
          }}
        />
        <span className="hint">1-500 leads per campaign · default 25</span>
      </div>
    </>
  );
}

export default function Loader({ label = 'Processing' }: { label?: string }) {
  return <span className="hud-loader inline-block" role="status" aria-label={label} />;
}

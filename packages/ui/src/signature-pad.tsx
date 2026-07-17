import { useEffect, useRef, type PointerEvent } from "react";
import { Button } from "./button.js";

export type SignaturePadProps = {
  readonly label?: string;
  readonly onChange: (dataUrl: string | null) => void;
};

export function SignaturePad({
  label = "חתימה דיגיטלית",
  onChange,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fffaf2";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#10241f";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  return (
    <div className="sig">
      <span>{label}</span>
      <canvas
        ref={canvasRef}
        width={640}
        height={220}
        aria-label={label}
        onPointerDown={(event) => {
          drawing.current = true;
          const ctx = canvasRef.current?.getContext("2d");
          if (!ctx) return;
          const p = point(event);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const ctx = canvasRef.current?.getContext("2d");
          if (!ctx) return;
          const p = point(event);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          hasInk.current = true;
        }}
        onPointerUp={() => {
          drawing.current = false;
          const canvas = canvasRef.current;
          if (!canvas || !hasInk.current) {
            onChange(null);
            return;
          }
          onChange(canvas.toDataURL("image/png"));
        }}
      />
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (!canvas || !ctx) return;
          ctx.fillStyle = "#fffaf2";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          hasInk.current = false;
          onChange(null);
        }}
      >
        נקה חתימה
      </Button>
      <style>{`
        .sig{display:grid;gap:var(--space-2)}
        .sig span{font-size:var(--text-small);font-weight:600;color:var(--color-ink-soft)}
        canvas{width:100%;max-width:100%;border:1px solid rgb(16 36 31 / 18%);border-radius:var(--radius-sm);touch-action:none;background:#fffaf2;cursor:crosshair}
      `}</style>
    </div>
  );
}

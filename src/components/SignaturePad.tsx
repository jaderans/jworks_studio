import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { Button } from './ui';

/**
 * Sign with a finger, stylus or mouse. Hands back a transparent PNG (data URL)
 * after each stroke, or '' when cleared.
 */
export function SignaturePad({ onChange, label = 'Sign here' }: { onChange: (png: string) => void; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  // Draw at the screen's pixel density so the signature stays sharp in the PDF.
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    const { width, height } = c.getBoundingClientRect();
    c.width = Math.round(width * ratio);
    c.height = Math.round(height * ratio);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#1C2A5A';
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const stroke = (to: { x: number; y: number }) => {
    const ctx = ref.current?.getContext('2d');
    const from = last.current ?? to;
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x + 0.01, to.y + 0.01);
    ctx.stroke();
    last.current = to;
  };

  return (
    <div className="signature-pad">
      <canvas
        ref={ref}
        aria-label={label}
        role="img"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          last.current = null;
          stroke(point(e));
        }}
        onPointerMove={(e) => drawing.current && stroke(point(e))}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          setEmpty(false);
          onChange(ref.current?.toDataURL('image/png') ?? '');
        }}
        onPointerCancel={() => (drawing.current = false)}
      />
      <div className="row between">
        <span className="tiny muted">{empty ? label : 'Signed'}</span>
        <Button
          size="sm"
          variant="ghost"
          disabled={empty}
          onClick={() => {
            const c = ref.current;
            c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
            setEmpty(true);
            onChange('');
          }}
        >
          <Eraser size={15} /> Clear
        </Button>
      </div>
    </div>
  );
}

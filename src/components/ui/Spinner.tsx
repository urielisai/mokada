import { cn } from '../../utils/cn';

interface SpinnerProps {
  className?: string;
  label?: string;
}

const SPOKES = Array.from({ length: 8 });

/** System-style activity indicator: eight spokes fading in sequence. */
export const Spinner = ({ className, label = 'Cargando' }: SpinnerProps) => (
  <span role="status" aria-label={label} className={cn('relative inline-block h-5 w-5 text-gray-500', className)}>
    {SPOKES.map((_, index) => (
      <span
        key={index}
        className="absolute left-[46%] top-0 h-[30%] w-[8%] origin-[50%_166%] rounded-full bg-current"
        style={{
          transform: `rotate(${index * 45}deg)`,
          animation: 'spinner-fade 800ms linear infinite',
          animationDelay: `${index * 100 - 800}ms`,
        }}
      />
    ))}
  </span>
);
